"""
REUNITE-X Match Candidate & Verification Service
Enforces human-in-the-loop review, verified decision recording, and automated status transitions.
"""
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.core.database import db
from app.core.logging import logger
from app.core.security import AuthUser
from app.models.enums import MatchStatus, CaseStatus, VerificationDecision, NotificationChannel
from app.schemas.match import (
    MatchCandidateResponse,
    MatchVerificationRequest,
    MatchRejectionRequest,
    VerificationResponse,
)
from app.services.case_service import CaseService
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationSendRequest


class MatchService:
    @staticmethod
    def get_matches(
        status_filter: Optional[MatchStatus] = None,
        limit: int = 50,
        authority: Optional[AuthUser] = None,
    ) -> List[MatchCandidateResponse]:
        results: List[MatchCandidateResponse] = []

        # Pre-fetch case summaries once for ultra-fast lookup instead of calling inside loop
        all_cases = CaseService.get_cases(limit=1000, user=authority)
        cases_map = {item.id: item for item in all_cases}

        for mid, m in db.match_candidates.items():
            if status_filter and m["status"] != status_filter.value:
                continue

            missing_case_details = CaseService.get_case_by_id(m["missing_case_id"], authority)
            found_case_details = CaseService.get_case_by_id(m["found_case_id"], authority)
            missing_case = cases_map.get(m["missing_case_id"])
            found_case = cases_map.get(m["found_case_id"])

            results.append(
                MatchCandidateResponse(
                    id=m["id"],
                    missing_case_id=m["missing_case_id"],
                    found_case_id=m["found_case_id"],
                    missing_case=missing_case,
                    found_case=found_case,
                    missing_case_details=missing_case_details,
                    found_case_details=found_case_details,
                    face_similarity=m["face_similarity"],
                    age_gender_score=m["age_gender_score"],
                    location_score=m["location_score"],
                    text_score=m["text_score"],
                    match_score=m["match_score"],
                    priority_score=m["priority_score"],
                    score_explanation=m.get("score_explanation", {}),
                    status=MatchStatus(m["status"]),
                    reviewed_by=m.get("reviewed_by"),
                    reviewed_at=datetime.fromisoformat(m["reviewed_at"].replace("Z", "+00:00")) if m.get("reviewed_at") else None,
                    created_at=datetime.fromisoformat(m["created_at"].replace("Z", "+00:00")),
                )
            )

        # Sort highest priority first
        results.sort(key=lambda x: (x.priority_score, x.match_score), reverse=True)
        return results[:limit]

    @staticmethod
    def verify_match(
        match_id: str,
        request: MatchVerificationRequest,
        authority: AuthUser
    ) -> VerificationResponse:
        m = db.match_candidates.get(match_id)
        if not m:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match candidate '{match_id}' not found."
            )

        if m["status"] != MatchStatus.PENDING_REVIEW.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate is no longer awaiting review (status: {m['status']})."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        verification_id = str(uuid.uuid4())

        # Update candidate match status
        m["status"] = MatchStatus.VERIFIED.value
        m["reviewed_by"] = authority.id
        m["reviewed_at"] = now_iso
        db.save_match_candidate(match_id)

        # Update both cases to VERIFIED
        missing_case = db.cases.get(m["missing_case_id"])
        found_case = db.cases.get(m["found_case_id"])

        if missing_case:
            missing_case["status"] = CaseStatus.VERIFIED.value
            missing_case["updated_at"] = now_iso
            db.save_case(m["missing_case_id"])

        if found_case:
            found_case["status"] = CaseStatus.VERIFIED.value
            found_case["updated_at"] = now_iso
            db.save_case(m["found_case_id"])

        # Update confirmed location if authority supplied one
        if request.verified_location_lat is not None and request.verified_location_lng is not None:
            for p in db.persons.values():
                if p["case_id"] in (m["missing_case_id"], m["found_case_id"]):
                    p["last_seen_lat"] = request.verified_location_lat
                    p["last_seen_lng"] = request.verified_location_lng
                    if request.verified_location_name:
                        p["last_seen_address"] = request.verified_location_name
                    db.save_person(p["id"])

        # Create verification record
        verification_record = {
            "id": verification_id,
            "match_id": match_id,
            "missing_case_id": m["missing_case_id"],
            "found_case_id": m["found_case_id"],
            "authority_id": authority.id,
            "decision": VerificationDecision.VERIFIED.value,
            "notes": request.notes,
            "verified_location_lat": request.verified_location_lat,
            "verified_location_lng": request.verified_location_lng,
            "verified_location_name": request.verified_location_name,
            "family_notified": False,
            "verified_at": now_iso
        }
        db.verifications[verification_id] = verification_record

        # Immutable audit log
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": authority.id,
            "action": "MATCH_VERIFIED",
            "resource_type": "match_candidates",
            "resource_id": match_id,
            "changes": {
                "decision": "verified",
                "notes": request.notes,
                "missing_case": missing_case.get("case_number") if missing_case else None,
                "found_case": found_case.get("case_number") if found_case else None
            },
            "created_at": now_iso
        })

        # Family notification trigger
        family_notified = False
        missing_person = next(
            (person for person in db.persons.values()
             if person["case_id"] == m["missing_case_id"]),
            None,
        )
        target_email = missing_person.get("contact_email") if missing_person else None
        if request.notify_family and target_email:
            notification = NotificationService.send(NotificationSendRequest(
                case_id=m["missing_case_id"],
                match_id=match_id,
                recipient_target=target_email,
                channel=NotificationChannel.EMAIL,
                title=f"Official update for case {missing_case.get('case_number', '')}",
                message=(
                    "An authorized disaster-response officer has verified a potential match. "
                    "Please contact your designated relief authority to coordinate next steps."
                ),
                payload={"case_id": m["missing_case_id"], "event": "verification_complete"},
            ), actor_id=authority.id)
            family_notified = notification.status.value == "sent"
            verification_record["family_notified"] = family_notified
            if family_notified:
                for matched_case_id in (m["missing_case_id"], m["found_case_id"]):
                    case_record = db.cases.get(matched_case_id)
                    if case_record:
                        case_record["status"] = CaseStatus.NOTIFIED.value
                        case_record["updated_at"] = now_iso
        elif request.notify_family:
            logger.warning(
                "Verified match %s has no family email on record; no notification was sent.",
                match_id,
            )

        logger.info(f"Authority {authority.id} verified match {match_id}")
        return VerificationResponse(
            id=verification_id,
            match_id=match_id,
            missing_case_id=m["missing_case_id"],
            found_case_id=m["found_case_id"],
            authority_id=authority.id,
            decision=VerificationDecision.VERIFIED,
            notes=request.notes,
            verified_location_lat=request.verified_location_lat,
            verified_location_lng=request.verified_location_lng,
            verified_location_name=request.verified_location_name,
            family_notified=family_notified,
            verified_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        )

    @staticmethod
    def reject_match(
        match_id: str,
        request: MatchRejectionRequest,
        authority: AuthUser
    ) -> dict:
        m = db.match_candidates.get(match_id)
        if not m:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match candidate '{match_id}' not found."
            )
        if m["status"] != MatchStatus.PENDING_REVIEW.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate is no longer awaiting review (status: {m['status']})."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        m["status"] = MatchStatus.REJECTED.value
        m["reviewed_by"] = authority.id
        m["reviewed_at"] = now_iso
        db.save_match_candidate(match_id)
        verification_id = str(uuid.uuid4())
        db.verifications[verification_id] = {
            "id": verification_id,
            "match_id": match_id,
            "missing_case_id": m["missing_case_id"],
            "found_case_id": m["found_case_id"],
            "authority_id": authority.id,
            "decision": VerificationDecision.REJECTED.value,
            "notes": request.reason,
            "family_notified": False,
            "verified_at": now_iso,
        }

        # Revert case statuses back to searching
        missing_case = db.cases.get(m["missing_case_id"])
        found_case = db.cases.get(m["found_case_id"])

        if missing_case and missing_case["status"] == CaseStatus.CANDIDATE_FOUND.value:
            missing_case["status"] = CaseStatus.SEARCHING.value
            missing_case["updated_at"] = now_iso

        if found_case and found_case["status"] == CaseStatus.CANDIDATE_FOUND.value:
            found_case["status"] = CaseStatus.SEARCHING.value
            found_case["updated_at"] = now_iso

        # Audit log
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": authority.id,
            "action": "MATCH_REJECTED",
            "resource_type": "match_candidates",
            "resource_id": match_id,
            "changes": {"decision": "rejected", "reason": request.reason},
            "created_at": now_iso
        })

        logger.info(f"Authority {authority.id} rejected match {match_id}: {request.reason}")
        return {"status": "success", "message": f"Match candidate '{match_id}' rejected."}

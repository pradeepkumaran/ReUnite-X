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


class MatchService:
    @staticmethod
    def get_matches(
        status_filter: Optional[MatchStatus] = None,
        limit: int = 50
    ) -> List[MatchCandidateResponse]:
        results: List[MatchCandidateResponse] = []

        for mid, m in db.match_candidates.items():
            if status_filter and m["status"] != status_filter.value:
                continue

            # Hydrate case summaries
            missing_cases = CaseService.get_cases(limit=1, offset=0)
            missing_case = next((c for c in missing_cases if c.id == m["missing_case_id"]), None)
            found_case = next((c for c in missing_cases if c.id == m["found_case_id"]), None)

            # If not in top list, query directly
            if not missing_case:
                try:
                    c_det = CaseService.get_case_by_id(m["missing_case_id"])
                    missing_case = next((c for c in CaseService.get_cases(limit=100) if c.id == m["missing_case_id"]), None)
                except Exception:
                    pass

            if not found_case:
                try:
                    c_det = CaseService.get_case_by_id(m["found_case_id"])
                    found_case = next((c for c in CaseService.get_cases(limit=100) if c.id == m["found_case_id"]), None)
                except Exception:
                    pass

            results.append(
                MatchCandidateResponse(
                    id=m["id"],
                    missing_case_id=m["missing_case_id"],
                    found_case_id=m["found_case_id"],
                    missing_case=missing_case,
                    found_case=found_case,
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

        if m["status"] == MatchStatus.VERIFIED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This candidate match has already been verified."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        verification_id = str(uuid.uuid4())

        # Update candidate match status
        m["status"] = MatchStatus.VERIFIED.value
        m["reviewed_by"] = authority.id
        m["reviewed_at"] = now_iso

        # Update both cases to VERIFIED
        missing_case = db.cases.get(m["missing_case_id"])
        found_case = db.cases.get(m["found_case_id"])

        if missing_case:
            missing_case["status"] = CaseStatus.VERIFIED.value
            missing_case["updated_at"] = now_iso

        if found_case:
            found_case["status"] = CaseStatus.VERIFIED.value
            found_case["updated_at"] = now_iso

        # Update confirmed location if authority supplied one
        if request.verified_location_lat and request.verified_location_lng:
            for p in db.persons.values():
                if p["case_id"] in (m["missing_case_id"], m["found_case_id"]):
                    p["last_seen_lat"] = request.verified_location_lat
                    p["last_seen_lng"] = request.verified_location_lng
                    if request.verified_location_name:
                        p["last_seen_address"] = request.verified_location_name

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
            "family_notified": request.notify_family,
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
        if request.notify_family:
            notif_id = str(uuid.uuid4())
            db.notifications[notif_id] = {
                "id": notif_id,
                "case_id": m["missing_case_id"],
                "match_id": match_id,
                "recipient_id": missing_case.get("reporter_id") if missing_case else None,
                "channel": NotificationChannel.EMAIL.value,
                "recipient_target": "family@example.com",
                "title": f"Official Match Verified: {missing_case.get('case_number') if missing_case else 'Case'}",
                "message": f"Emergency authorities have officially verified a match. Notes: {request.notes}",
                "status": "sent",
                "sent_at": now_iso,
                "created_at": now_iso
            }
            logger.info(f"Queued family notification for verified match {match_id}")

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
            family_notified=request.notify_family,
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

        now_iso = datetime.now(timezone.utc).isoformat()
        m["status"] = MatchStatus.REJECTED.value
        m["reviewed_by"] = authority.id
        m["reviewed_at"] = now_iso

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

"""
REUNITE-X Case Business Logic Service
Handles case creation, retrieval, updates, photo uploads, and audit recording.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status

from app.core.database import db
from app.core.logging import logger
from app.core.security import AuthUser
from app.models.enums import CaseType, CaseStatus, UserRole
from app.schemas.case import (
    CaseCreate,
    CaseDetailResponse,
    CaseSummaryResponse,
    PhotoResponse,
)
from app.schemas.person import PersonResponse


def _to_datetime_iso(dt: Optional[datetime]) -> str:
    if dt is None:
        return datetime.now(timezone.utc).isoformat()
    return dt.isoformat()


def _is_minor(age: Optional[int]) -> bool:
    return age is not None and age < 18


class CaseService:
    @staticmethod
    def create_case(payload: CaseCreate, reporter: Optional[AuthUser] = None) -> CaseDetailResponse:
        case_id = str(uuid.uuid4())
        person_id = str(uuid.uuid4())
        reporter_id = reporter.id if reporter else None

        # Check for idempotent client UUID if provided
        if payload.client_case_uuid:
            for existing_id, existing_case in db.cases.items():
                if existing_case.get("client_case_uuid") == payload.client_case_uuid:
                    logger.info(f"Idempotent hit for client_case_uuid {payload.client_case_uuid}")
                    return CaseService.get_case_by_id(existing_id, reporter)

        case_number = db.generate_case_number()
        is_minor = _is_minor(payload.person.approximate_age)
        now_iso = datetime.now(timezone.utc).isoformat()

        # Priority calculation: default 1-5
        priority = 1
        if is_minor:
            priority += 2
        if payload.person.is_vulnerable:
            priority += 2
        priority = min(priority, 5)

        case_record = {
            "id": case_id,
            "client_case_uuid": payload.client_case_uuid,
            "disaster_id": payload.disaster_id,
            "reporter_id": reporter_id,
            "case_number": case_number,
            "type": payload.type.value,
            "status": CaseStatus.REPORTED.value,
            "priority_level": priority,
            "is_minor": is_minor,
            "consent_given": payload.consent_given,
            "synced_from_offline": False,
            "created_at": now_iso,
            "updated_at": now_iso,
            "closed_at": None,
        }

        person_record = {
            "id": person_id,
            "case_id": case_id,
            "full_name": payload.person.full_name,
            "approximate_age": payload.person.approximate_age,
            "age_range_min": payload.person.age_range_min,
            "age_range_max": payload.person.age_range_max,
            "gender": payload.person.gender.value,
            "description": payload.person.description,
            "clothing_details": payload.person.clothing_details,
            "physical_marks": payload.person.physical_marks,
            "last_seen_lat": payload.person.last_seen_lat,
            "last_seen_lng": payload.person.last_seen_lng,
            "last_seen_address": payload.person.last_seen_address,
            "last_seen_time": _to_datetime_iso(payload.person.last_seen_time),
            "contact_person_name": payload.person.contact_person_name,
            "contact_phone": payload.person.contact_phone,
            "contact_email": payload.person.contact_email,
            "contact_relationship": payload.person.contact_relationship,
            "medical_notes": payload.person.medical_notes,
            "is_vulnerable": payload.person.is_vulnerable,
            "vulnerability_reasons": payload.person.vulnerability_reasons,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        db.cases[case_id] = case_record
        db.persons[person_id] = person_record

        # Audit log entry
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": reporter_id,
            "action": "CASE_CREATED",
            "resource_type": "cases",
            "resource_id": case_id,
            "changes": {"case_number": case_number, "type": payload.type.value},
            "created_at": now_iso,
        })

        logger.info(f"Created new {payload.type.value} case: {case_number} (ID: {case_id})")
        return CaseService.get_case_by_id(case_id, reporter)

    @staticmethod
    def get_cases(
        case_type: Optional[CaseType] = None,
        case_status: Optional[CaseStatus] = None,
        disaster_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        user: Optional[AuthUser] = None,
    ) -> List[CaseSummaryResponse]:
        results: List[CaseSummaryResponse] = []

        for cid, c in db.cases.items():
            if case_type and c["type"] != case_type.value:
                continue
            if case_status and c["status"] != case_status.value:
                continue
            if disaster_id and c.get("disaster_id") != disaster_id:
                continue

            # Find matching person
            person = next((p for p in db.persons.values() if p["case_id"] == cid), None)
            person_name = person["full_name"] if person else "Unknown"
            approx_age = person.get("approximate_age") if person else None
            address = person.get("last_seen_address") if person else None

            # Primary photo
            primary_photo = next(
                (ph for ph in db.photos.values() if ph["case_id"] == cid and ph.get("is_primary")),
                None
            )
            photo_url = primary_photo["storage_path"] if primary_photo else None

            results.append(
                CaseSummaryResponse(
                    id=c["id"],
                    case_number=c["case_number"],
                    client_case_uuid=c.get("client_case_uuid"),
                    disaster_id=c.get("disaster_id"),
                    reporter_id=c.get("reporter_id"),
                    type=CaseType(c["type"]),
                    status=CaseStatus(c["status"]),
                    priority_level=c["priority_level"],
                    is_minor=c["is_minor"],
                    consent_given=c["consent_given"],
                    synced_from_offline=c["synced_from_offline"],
                    person_name=person_name,
                    approximate_age=approx_age,
                    last_seen_address=address,
                    primary_photo_url=photo_url,
                    created_at=datetime.fromisoformat(c["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(c["updated_at"].replace("Z", "+00:00")),
                )
            )

        # Sort newest first
        results.sort(key=lambda x: x.created_at, reverse=True)
        return results[offset : offset + limit]

    @staticmethod
    def get_case_by_id(case_id: str, user: Optional[AuthUser] = None) -> CaseDetailResponse:
        c = db.cases.get(case_id)
        if not c:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID '{case_id}' not found."
            )

        person = next((p for p in db.persons.values() if p["case_id"] == case_id), None)
        if not person:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Person record for case '{case_id}' is missing."
            )

        # Photos
        photos_list: List[PhotoResponse] = []
        for ph in db.photos.values():
            if ph["case_id"] == case_id:
                photos_list.append(
                    PhotoResponse(
                        id=ph["id"],
                        case_id=ph["case_id"],
                        person_id=ph.get("person_id"),
                        storage_path=ph["storage_path"],
                        file_name=ph["file_name"],
                        signed_url=f"/photos/download/{ph['id']}",
                        is_primary=ph.get("is_primary", False),
                        face_detected=ph.get("face_detected", False),
                        face_count=ph.get("face_count", 0),
                        quality_score=ph.get("quality_score"),
                        created_at=datetime.fromisoformat(ph["created_at"].replace("Z", "+00:00")),
                    )
                )

        # If user is public and person is minor, shield contact details
        is_privileged = user and user.role in (UserRole.AUTHORITY, UserRole.ADMIN, UserRole.VOLUNTEER)
        contact_phone = person.get("contact_phone")
        contact_person_name = person.get("contact_person_name")
        contact_email = person.get("contact_email")

        if not is_privileged and c.get("is_minor"):
            contact_phone = "[REDACTED - MINOR PROTECTION]"
            contact_person_name = "[REDACTED - CONTACT RELIEF AUTHORITY]"
            contact_email = None

        person_response = PersonResponse(
            id=person["id"],
            case_id=person["case_id"],
            full_name=person["full_name"],
            approximate_age=person.get("approximate_age"),
            age_range_min=person.get("age_range_min"),
            age_range_max=person.get("age_range_max"),
            gender=person["gender"],
            description=person.get("description"),
            clothing_details=person.get("clothing_details"),
            physical_marks=person.get("physical_marks"),
            last_seen_lat=person.get("last_seen_lat"),
            last_seen_lng=person.get("last_seen_lng"),
            last_seen_address=person.get("last_seen_address"),
            last_seen_time=datetime.fromisoformat(person["last_seen_time"].replace("Z", "+00:00")) if person.get("last_seen_time") else None,
            contact_person_name=contact_person_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            contact_relationship=person.get("contact_relationship"),
            medical_notes=person.get("medical_notes") if is_privileged else None,
            is_vulnerable=person.get("is_vulnerable", False),
            vulnerability_reasons=person.get("vulnerability_reasons", []),
            created_at=datetime.fromisoformat(person["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat((person.get("updated_at") or person["created_at"]).replace("Z", "+00:00")),
        )

        return CaseDetailResponse(
            id=c["id"],
            case_number=c["case_number"],
            client_case_uuid=c.get("client_case_uuid"),
            disaster_id=c.get("disaster_id"),
            reporter_id=c.get("reporter_id"),
            type=CaseType(c["type"]),
            status=CaseStatus(c["status"]),
            priority_level=c["priority_level"],
            is_minor=c["is_minor"],
            consent_given=c["consent_given"],
            synced_from_offline=c["synced_from_offline"],
            person=person_response,
            photos=photos_list,
            created_at=datetime.fromisoformat(c["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(c["updated_at"].replace("Z", "+00:00")),
            closed_at=datetime.fromisoformat(c["closed_at"].replace("Z", "+00:00")) if c.get("closed_at") else None,
        )

    @staticmethod
    def update_status(
        case_id: str,
        target_status: CaseStatus,
        user: AuthUser,
        notes: Optional[str] = None
    ) -> CaseDetailResponse:
        c = db.cases.get(case_id)
        if not c:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case with ID '{case_id}' not found."
            )

        # Role enforcement for specific transitions
        if target_status in (CaseStatus.VERIFIED, CaseStatus.REUNITED, CaseStatus.CLOSED):
            if user.role not in (UserRole.AUTHORITY, UserRole.ADMIN):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Only disaster authorities can transition cases to '{target_status.value}'."
                )

        old_status = c["status"]
        now_iso = datetime.now(timezone.utc).isoformat()
        c["status"] = target_status.value
        c["updated_at"] = now_iso
        if target_status == CaseStatus.CLOSED:
            c["closed_at"] = now_iso

        # Log transition in audit trail
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": user.id,
            "action": "STATUS_CHANGED",
            "resource_type": "cases",
            "resource_id": case_id,
            "changes": {"old_status": old_status, "new_status": target_status.value, "notes": notes},
            "created_at": now_iso,
        })

        logger.info(f"Updated status for case {c['case_number']}: {old_status} -> {target_status.value} by {user.id}")
        return CaseService.get_case_by_id(case_id, user)

    @staticmethod
    def add_photo(
        case_id: str,
        file_name: str,
        mime_type: str,
        file_size: int,
        is_primary: bool = False
    ) -> PhotoResponse:
        c = db.cases.get(case_id)
        if not c:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case '{case_id}' not found."
            )

        person = next((p for p in db.persons.values() if p["case_id"] == case_id), None)
        person_id = person["id"] if person else None

        photo_id = str(uuid.uuid4())
        storage_path = f"case_photos/{case_id}/{photo_id}_{file_name}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # If primary, reset other photos for this case
        if is_primary:
            for ph in db.photos.values():
                if ph["case_id"] == case_id:
                    ph["is_primary"] = False

        photo_record = {
            "id": photo_id,
            "case_id": case_id,
            "person_id": person_id,
            "storage_path": storage_path,
            "file_name": file_name,
            "mime_type": mime_type,
            "file_size_bytes": file_size,
            "is_primary": is_primary,
            "face_detected": True, # Placeholder until AI engine runs
            "face_count": 1,
            "quality_score": 0.90,
            "created_at": now_iso
        }
        db.photos[photo_id] = photo_record

        logger.info(f"Attached photo {photo_id} to case {case_id}")
        return PhotoResponse(
            id=photo_id,
            case_id=case_id,
            person_id=person_id,
            storage_path=storage_path,
            file_name=file_name,
            signed_url=f"/photos/download/{photo_id}",
            is_primary=is_primary,
            face_detected=True,
            face_count=1,
            quality_score=0.90,
            created_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        )

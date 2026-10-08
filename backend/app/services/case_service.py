"""
REUNITE-X Case Business Logic Service
Handles case creation, retrieval, updates, photo uploads, and audit recording.
"""
import uuid
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status

from app.core.database import db
from app.core.database import get_supabase_admin_client
from app.core.config import settings
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


def _supabase_project_configured() -> bool:
    return bool(
        settings.SUPABASE_URL
        and "mock-supabase" not in settings.SUPABASE_URL
        and "your-project" not in settings.SUPABASE_URL
        and bool(settings.SUPABASE_KEY)
        and settings.SUPABASE_KEY != "mock-anon-key"
    )


def _signed_photo_url(storage_path: str) -> Optional[str]:
    if not _supabase_project_configured():
        return None
    client = get_supabase_admin_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase Storage is unavailable.")
    try:
        response = client.storage.from_(settings.SUPABASE_PHOTO_BUCKET).create_signed_url(
            storage_path, settings.PHOTO_SIGNED_URL_TTL_SECONDS
        )
        return response.get("signedURL") or response.get("signedUrl")
    except Exception as exc:
        logger.exception("Could not create signed photo URL for %s.", storage_path)
        raise HTTPException(status_code=502, detail="Could not create a private photo URL.") from exc


def _can_view_private_case(case: Dict[str, Any], user: Optional[AuthUser]) -> bool:
    privileged_roles = (
        UserRole.AUTHORITY, UserRole.ADMIN, UserRole.VOLUNTEER,
        UserRole.RESCUE_TEAM, UserRole.HOSPITAL, UserRole.SHELTER, UserRole.HOSPITAL_SHELTER
    )
    return bool(
        user and (
            user.role in privileged_roles
            or case.get("reporter_id") == user.id
        )
    )


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
            privileged = _can_view_private_case(c, user)
            if c.get("is_minor") and not privileged:
                person_name = "Protected person"
                address = None

            # Primary photo
            primary_photo = next(
                (ph for ph in db.photos.values() if ph["case_id"] == cid and ph.get("is_primary")),
                None
            )
            photo_url = (
                _signed_photo_url(primary_photo["storage_path"])
                if primary_photo and _can_view_private_case(c, user)
                else None
            )

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
                    approximate_age=(
                        approx_age if privileged or not c.get("is_minor") else None
                    ),
                    last_seen_address=address,
                    last_seen_lat=(
                        person.get("last_seen_lat")
                        if person and (privileged or not c.get("is_minor"))
                        else None
                    ),
                    last_seen_lng=(
                        person.get("last_seen_lng")
                        if person and (privileged or not c.get("is_minor"))
                        else None
                    ),
                    primary_photo_url=photo_url if privileged else None,
                    created_at=datetime.fromisoformat(c["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(c["updated_at"].replace("Z", "+00:00")),
                )
            )

        # Sort newest first
        results.sort(key=lambda x: x.created_at, reverse=True)
        page = results[offset : offset + limit]
        now_iso = datetime.now(timezone.utc).isoformat()
        for case in page:
            db.audit_logs.append({
                "id": str(uuid.uuid4()),
                "actor_id": user.id if user else None,
                "action": "CASE_SUMMARY_VIEWED",
                "resource_type": "cases",
                "resource_id": case.id,
                "changes": {},
                "created_at": now_iso,
            })
        return page

    @staticmethod
    def get_case_by_id(case_id: str, user: Optional[AuthUser] = None) -> CaseDetailResponse:
        c = db.cases.get(case_id)
        if not c:
            # Look up by case_number or client_case_uuid for resilient tracking
            for item in db.cases.values():
                if (
                    item.get("case_number", "").lower() == case_id.lower()
                    or item.get("client_case_uuid") == case_id
                ):
                    c = item
                    case_id = c["id"]
                    break

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
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": user.id if user else None,
            "action": "CASE_DETAILS_VIEWED",
            "resource_type": "cases",
            "resource_id": case_id,
            "changes": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        # Private photo URLs are issued only to responders and the case owner.
        photos_list: List[PhotoResponse] = []
        can_view_private = _can_view_private_case(c, user)
        for ph in db.photos.values():
            if ph["case_id"] == case_id and can_view_private:
                photos_list.append(
                    PhotoResponse(
                        id=ph["id"],
                        case_id=ph["case_id"],
                        person_id=ph.get("person_id"),
                        storage_path=ph["storage_path"],
                        file_name=ph["file_name"],
                        signed_url=_signed_photo_url(ph["storage_path"]),
                        is_primary=ph.get("is_primary", False),
                        face_detected=ph.get("face_detected", False),
                        face_count=ph.get("face_count", 0),
                        quality_score=ph.get("quality_score"),
                        processing_status=ph.get("processing_status", "queued"),
                        processing_error=ph.get("processing_error"),
                        created_at=datetime.fromisoformat(ph["created_at"].replace("Z", "+00:00")),
                    )
                )

        # If user is public and person is minor, shield contact details
        is_privileged = bool(user and user.role in (
            UserRole.AUTHORITY, UserRole.ADMIN, UserRole.VOLUNTEER,
            UserRole.RESCUE_TEAM, UserRole.HOSPITAL, UserRole.SHELTER, UserRole.HOSPITAL_SHELTER
        ))
        is_case_owner = bool(user and c.get("reporter_id") == user.id)
        contact_phone = person.get("contact_phone")
        contact_person_name = person.get("contact_person_name")
        contact_email = person.get("contact_email")

        if not is_privileged and not is_case_owner and c.get("is_minor"):
            contact_phone = "[REDACTED - MINOR PROTECTION]"
            contact_person_name = "[REDACTED - CONTACT RELIEF AUTHORITY]"
            contact_email = None
        elif not is_privileged and not is_case_owner:
            contact_phone = None
            contact_person_name = None
            contact_email = None

        person_response = PersonResponse(
            id=person["id"],
            case_id=person["case_id"],
            full_name=(
                person["full_name"]
                if is_privileged or is_case_owner or not c.get("is_minor")
                else "Protected person"
            ),
            approximate_age=(
                person.get("approximate_age")
                if is_privileged or is_case_owner or not c.get("is_minor")
                else None
            ),
            age_range_min=person.get("age_range_min"),
            age_range_max=person.get("age_range_max"),
            gender=person["gender"],
            description=person.get("description"),
            clothing_details=person.get("clothing_details"),
            physical_marks=person.get("physical_marks"),
            last_seen_lat=(
                person.get("last_seen_lat")
                if is_privileged or is_case_owner or not c.get("is_minor") else None
            ),
            last_seen_lng=(
                person.get("last_seen_lng")
                if is_privileged or is_case_owner or not c.get("is_minor") else None
            ),
            last_seen_address=(
                person.get("last_seen_address")
                if is_privileged or is_case_owner or not c.get("is_minor") else None
            ),
            last_seen_time=datetime.fromisoformat(person["last_seen_time"].replace("Z", "+00:00")) if person.get("last_seen_time") else None,
            contact_person_name=contact_person_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            contact_relationship=person.get("contact_relationship"),
            medical_notes=person.get("medical_notes") if is_privileged else None,
            is_vulnerable=(
                person.get("is_vulnerable", False)
                if is_privileged or is_case_owner or not c.get("is_minor") else False
            ),
            vulnerability_reasons=(
                person.get("vulnerability_reasons", [])
                if is_privileged or is_case_owner or not c.get("is_minor") else []
            ),
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
            potential_duplicate_case_ids=(
                c.get("potential_duplicate_case_ids", []) if is_privileged else []
            ),
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

        allowed_roles = (
            UserRole.AUTHORITY, UserRole.ADMIN, UserRole.VOLUNTEER,
            UserRole.RESCUE_TEAM, UserRole.HOSPITAL, UserRole.SHELTER, UserRole.HOSPITAL_SHELTER
        )
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only disaster authorities and designated responders can update case status.",
            )

        if target_status in (CaseStatus.REUNITED, CaseStatus.CLOSED) and user.role not in (UserRole.AUTHORITY, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only disaster authorities can mark cases as reunited or closed.",
            )

        old_status = c["status"]
        if target_status == CaseStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Case verification must be performed through an authority match decision.",
            )
        if target_status == CaseStatus.REUNITED and old_status not in (
            CaseStatus.VERIFIED.value, CaseStatus.NOTIFIED.value
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A case must be verified before it can be marked reunited.",
            )
        if target_status == CaseStatus.CLOSED and old_status != CaseStatus.REUNITED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A case must be marked reunited before it can be closed.",
            )
        if target_status == CaseStatus.NOTIFIED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Notification status is recorded by the notification workflow.",
            )
        now_iso = datetime.now(timezone.utc).isoformat()
        c["status"] = target_status.value
        c["updated_at"] = now_iso
        if target_status == CaseStatus.CLOSED:
            c["closed_at"] = now_iso
        db.save_case(case_id)

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

        if target_status == CaseStatus.REUNITED:
            person = next((item for item in db.persons.values() if item["case_id"] == case_id), None)
            if person and person.get("contact_email"):
                from app.models.enums import NotificationChannel
                from app.schemas.notification import NotificationSendRequest
                from app.services.notification_service import NotificationService
                NotificationService.send(NotificationSendRequest(
                    case_id=case_id,
                    recipient_target=person["contact_email"],
                    channel=NotificationChannel.EMAIL,
                    title=f"Reunification completed: {c['case_number']}",
                    message=(
                        "An authorized disaster-response officer has recorded this case as reunited. "
                        "Please contact your relief authority if you need assistance."
                    ),
                    payload={"case_id": case_id, "event": "reunited"},
                ), actor_id=user.id)

        logger.info(f"Updated status for case {c['case_number']}: {old_status} -> {target_status.value} by {user.id}")
        return CaseService.get_case_by_id(case_id, user)

    @staticmethod
    def add_photo(
        case_id: str,
        file_name: str,
        mime_type: str,
        file_size: int,
        is_primary: bool = False,
        client_photo_id: Optional[str] = None,
        photo_bytes: Optional[bytes] = None,
        can_view_private: bool = False,
        actor_id: Optional[str] = None,
    ) -> PhotoResponse:
        c = db.cases.get(case_id)
        if not c:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case '{case_id}' not found."
            )

        person = next((p for p in db.persons.values() if p["case_id"] == case_id), None)
        person_id = person["id"] if person else None

        if client_photo_id:
            existing = next(
                (photo for photo in db.photos.values()
                 if photo.get("client_photo_id") == client_photo_id),
                None,
            )
            if existing:
                return PhotoResponse(
                    id=existing["id"],
                    case_id=existing["case_id"],
                    person_id=existing.get("person_id"),
                    storage_path=existing["storage_path"],
                    file_name=existing["file_name"],
                    signed_url=(
                        _signed_photo_url(existing["storage_path"]) if can_view_private else None
                    ),
                    is_primary=existing.get("is_primary", False),
                    face_detected=existing.get("face_detected", False),
                    face_count=existing.get("face_count", 0),
                    quality_score=existing.get("quality_score"),
                    processing_status=existing.get("processing_status", "queued"),
                    processing_error=existing.get("processing_error"),
                    created_at=datetime.fromisoformat(existing["created_at"].replace("Z", "+00:00")),
                )

        photo_id = str(uuid.uuid4())
        safe_file_name = os.path.basename(file_name).replace("\x00", "")[:180] or "photo"
        storage_path = f"case_photos/{case_id}/{photo_id}_{safe_file_name}"
        now_iso = datetime.now(timezone.utc).isoformat()

        if _supabase_project_configured():
            if photo_bytes is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Photo bytes are required for private Storage upload.",
                )
            client = get_supabase_admin_client()
            if client is None:
                raise HTTPException(status_code=503, detail="Supabase Storage is unavailable.")
            try:
                client.storage.from_(settings.SUPABASE_PHOTO_BUCKET).upload(
                    storage_path,
                    photo_bytes,
                    file_options={"content-type": mime_type, "upsert": "false"},
                )
            except Exception as exc:
                logger.exception("Supabase photo upload failed for case %s.", case_id)
                raise HTTPException(status_code=502, detail="Secure photo upload failed.") from exc

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
            "file_name": safe_file_name,
            "client_photo_id": client_photo_id,
            "mime_type": mime_type,
            "file_size_bytes": file_size,
            "is_primary": is_primary,
            "face_detected": False,
            "face_count": 0,
            "quality_score": None,
            "processing_status": "queued",
            "created_at": now_iso
        }
        db.photos[photo_id] = photo_record
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "action": "PHOTO_UPLOADED",
            "resource_type": "photos",
            "resource_id": photo_id,
            "changes": {"case_id": case_id, "mime_type": mime_type, "file_size": file_size},
            "created_at": now_iso,
        })

        logger.info(f"Attached photo {photo_id} to case {case_id}")
        return PhotoResponse(
            id=photo_id,
            case_id=case_id,
            person_id=person_id,
            storage_path=storage_path,
            file_name=file_name,
            signed_url=_signed_photo_url(storage_path) if can_view_private else None,
            is_primary=is_primary,
            face_detected=False,
            face_count=0,
            quality_score=None,
            processing_status="queued",
            created_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        )

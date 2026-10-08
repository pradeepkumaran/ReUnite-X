"""
REUNITE-X Search Service
Multi-criteria search engine supporting demographic filters, radius search via
the Haversine formula, and automated privacy masking for vulnerable minors.
"""
import math
from typing import List, Optional
from datetime import datetime

from app.core.database import db
from app.core.security import AuthUser
from app.models.enums import CaseType, CaseStatus, UserRole, GenderType
from app.schemas.case import PublicCaseSearchItem
from app.schemas.person import PersonPublicSafeResponse


def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two geographic coordinates in kilometers."""
    R = 6371.0 # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def _mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone or len(phone) < 4:
        return None
    return f"***-***-{phone[-4:]}"


class SearchService:
    @staticmethod
    def search_cases(
        query_name: Optional[str] = None,
        age_min: Optional[int] = None,
        age_max: Optional[int] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        case_type: Optional[CaseType] = None,
        gender: Optional[GenderType] = None,
        user: Optional[AuthUser] = None
    ) -> List[PublicCaseSearchItem]:
        results: List[PublicCaseSearchItem] = []
        is_privileged = user and user.role in (UserRole.AUTHORITY, UserRole.ADMIN)

        for cid, c in db.cases.items():
            # Exclude closed cases from public discovery
            if not is_privileged and c["status"] == CaseStatus.CLOSED.value:
                continue

            # Case type filter
            if case_type and c["type"] != case_type.value:
                continue

            person = next((p for p in db.persons.values() if p["case_id"] == cid), None)
            if not person:
                continue

            # Name search
            if query_name:
                q = query_name.lower().strip()
                name_match = q in person["full_name"].lower()
                desc_match = bool(person.get("description") and q in person["description"].lower())
                if not (name_match or desc_match):
                    continue

            # Gender filter
            if gender and person.get("gender") != gender.value:
                continue

            # Age filter
            person_age = person.get("approximate_age")
            if age_min is not None and (person_age is None or person_age < age_min):
                continue
            if age_max is not None and (person_age is None or person_age > age_max):
                continue

            # Distance filter (Haversine)
            if lat is not None and lng is not None and radius_km is not None:
                p_lat = person.get("last_seen_lat")
                p_lng = person.get("last_seen_lng")
                if p_lat is None or p_lng is None:
                    continue
                dist = _haversine_distance_km(lat, lng, p_lat, p_lng)
                if dist > radius_km:
                    continue

            # Primary photo
            primary_photo = next(
                (ph for ph in db.photos.values() if ph["case_id"] == cid and ph.get("is_primary")),
                None
            )
            photo_url = primary_photo["storage_path"] if primary_photo else None

            # Minor privacy handling
            is_minor = c.get("is_minor", False)
            if is_minor:
                masked_phone = "[REDACTED - MINOR PROTECTION]"
                safe_name = "[REDACTED - CONTACT RELIEF AUTHORITY]"
            else:
                masked_phone = _mask_phone(person.get("contact_phone"))
                safe_name = person.get("contact_person_name")

            safe_person = PersonPublicSafeResponse(
                id=person["id"],
                case_id=cid,
                full_name=person["full_name"],
                approximate_age=person_age,
                gender=GenderType(person["gender"]),
                description=person.get("description"),
                clothing_details=person.get("clothing_details"),
                physical_marks=person.get("physical_marks"),
                last_seen_address=person.get("last_seen_address"),
                last_seen_lat=person.get("last_seen_lat"),
                last_seen_lng=person.get("last_seen_lng"),
                is_vulnerable=person.get("is_vulnerable", False),
                is_minor=is_minor,
                masked_contact_phone=masked_phone,
                safe_contact_name=safe_name,
            )

            results.append(
                PublicCaseSearchItem(
                    case_id=cid,
                    case_number=c["case_number"],
                    case_type=CaseType(c["type"]),
                    case_status=CaseStatus(c["status"]),
                    person=safe_person,
                    primary_photo_url=photo_url,
                    created_at=datetime.fromisoformat(c["created_at"].replace("Z", "+00:00")),
                )
            )

        return results

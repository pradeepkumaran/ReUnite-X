"""
REUNITE-X Case Schemas
Schemas for creating, updating, retrieving, and searching missing/found disaster cases.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from app.models.enums import CaseType, CaseStatus
from app.schemas.person import PersonCreate, PersonResponse, PersonPublicSafeResponse


class PhotoResponse(BaseModel):
    id: str
    case_id: str
    person_id: Optional[str] = None
    storage_path: str
    file_name: str
    signed_url: Optional[str] = None
    is_primary: bool = False
    face_detected: bool = False
    face_count: int = 0
    quality_score: Optional[float] = None
    processing_status: str = "queued"
    processing_error: Optional[str] = None
    created_at: Optional[datetime] = None


class CaseBase(BaseModel):
    type: CaseType = Field(..., description="'missing' or 'found'")
    disaster_id: Optional[str] = Field(None, description="Linked disaster UUID")
    client_case_uuid: Optional[str] = Field(None, description="Client-generated UUID for offline sync idempotency")
    consent_given: bool = Field(..., description="Consent for disaster reunification processing")

    @field_validator("consent_given")
    @classmethod
    def require_affirmative_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Affirmative consent is required to create a report.")
        return value


class CaseCreate(CaseBase):
    person: PersonCreate = Field(..., description="Details of the person being reported")


class CaseStatusUpdate(BaseModel):
    status: CaseStatus = Field(..., description="Target status transition")
    notes: Optional[str] = Field(None, max_length=1000, description="Reason or context for status transition")


class CaseSummaryResponse(BaseModel):
    id: str
    case_number: str
    client_case_uuid: Optional[str] = None
    disaster_id: Optional[str] = None
    reporter_id: Optional[str] = None
    type: CaseType
    status: CaseStatus
    priority_level: int
    is_minor: bool
    consent_given: bool
    synced_from_offline: bool
    person_name: str
    approximate_age: Optional[int] = None
    last_seen_address: Optional[str] = None
    last_seen_lat: Optional[float] = None
    last_seen_lng: Optional[float] = None
    primary_photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CaseDetailResponse(BaseModel):
    id: str
    case_number: str
    client_case_uuid: Optional[str] = None
    disaster_id: Optional[str] = None
    reporter_id: Optional[str] = None
    type: CaseType
    status: CaseStatus
    priority_level: int
    is_minor: bool
    consent_given: bool
    synced_from_offline: bool
    person: PersonResponse
    photos: List[PhotoResponse] = Field(default_factory=list)
    potential_duplicate_case_ids: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None


class PublicCaseSearchItem(BaseModel):
    case_id: str
    case_number: str
    case_type: CaseType
    case_status: CaseStatus
    person: PersonPublicSafeResponse
    primary_photo_url: Optional[str] = None
    created_at: datetime

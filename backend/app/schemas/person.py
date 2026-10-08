"""
REUNITE-X Person Schemas
Pydantic v2 schemas for missing and found individuals, with validation and PII protections.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from app.models.enums import GenderType


class PersonBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150, description="Name or nickname of person")
    approximate_age: Optional[int] = Field(None, ge=0, le=130, description="Approximate age in years")
    age_range_min: Optional[int] = Field(None, ge=0, le=130)
    age_range_max: Optional[int] = Field(None, ge=0, le=130)
    gender: GenderType = Field(default=GenderType.UNKNOWN)
    description: Optional[str] = Field(None, max_length=2000, description="Physical traits, hair, skin tone")
    clothing_details: Optional[str] = Field(None, max_length=1000, description="Clothing worn when last seen")
    physical_marks: Optional[str] = Field(None, max_length=500, description="Scars, tattoos, birthmarks")
    last_seen_lat: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Latitude coordinate")
    last_seen_lng: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Longitude coordinate")
    last_seen_address: Optional[str] = Field(None, max_length=500, description="Landmark or shelter camp name")
    last_seen_time: Optional[datetime] = None
    contact_person_name: Optional[str] = Field(None, max_length=150)
    contact_phone: Optional[str] = Field(None, max_length=50)
    contact_email: Optional[str] = Field(None, max_length=150)
    contact_relationship: Optional[str] = Field(None, max_length=100)
    medical_notes: Optional[str] = Field(None, max_length=1000, description="Allergies, conditions, insulin, etc.")
    is_vulnerable: bool = Field(default=False)
    vulnerability_reasons: List[str] = Field(default_factory=list)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Full name cannot be whitespace only.")
        return stripped


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    approximate_age: Optional[int] = Field(None, ge=0, le=130)
    gender: Optional[GenderType] = None
    description: Optional[str] = None
    clothing_details: Optional[str] = None
    physical_marks: Optional[str] = None
    last_seen_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    last_seen_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    last_seen_address: Optional[str] = None
    medical_notes: Optional[str] = None
    is_vulnerable: Optional[bool] = None


class PersonResponse(PersonBase):
    id: str
    case_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PersonPublicSafeResponse(BaseModel):
    """Sanitized representation for public search (protects minors & masks phone/email)."""
    id: str
    case_id: str
    full_name: str
    approximate_age: Optional[int] = None
    gender: GenderType
    description: Optional[str] = None
    clothing_details: Optional[str] = None
    physical_marks: Optional[str] = None
    last_seen_address: Optional[str] = None
    last_seen_lat: Optional[float] = None
    last_seen_lng: Optional[float] = None
    is_vulnerable: bool
    is_minor: bool
    masked_contact_phone: Optional[str] = None
    safe_contact_name: Optional[str] = None

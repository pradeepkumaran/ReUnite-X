"""
REUNITE-X Match Candidate & Verification Schemas
Schemas for candidate review queues, side-by-side inspection, and authority verification.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import MatchStatus, VerificationDecision
from app.schemas.case import CaseDetailResponse, CaseSummaryResponse


class ScoreExplanation(BaseModel):
    face_similarity_pct: float
    age_gender_match: str
    distance_km: Optional[float] = None
    description_keywords_overlap: List[str] = Field(default_factory=list)
    vulnerability_boost: Optional[str] = None


class MatchCandidateResponse(BaseModel):
    id: str
    missing_case_id: str
    found_case_id: str
    missing_case: Optional[CaseSummaryResponse] = None
    found_case: Optional[CaseSummaryResponse] = None
    face_similarity: float = Field(..., ge=0.0, le=1.0)
    age_gender_score: float = Field(..., ge=0.0, le=1.0)
    location_score: float = Field(..., ge=0.0, le=1.0)
    text_score: float = Field(..., ge=0.0, le=1.0)
    match_score: float = Field(..., ge=0.0, le=100.0)
    priority_score: float = Field(..., ge=0.0, le=100.0)
    score_explanation: Dict[str, Any] = Field(default_factory=dict)
    status: MatchStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class MatchVerificationRequest(BaseModel):
    notes: str = Field(..., min_length=5, max_length=1500, description="Official notes detailing justification")
    verified_location_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    verified_location_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    verified_location_name: Optional[str] = Field(None, max_length=250)
    notify_family: bool = Field(default=True, description="Immediately trigger FCM push and email notifications")


class MatchRejectionRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000, description="Reason for rejection")


class VerificationResponse(BaseModel):
    id: str
    match_id: str
    missing_case_id: str
    found_case_id: str
    authority_id: str
    decision: VerificationDecision
    notes: Optional[str] = None
    verified_location_lat: Optional[float] = None
    verified_location_lng: Optional[float] = None
    verified_location_name: Optional[str] = None
    family_notified: bool
    verified_at: datetime

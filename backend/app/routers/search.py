"""
REUNITE-X Search Router
Provides public and authorized search filtering across demographics and geospatial radius.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.core.security import get_optional_user, AuthUser
from app.models.enums import CaseType, GenderType
from app.schemas.case import PublicCaseSearchItem
from app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.get(
    "",
    response_model=List[PublicCaseSearchItem],
    summary="Multi-Criteria Case & Person Search"
)
async def search_cases(
    q: Optional[str] = Query(None, description="Search query matching full name, nickname, or description"),
    case_type: Optional[CaseType] = Query(None, description="Filter by 'missing' or 'found'"),
    gender: Optional[GenderType] = Query(None, description="Filter by gender"),
    age_min: Optional[int] = Query(None, ge=0, le=130, description="Minimum age threshold"),
    age_max: Optional[int] = Query(None, ge=0, le=130, description="Maximum age threshold"),
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Search center latitude"),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Search center longitude"),
    radius_km: Optional[float] = Query(None, gt=0, le=500, description="Search radius in kilometers"),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Searches disaster database with automatic PII redaction and child protection shielding.
    Supports radius queries using the Haversine formula.
    """
    return SearchService.search_cases(
        query_name=q,
        age_min=age_min,
        age_max=age_max,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        case_type=case_type,
        gender=gender,
        user=user,
    )

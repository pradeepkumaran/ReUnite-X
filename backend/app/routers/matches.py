"""
REUNITE-X Match Candidates Router
Human-in-the-Loop review queue and verification endpoints restricted strictly to disaster authorities.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.core.security import require_role, AuthUser
from app.models.enums import UserRole, MatchStatus
from app.schemas.match import (
    MatchCandidateResponse,
    MatchVerificationRequest,
    MatchRejectionRequest,
    VerificationResponse,
)
from app.services.match_service import MatchService

router = APIRouter(prefix="/matches", tags=["Matches & Verifications"])

# Guard all routes in this router to Authority and Admin roles only
authority_guard = require_role(UserRole.AUTHORITY, UserRole.ADMIN)


@router.get(
    "",
    response_model=List[MatchCandidateResponse],
    summary="List Candidate Matches (Authority Only)"
)
async def list_matches(
    status: Optional[MatchStatus] = Query(
        MatchStatus.PENDING_REVIEW,
        description="Filter by candidate match status",
    ),
    limit: int = Query(50, ge=1, le=100),
    authority: AuthUser = Depends(authority_guard),
):
    """
    Returns candidate matches ranked by priority score and multimodal match confidence.
    Strictly protected: unverified candidate matches are never exposed to the public.
    """
    return MatchService.get_matches(status_filter=status, limit=limit, authority=authority)


@router.post(
    "/{id}/verify",
    response_model=VerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Candidate Match (Authority Only)"
)
async def verify_match(
    id: str,
    payload: MatchVerificationRequest,
    authority: AuthUser = Depends(authority_guard),
):
    """
    Confirms an AI candidate match after human side-by-side inspection.
    Updates case statuses to 'verified', updates confirmed location, logs immutable audit entry,
    and dispatches secure notifications to the families.
    """
    return MatchService.verify_match(
        match_id=id,
        request=payload,
        authority=authority,
    )


@router.post(
    "/{id}/reject",
    status_code=status.HTTP_200_OK,
    summary="Reject Candidate Match (Authority Only)"
)
async def reject_match(
    id: str,
    payload: MatchRejectionRequest,
    authority: AuthUser = Depends(authority_guard),
):
    """
    Rejects a false positive match candidate.
    Reverts cases to 'searching' to continue ongoing search matching.
    """
    return MatchService.reject_match(
        match_id=id,
        request=payload,
        authority=authority,
    )

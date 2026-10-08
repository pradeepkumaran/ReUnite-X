"""
REUNITE-X Cases Router
Core endpoints for creating, retrieving, updating status, and uploading photos for missing & found cases.
"""
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    status,
    Query,
    Request,
)

from app.core.limiter import limiter
from app.core.security import get_current_user, get_optional_user, AuthUser
from app.models.enums import CaseType, CaseStatus
from app.schemas.case import (
    CaseCreate,
    CaseDetailResponse,
    CaseSummaryResponse,
    CaseStatusUpdate,
    PhotoResponse,
)
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post(
    "",
    response_model=CaseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Missing or Found Person Report"
)
@limiter.limit("40/minute")
async def create_case(
    request: Request,
    payload: CaseCreate,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Submits a missing person or found person report with full physical and demographic details.
    Available to the public, volunteers, and emergency authorities.
    """
    return CaseService.create_case(payload, user)


@router.get(
    "",
    response_model=List[CaseSummaryResponse],
    summary="List Missing & Found Cases"
)
async def list_cases(
    case_type: Optional[CaseType] = Query(None, description="Filter by 'missing' or 'found'"),
    case_status: Optional[CaseStatus] = Query(None, description="Filter by case status enum"),
    disaster_id: Optional[str] = Query(None, description="Filter by active disaster zone UUID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Lists missing and found cases with optional demographic and disaster filters.
    """
    return CaseService.get_cases(
        case_type=case_type,
        case_status=case_status,
        disaster_id=disaster_id,
        limit=limit,
        offset=offset,
        user=user,
    )


@router.get(
    "/{id}",
    response_model=CaseDetailResponse,
    summary="Get Case Dossier by ID"
)
async def get_case(
    id: str,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Retrieves full case details including person profile and attached photos.
    Applies minor privacy shielding if the requester is an anonymous or public user.
    """
    return CaseService.get_case_by_id(id, user)


@router.patch(
    "/{id}/status",
    response_model=CaseDetailResponse,
    summary="Update Case Status"
)
async def update_case_status(
    id: str,
    payload: CaseStatusUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """
    Updates the operational lifecycle status of a case.
    Requires emergency authority privileges to mark as verified, reunited, or closed.
    """
    return CaseService.update_status(
        case_id=id,
        target_status=payload.status,
        user=user,
        notes=payload.notes,
    )


@router.post(
    "/{id}/photos",
    response_model=PhotoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Photo to Case"
)
@limiter.limit("20/minute")
async def upload_case_photo(
    request: Request,
    id: str,
    file: UploadFile = File(..., description="JPEG/PNG image file"),
    is_primary: bool = Form(True, description="Mark as primary display photo for case"),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Uploads a photo for a missing or found individual.
    Validates file MIME type and size (< 10MB) before securely registering in storage.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{file.content_type}'. Must be JPEG, PNG, or WebP.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed limit of 10MB.",
        )

    return CaseService.add_photo(
        case_id=id,
        file_name=file.filename or "uploaded_photo.jpg",
        mime_type=file.content_type,
        file_size=len(file_bytes),
        is_primary=is_primary,
    )

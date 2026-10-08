"""
REUNITE-X Offline Batch Synchronization Router
Ingests reports collected offline, ensuring idempotency and conflict resolution.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Request, status

from app.core.limiter import limiter
from app.core.security import get_optional_user, AuthUser
from app.schemas.sync import BatchSyncRequest, BatchSyncResponse
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["Offline Sync"])


@router.post(
    "/batch",
    response_model=BatchSyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch Synchronize Offline Reports"
)
@limiter.limit("30/minute")
async def sync_batch(
    request: Request,
    payload: BatchSyncRequest,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Ingests an array of offline reports created during network outages.
    - Idempotent: Client UUID prevents duplicate records on network retry.
    - Conflict Resolution: Implements last-write-wins policy with detailed conflict logging.
    - Media Ingestion: Supports attached photo binary payloads.
    """
    return SyncService.process_batch(payload, user)

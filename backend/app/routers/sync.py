"""
REUNITE-X Offline Batch Synchronization Router
Ingests reports collected offline, ensuring idempotency and conflict resolution.
"""
from typing import Optional
import base64
import binascii
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.core.limiter import limiter
from app.core.security import get_optional_user, AuthUser
from app.schemas.sync import BatchSyncRequest, BatchSyncResponse
from app.services.sync_service import SyncService
from app.core.database import db
from app.ai.pipeline import process_uploaded_photo, run_candidate_matching

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
    background_tasks: BackgroundTasks,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """
    Ingests an array of offline reports created during network outages.
    - Idempotent: Client UUID prevents duplicate records on network retry.
    - Conflict Resolution: Implements last-write-wins policy with detailed conflict logging.
    - Media Ingestion: Supports attached photo binary payloads.
    """
    decoded_photos = {}
    for queued_case in payload.cases:
        for queued_photo in queued_case.photos:
            if not queued_photo.base64_data:
                continue
            try:
                image_bytes = base64.b64decode(
                    queued_photo.base64_data.split(",", 1)[-1], validate=True
                )
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(status_code=400, detail="Offline photo payload is not valid base64.") from exc
            if len(image_bytes) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Offline photo exceeds the 10MB limit.")
            signature_matches = (
                image_bytes.startswith(b"\xff\xd8\xff")
                if queued_photo.mime_type == "image/jpeg"
                else image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
                if queued_photo.mime_type == "image/png"
                else (
                    len(image_bytes) >= 12
                    and image_bytes[:4] == b"RIFF"
                    and image_bytes[8:12] == b"WEBP"
                )
            )
            if not signature_matches:
                raise HTTPException(
                    status_code=400,
                    detail="Offline photo content does not match its declared image type.",
                )
            decoded_photos[queued_photo.client_photo_id] = image_bytes

    response = SyncService.process_batch(payload, user, decoded_photos)
    cases_by_uuid = {case.client_case_uuid: case for case in payload.cases}
    for result in response.results:
        if not result.server_case_id:
            continue
        queued_case = cases_by_uuid[result.client_case_uuid]
        for queued_photo in queued_case.photos:
            if not queued_photo.base64_data:
                continue
            image_bytes = decoded_photos[queued_photo.client_photo_id]
            photo = next(
                (stored for stored in db.photos.values()
                 if stored.get("client_photo_id") == queued_photo.client_photo_id),
                None,
            )
            if photo:
                background_tasks.add_task(
                    process_uploaded_photo, photo["id"], result.server_case_id, image_bytes
                )
        background_tasks.add_task(run_candidate_matching, result.server_case_id)
    return response

"""
REUNITE-X Offline Batch Synchronization Schemas
Supports idempotent offline intake, Dexie.js sync queues, and conflict logs.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import CaseType
from app.schemas.person import PersonCreate


class OfflinePhotoPayload(BaseModel):
    client_photo_id: str
    file_name: str
    mime_type: str = "image/jpeg"
    base64_data: Optional[str] = None
    is_primary: bool = True


class OfflineCasePayload(BaseModel):
    client_case_uuid: str = Field(..., description="Client-generated v4 UUID")
    client_timestamp: datetime = Field(..., description="Timestamp when report was recorded locally")
    type: CaseType
    disaster_id: Optional[str] = None
    consent_given: bool = True
    person: PersonCreate
    photos: List[OfflinePhotoPayload] = Field(default_factory=list)


class BatchSyncRequest(BaseModel):
    cases: List[OfflineCasePayload] = Field(..., description="Array of offline queued case records")
    device_id: Optional[str] = None
    app_version: Optional[str] = None


class SyncStatusItem(BaseModel):
    client_case_uuid: str
    server_case_id: Optional[str] = None
    case_number: Optional[str] = None
    status: str = Field(..., description="'synced', 'conflict_resolved', 'failed'")
    resolution_applied: Optional[str] = None
    error: Optional[str] = None


class BatchSyncResponse(BaseModel):
    total_processed: int
    synced_count: int
    conflict_count: int
    failed_count: int
    results: List[SyncStatusItem]

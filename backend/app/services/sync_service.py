"""
REUNITE-X Offline Batch Synchronization Service
Handles bulk offline uploads, client UUID idempotency, and last-write-wins conflict resolution.
"""
import uuid
from typing import Optional, List
from datetime import datetime, timezone

from app.core.database import db
from app.core.logging import logger
from app.core.security import AuthUser
from app.models.enums import CaseStatus
from app.schemas.case import CaseCreate
from app.schemas.sync import (
    BatchSyncRequest,
    BatchSyncResponse,
    SyncStatusItem,
)
from app.services.case_service import CaseService


class SyncService:
    @staticmethod
    def process_batch(
        request: BatchSyncRequest,
        reporter: Optional[AuthUser] = None,
        decoded_photos: Optional[dict] = None,
    ) -> BatchSyncResponse:
        results: List[SyncStatusItem] = []
        synced_count = 0
        conflict_count = 0
        failed_count = 0
        reporter_id = reporter.id if reporter else None
        now_iso = datetime.now(timezone.utc).isoformat()

        for item in request.cases:
            client_uuid = item.client_case_uuid
            try:
                # 1. Check if client_case_uuid already exists in database
                existing_case = None
                for c in db.cases.values():
                    if c.get("client_case_uuid") == client_uuid:
                        existing_case = c
                        break

                if existing_case:
                    # Conflict / Duplicate check: Last-write-wins strategy
                    server_updated_at = datetime.fromisoformat(
                        existing_case["updated_at"].replace("Z", "+00:00")
                    )
                    client_time = item.client_timestamp
                    if client_time.tzinfo is None:
                        client_time = client_time.replace(tzinfo=timezone.utc)

                    if client_time > server_updated_at:
                        # Client record is newer: update person details
                        person = next(
                            (p for p in db.persons.values() if p["case_id"] == existing_case["id"]),
                            None
                        )
                        if person:
                            person["full_name"] = item.person.full_name
                            person["approximate_age"] = item.person.approximate_age
                            person["description"] = item.person.description
                            person["clothing_details"] = item.person.clothing_details
                            person["last_seen_address"] = item.person.last_seen_address
                            person["updated_at"] = now_iso

                        existing_case["updated_at"] = now_iso
                        resolution = "last_write_wins_client_accepted"
                    else:
                        resolution = "last_write_wins_server_retained"

                    conflict_count += 1
                    for photo_item in item.photos:
                        photo_bytes = (decoded_photos or {}).get(photo_item.client_photo_id)
                        CaseService.add_photo(
                            case_id=existing_case["id"],
                            file_name=photo_item.file_name,
                            mime_type=photo_item.mime_type,
                            file_size=len(photo_bytes or b""),
                            is_primary=photo_item.is_primary,
                            client_photo_id=photo_item.client_photo_id,
                            photo_bytes=photo_bytes,
                            can_view_private=bool(
                                reporter and reporter.role.value in ("authority", "admin", "volunteer")
                            ),
                            actor_id=reporter_id,
                        )

                    # Log sync conflict event
                    log_id = str(uuid.uuid4())
                    db.sync_logs[log_id] = {
                        "id": log_id,
                        "client_case_uuid": client_uuid,
                        "reporter_id": reporter_id,
                        "operation": "batch_sync_conflict",
                        "entity_type": "case",
                        "client_timestamp": item.client_timestamp.isoformat(),
                        "server_timestamp": now_iso,
                        "conflict_detected": True,
                        "resolution_applied": resolution
                    }

                    results.append(
                        SyncStatusItem(
                            client_case_uuid=client_uuid,
                            server_case_id=existing_case["id"],
                            case_number=existing_case["case_number"],
                            status="conflict_resolved",
                            resolution_applied=resolution
                        )
                    )
                    continue

                # 2. Case does not exist: create brand new case
                create_payload = CaseCreate(
                    type=item.type,
                    disaster_id=item.disaster_id,
                    client_case_uuid=client_uuid,
                    consent_given=item.consent_given,
                    person=item.person
                )

                created_case = CaseService.create_case(create_payload, reporter)
                
                # Flag as synced from offline
                db_record = db.cases.get(created_case.id)
                if db_record:
                    db_record["synced_from_offline"] = True

                # Process attached offline photos
                for photo_item in item.photos:
                    photo_bytes = (decoded_photos or {}).get(photo_item.client_photo_id)
                    CaseService.add_photo(
                        case_id=created_case.id,
                        file_name=photo_item.file_name,
                        mime_type=photo_item.mime_type,
                        file_size=len(photo_bytes or b""),
                        is_primary=photo_item.is_primary,
                        client_photo_id=photo_item.client_photo_id,
                        photo_bytes=photo_bytes,
                        can_view_private=bool(
                            reporter and reporter.role.value in ("authority", "admin", "volunteer")
                        ),
                        actor_id=reporter_id,
                    )

                synced_count += 1

                # Log successful sync
                log_id = str(uuid.uuid4())
                db.sync_logs[log_id] = {
                    "id": log_id,
                    "client_case_uuid": client_uuid,
                    "reporter_id": reporter_id,
                    "operation": "batch_sync_create",
                    "entity_type": "case",
                    "client_timestamp": item.client_timestamp.isoformat(),
                    "server_timestamp": now_iso,
                    "conflict_detected": False,
                    "resolution_applied": "created_new"
                }

                results.append(
                    SyncStatusItem(
                        client_case_uuid=client_uuid,
                        server_case_id=created_case.id,
                        case_number=created_case.case_number,
                        status="synced",
                        resolution_applied="created_new"
                    )
                )

            except Exception as e:
                logger.error(f"Error syncing client case {client_uuid}: {str(e)}")
                failed_count += 1
                results.append(
                    SyncStatusItem(
                        client_case_uuid=client_uuid,
                        status="failed",
                        error=str(e)
                    )
                )

        logger.info(
            f"Processed batch sync: {len(request.cases)} total | "
            f"{synced_count} synced | {conflict_count} conflicts | {failed_count} failed"
        )

        return BatchSyncResponse(
            total_processed=len(request.cases),
            synced_count=synced_count,
            conflict_count=conflict_count,
            failed_count=failed_count,
            results=results
        )

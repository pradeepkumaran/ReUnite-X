"""
REUNITE-X Notification Service
Dispatches high-priority alerts via Firebase Cloud Messaging and transactional email fallback.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.database import db
from app.core.logging import logger
from app.models.enums import NotificationChannel, NotificationStatus
from app.schemas.notification import NotificationSendRequest, NotificationResponse


class NotificationService:
    @staticmethod
    def send(request: NotificationSendRequest) -> NotificationResponse:
        now_iso = datetime.now(timezone.utc).isoformat()
        notif_id = str(uuid.uuid4())

        # In production: invokes firebase_admin.messaging or Resend API client
        # In current stage / local: records dispatched notification
        logger.info(
            f"Dispatching [{request.channel.value.upper()}] notification: '{request.title}' "
            f"to target: '{request.recipient_target}'"
        )

        record = {
            "id": notif_id,
            "case_id": request.case_id,
            "match_id": request.match_id,
            "recipient_target": request.recipient_target,
            "channel": request.channel.value,
            "title": request.title,
            "message": request.message,
            "payload": request.payload,
            "status": NotificationStatus.SENT.value,
            "sent_at": now_iso,
            "created_at": now_iso
        }
        db.notifications[notif_id] = record

        return NotificationResponse(
            id=notif_id,
            case_id=request.case_id,
            match_id=request.match_id,
            recipient_target=request.recipient_target,
            channel=request.channel,
            title=request.title,
            message=request.message,
            status=NotificationStatus.SENT,
            sent_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00")),
            created_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00")),
        )

"""
REUNITE-X Notification Service
Dispatches high-priority alerts via Firebase Cloud Messaging and transactional email fallback.
"""
import uuid
import smtplib
import json
from email.message import EmailMessage
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from app.core.config import settings
from app.core.database import db
from app.core.logging import logger
from app.models.enums import NotificationChannel, NotificationStatus
from app.schemas.notification import NotificationSendRequest, NotificationResponse


class NotificationService:
    @staticmethod
    def _send_email(target: str, title: str, message: str) -> bool:
        if settings.RESEND_API_KEY:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.NOTIFICATION_FROM_EMAIL,
                    "to": [target],
                    "subject": title,
                    "text": message,
                },
                timeout=10,
            )
            response.raise_for_status()
            return True
        if settings.SMTP_HOST:
            email = EmailMessage()
            email["From"] = settings.NOTIFICATION_FROM_EMAIL
            email["To"] = target
            email["Subject"] = title
            email.set_content(message)
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
                server.send_message(email)
            return True
        return False

    @staticmethod
    def _send_push(target: str, title: str, message: str, payload: dict) -> bool:
        if not settings.FIREBASE_CREDENTIALS_PATH and not settings.FIREBASE_CREDENTIALS_JSON:
            return False
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
        except ImportError as exc:
            raise RuntimeError("FCM delivery requires firebase-admin to be installed.") from exc
        app_name = "reunite-x"
        try:
            firebase_app = firebase_admin.get_app(app_name)
        except ValueError:
            credentials_source = (
                json.loads(settings.FIREBASE_CREDENTIALS_JSON)
                if settings.FIREBASE_CREDENTIALS_JSON
                else str(Path(settings.FIREBASE_CREDENTIALS_PATH))
            )
            firebase_app = firebase_admin.initialize_app(
                credentials.Certificate(credentials_source),
                name=app_name,
            )
        messaging.send(
            messaging.Message(
                notification=messaging.Notification(title=title, body=message),
                data={key: str(value) for key, value in payload.items()},
                token=target,
            ),
            app=firebase_app,
        )
        return True

    @staticmethod
    def send(
        request: NotificationSendRequest,
        actor_id: Optional[str] = None,
    ) -> NotificationResponse:
        now_iso = datetime.now(timezone.utc).isoformat()
        notif_id = str(uuid.uuid4())

        try:
            delivered = (
                NotificationService._send_email(
                    request.recipient_target, request.title, request.message
                )
                if request.channel == NotificationChannel.EMAIL
                else NotificationService._send_push(
                    request.recipient_target, request.title, request.message, request.payload
                )
            )
            delivery_status = NotificationStatus.SENT if delivered else NotificationStatus.PENDING
        except Exception as exc:
            logger.exception("Notification delivery failed for %s.", notif_id)
            delivery_status = NotificationStatus.FAILED
            delivery_error = str(exc)
        else:
            delivery_error = None

        record = {
            "id": notif_id,
            "case_id": request.case_id,
            "match_id": request.match_id,
            "recipient_target": request.recipient_target,
            "channel": request.channel.value,
            "title": request.title,
            "message": request.message,
            "payload": request.payload,
            "status": delivery_status.value,
            "delivery_error": delivery_error,
            "sent_at": now_iso if delivered else None,
            "created_at": now_iso
        }
        db.notifications[notif_id] = record
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "action": "NOTIFICATION_DISPATCHED",
            "resource_type": "notifications",
            "resource_id": notif_id,
            "changes": {
                "channel": request.channel.value,
                "status": delivery_status.value,
                "case_id": request.case_id,
                "match_id": request.match_id,
            },
            "created_at": now_iso,
        })
        logger.info(
            "Notification %s status=%s channel=%s",
            notif_id, delivery_status.value, request.channel.value,
        )

        return NotificationResponse(
            id=notif_id,
            case_id=request.case_id,
            match_id=request.match_id,
            recipient_target=request.recipient_target,
            channel=request.channel,
            title=request.title,
            message=request.message,
            status=delivery_status,
            delivery_error=delivery_error,
            sent_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00")) if delivered else None,
            created_at=datetime.fromisoformat(now_iso.replace("Z", "+00:00")),
        )

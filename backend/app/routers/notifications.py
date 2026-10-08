"""
REUNITE-X Notifications Router
Enables dispatching emergency alerts via Firebase Push Notification and Email.
"""
from fastapi import APIRouter, Depends, status

from app.core.security import require_role, AuthUser
from app.models.enums import UserRole
from app.schemas.notification import NotificationSendRequest, NotificationResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "/send",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dispatch Emergency Alert Notification"
)
async def send_notification(
    payload: NotificationSendRequest,
    user: AuthUser = Depends(require_role(UserRole.AUTHORITY, UserRole.ADMIN, UserRole.VOLUNTEER)),
):
    """
    Triggers an emergency alert across Firebase Push Messaging or Email fallback.
    """
    return NotificationService.send(payload)

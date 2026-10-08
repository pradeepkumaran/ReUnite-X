"""
REUNITE-X Notifications Router
Enables dispatching emergency alerts via Firebase Push Notification and Email.
"""
from fastapi import APIRouter, Depends, Request, status

from app.core.limiter import limiter
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
@limiter.limit("20/minute")
async def send_notification(
    request: Request,
    payload: NotificationSendRequest,
    user: AuthUser = Depends(require_role(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    """
    Triggers an emergency alert across Firebase Push Messaging or Email fallback.
    """
    return NotificationService.send(payload, actor_id=user.id)

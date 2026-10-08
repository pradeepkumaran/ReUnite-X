"""
REUNITE-X Notification Schemas
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import NotificationChannel, NotificationStatus


class NotificationSendRequest(BaseModel):
    case_id: Optional[str] = None
    match_id: Optional[str] = None
    recipient_target: str = Field(..., description="FCM device token or recipient email address")
    channel: NotificationChannel = Field(default=NotificationChannel.EMAIL)
    title: str = Field(..., min_length=2, max_length=150)
    message: str = Field(..., min_length=5, max_length=1500)
    payload: Dict[str, Any] = Field(default_factory=dict)


class NotificationResponse(BaseModel):
    id: str
    case_id: Optional[str] = None
    match_id: Optional[str] = None
    recipient_target: str
    channel: NotificationChannel
    title: str
    message: str
    status: NotificationStatus
    sent_at: Optional[datetime] = None
    created_at: datetime

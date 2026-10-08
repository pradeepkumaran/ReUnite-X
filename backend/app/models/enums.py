"""
REUNITE-X Domain Enums
Matches PostgreSQL ENUM types defined in Supabase migrations.
"""
from enum import Enum


class UserRole(str, Enum):
    PUBLIC = "public"
    FAMILY = "family"
    VOLUNTEER = "volunteer"
    RESCUE_TEAM = "rescue_team"
    HOSPITAL = "hospital"
    SHELTER = "shelter"
    HOSPITAL_SHELTER = "hospital_shelter"
    AUTHORITY = "authority"
    ADMIN = "admin"


class CaseType(str, Enum):
    MISSING = "missing"
    FOUND = "found"


class CaseStatus(str, Enum):
    REPORTED = "reported"
    SEARCHING = "searching"
    CANDIDATE_FOUND = "candidate_found"
    VERIFIED = "verified"
    NOTIFIED = "notified"
    REUNITED = "reunited"
    CLOSED = "closed"


class GenderType(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNKNOWN = "unknown"


class DisasterStatus(str, Enum):
    ACTIVE = "active"
    CONTAINED = "contained"
    RESOLVED = "resolved"


class MatchStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    VERIFIED = "verified"
    REJECTED = "rejected"


class VerificationDecision(str, Enum):
    VERIFIED = "verified"
    REJECTED = "rejected"


class NotificationChannel(str, Enum):
    FCM = "fcm"
    EMAIL = "email"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

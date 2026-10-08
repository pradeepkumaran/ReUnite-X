"""
REUNITE-X Backend Configuration
Pydantic-based typed settings with environment variable auto-discovery.
"""
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "REUNITE-X Disaster Response API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Supabase Configuration
    SUPABASE_URL: str = Field(default="https://mock-supabase.supabase.co")
    SUPABASE_KEY: str = Field(default="mock-anon-key")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = Field(default=None)
    SUPABASE_JWT_SECRET: str = Field(default="dev-insecure-jwt-secret-replace-in-prod-32chars")
    DATABASE_URL: Optional[str] = Field(default=None)
    SUPABASE_PHOTO_BUCKET: str = "case-photos"
    PHOTO_SIGNED_URL_TTL_SECONDS: int = 900

    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://reunite-x.vercel.app",
    ]

    # AI Model Parameters
    AI_MODEL_NAME: str = "facenet-512"
    FACE_MATCH_THRESHOLD: float = 0.65
    DUPLICATE_CHECK_THRESHOLD: float = 0.90
    WEIGHT_FACE: float = 0.60
    WEIGHT_AGE_GENDER: float = 0.15
    WEIGHT_LOCATION: float = 0.15
    WEIGHT_DESCRIPTION: float = 0.10
    INSIGHTFACE_MODEL_NAME: str = "buffalo_l"
    MIN_FACE_SIZE_PX: int = 80
    MIN_FACE_SHARPNESS: float = 35.0
    MAX_MATCH_DISTANCE_KM: float = 500.0
    MAX_MATCH_AGE_DAYS: int = 60

    # Rate Limiting
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_SYNC: str = "30/minute"
    RATE_LIMIT_PHOTOS: str = "20/minute"

    # Notifications & Alerts
    RESEND_API_KEY: Optional[str] = None
    NOTIFICATION_FROM_EMAIL: str = "alerts@reunite-x.org"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_CREDENTIALS_JSON: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

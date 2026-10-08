"""
REUNITE-X Authentication & Security Guard
Validates Supabase Auth JWT tokens and enforces Role-Based Access Control (RBAC).
"""
from typing import List, Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import PyJWTError

from app.core.config import settings
from app.core.logging import logger
from app.models.enums import UserRole

security_scheme = HTTPBearer(auto_error=False)


class AuthUser:
    """Represents an authenticated user context extracted from verified JWT."""
    def __init__(
        self,
        id: str,
        email: Optional[str] = None,
        role: UserRole = UserRole.PUBLIC,
        full_name: Optional[str] = None,
        is_anonymous: bool = False
    ):
        self.id = id
        self.email = email
        self.role = role
        self.full_name = full_name
        self.is_anonymous = is_anonymous

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role.value if isinstance(self.role, UserRole) else str(self.role),
            "full_name": self.full_name,
            "is_anonymous": self.is_anonymous
        }


def decode_supabase_jwt(token: str) -> Dict[str, Any]:
    """Decodes and verifies a Supabase JWT token using SUPABASE_JWT_SECRET."""
    try:
        # In Supabase, the HS256 secret is used to sign access tokens
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase aud is typically "authenticated"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except PyJWTError as e:
        logger.warning(f"JWT verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> AuthUser:
    """
    FastAPI dependency to extract and verify authenticated user.
    Permits simulated authority/volunteer tokens in development mode for seamless local testing.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Test / Dev convenience bypass for mock testing
    if settings.DEBUG and token.startswith("mock-"):
        # Allows tokens like "mock-authority", "mock-volunteer", "mock-public", "mock-admin"
        mock_role_str = token.replace("mock-", "")
        role = UserRole.PUBLIC
        try:
            role = UserRole(mock_role_str)
        except ValueError:
            pass
        return AuthUser(
            id=f"mock-user-{mock_role_str}-id",
            email=f"{mock_role_str}@reunite-x.org",
            role=role,
            full_name=f"Mock {mock_role_str.capitalize()} Officer"
        )

    payload = decode_supabase_jwt(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject (sub) claim.",
        )

    # Extract user metadata or app metadata role
    app_metadata = payload.get("app_metadata", {})
    user_metadata = payload.get("user_metadata", {})
    role_str = app_metadata.get("role") or user_metadata.get("role") or "public"

    try:
        user_role = UserRole(role_str)
    except ValueError:
        user_role = UserRole.PUBLIC

    return AuthUser(
        id=user_id,
        email=payload.get("email"),
        role=user_role,
        full_name=user_metadata.get("full_name") or payload.get("email", "Citizen Reporter")
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[AuthUser]:
    """Allows anonymous public actions while capturing user ID if token is supplied."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(*allowed_roles: UserRole):
    """Factory dependency enforcing specific user roles."""
    async def role_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if current_user.role not in allowed_roles:
            logger.warning(
                f"Access denied for user {current_user.id} with role '{current_user.role}'. "
                f"Required roles: {[r.value for r in allowed_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {[r.value for r in allowed_roles]}."
            )
        return current_user
    return role_checker

"""
REUNITE-X Authentication Router
Provides profile verification and role discovery.
"""
from fastapi import APIRouter, Depends
from app.core.security import get_current_user, AuthUser

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me", summary="Get Current User Profile & Role")
async def get_me(current_user: AuthUser = Depends(get_current_user)):
    """Returns the authenticated profile, email, and assigned authority/volunteer role."""
    return current_user.to_dict()

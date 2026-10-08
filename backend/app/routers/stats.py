"""
REUNITE-X Dashboard Statistics Router
Provides aggregated disaster response metrics.
"""
from fastapi import APIRouter
from app.schemas.stats import DashboardStatsResponse
from app.services.stats_service import StatsService

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Get Operational Disaster Analytics"
)
async def get_dashboard_stats():
    """
    Returns live situational metrics: total missing/found cases, pending verifications,
    reunifications confirmed, vulnerable children identified, and active disaster zones.
    """
    return StatsService.get_stats()

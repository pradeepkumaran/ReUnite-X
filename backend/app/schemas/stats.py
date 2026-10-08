"""
REUNITE-X Dashboard Statistics Schemas
"""
from typing import Dict, List, Optional
from pydantic import BaseModel


class StatusBreakdown(BaseModel):
    reported: int = 0
    searching: int = 0
    candidate_found: int = 0
    verified: int = 0
    notified: int = 0
    reunited: int = 0
    closed: int = 0


class TypeBreakdown(BaseModel):
    missing: int = 0
    found: int = 0


class DashboardStatsResponse(BaseModel):
    total_cases: int
    missing_cases: int
    found_cases: int
    reunited_count: int
    pending_verifications_count: int
    active_disasters_count: int
    vulnerable_minors_count: int
    status_breakdown: StatusBreakdown
    type_breakdown: TypeBreakdown

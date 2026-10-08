"""
REUNITE-X Dashboard Statistics Service
Aggregates operational metrics across disasters, active cases, verification queues, and reunifications.
"""
from app.core.database import db
from app.models.enums import CaseType, CaseStatus
from app.schemas.stats import DashboardStatsResponse, StatusBreakdown, TypeBreakdown


class StatsService:
    @staticmethod
    def get_stats() -> DashboardStatsResponse:
        total = len(db.cases)
        missing_count = sum(1 for c in db.cases.values() if c["type"] == CaseType.MISSING.value)
        found_count = sum(1 for c in db.cases.values() if c["type"] == CaseType.FOUND.value)
        reunited = sum(1 for c in db.cases.values() if c["status"] == CaseStatus.REUNITED.value)
        pending_verifications = sum(1 for m in db.match_candidates.values() if m["status"] == "pending_review")
        active_disasters = sum(1 for d in db.disasters.values() if d.get("status") == "active")
        vulnerable_minors = sum(1 for c in db.cases.values() if c.get("is_minor"))

        status_breakdown = StatusBreakdown(
            reported=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.REPORTED.value),
            searching=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.SEARCHING.value),
            candidate_found=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.CANDIDATE_FOUND.value),
            verified=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.VERIFIED.value),
            notified=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.NOTIFIED.value),
            reunited=reunited,
            closed=sum(1 for c in db.cases.values() if c["status"] == CaseStatus.CLOSED.value),
        )

        type_breakdown = TypeBreakdown(
            missing=missing_count,
            found=found_count
        )

        return DashboardStatsResponse(
            total_cases=total,
            missing_cases=missing_count,
            found_cases=found_count,
            reunited_count=reunited,
            pending_verifications_count=pending_verifications,
            active_disasters_count=active_disasters,
            vulnerable_minors_count=vulnerable_minors,
            status_breakdown=status_breakdown,
            type_breakdown=type_breakdown
        )

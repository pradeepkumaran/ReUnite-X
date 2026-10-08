import pytest
import uuid

from app.ai.matching import cosine_similarity, haversine_km, score_pair
from app.ai.pipeline import run_candidate_matching
from app.core.database import db
from app.schemas.case import CaseCreate
from app.schemas.person import PersonCreate
from app.services.case_service import CaseService


def test_cosine_similarity_validates_dimensions_and_normalizes():
    assert cosine_similarity([1, 0], [1, 0]) == pytest.approx(1.0)
    assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)
    with pytest.raises(ValueError):
        cosine_similarity([1], [1, 0])


def test_haversine_returns_distance_and_handles_missing_coordinates():
    assert haversine_km(10.7656, 79.8424, 10.7656, 79.8424) == pytest.approx(0)
    assert haversine_km(None, None, 1, 1) is None


def test_multimodal_score_explains_components_and_priority():
    missing = {
        "approximate_age": 8,
        "gender": "male",
        "last_seen_lat": 10.0,
        "last_seen_lng": 79.0,
        "description": "yellow shirt blue shorts",
        "is_vulnerable": True,
    }
    found = {
        "approximate_age": 8,
        "gender": "male",
        "last_seen_lat": 10.01,
        "last_seen_lng": 79.01,
        "description": "yellow shirt blue shorts",
    }
    score, explanation, priority = score_pair(
        missing, found, 0.9,
        {"face": 0.6, "age_gender": 0.15, "location": 0.15, "description": 0.1},
    )
    assert 0 <= score <= 100
    assert explanation["face_similarity_pct"] == 90
    assert explanation["distance_km"] > 0
    assert explanation["description_keywords_overlap"]
    assert "Vulnerability" in explanation["vulnerability_boost"]
    assert priority > 35


def test_missing_face_signal_is_omitted_from_blended_score():
    score, explanation, _ = score_pair(
        {"approximate_age": 30, "gender": "female", "description": "red jacket"},
        {"approximate_age": 30, "gender": "female", "description": "red jacket"},
        None,
        {"face": 0.6, "age_gender": 0.15, "location": 0.15, "description": 0.1},
    )
    assert score == pytest.approx(81.25)
    assert explanation["face_signal_available"] is False


def test_candidate_generation_never_verifies_a_case_automatically():
    client_missing, client_found = str(uuid.uuid4()), str(uuid.uuid4())
    case_ids = []
    try:
        for client_uuid, case_type in (
            (client_missing, "missing"),
            (client_found, "found"),
        ):
            created = CaseService.create_case(CaseCreate(
                type=case_type,
                disaster_id="d0000000-0000-0000-0000-000000000001",
                client_case_uuid=client_uuid,
                consent_given=True,
                person=PersonCreate(
                    full_name="Synthetic match",
                    approximate_age=32,
                    gender="female",
                    description="wearing red jacket at central shelter",
                    clothing_details="red jacket",
                    last_seen_time="2026-10-08T08:00:00Z",
                ),
            ))
            case_ids.append(created.id)

        run_candidate_matching(case_ids[0])
        pair = next(
            candidate for candidate in db.match_candidates.values()
            if candidate["missing_case_id"] == case_ids[0]
            and candidate["found_case_id"] == case_ids[1]
        )
        assert pair["status"] == "pending_review"
        assert db.cases[case_ids[0]]["status"] == "candidate_found"
        assert db.cases[case_ids[1]]["status"] == "candidate_found"
        assert db.cases[case_ids[0]]["status"] != "verified"
    finally:
        for match_id, candidate in list(db.match_candidates.items()):
            if candidate["missing_case_id"] in case_ids or candidate["found_case_id"] in case_ids:
                db.match_candidates.pop(match_id)
        for case_id in case_ids:
            db.cases.pop(case_id, None)
            for person_id, person in list(db.persons.items()):
                if person["case_id"] == case_id:
                    db.persons.pop(person_id)

"""
REUNITE-X Backend Test Suite
Tests FastAPI application endpoints, role enforcement, validation, and responses.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_data():
    """Seed test fixtures for tests and clean up afterwards so live database stays clean."""
    disaster_id = "d0000000-0000-0000-0000-000000000001"
    if disaster_id not in db.disasters:
        db.disasters[disaster_id] = {
            "id": disaster_id,
            "name": "Cyclone Vardha Relief Zone",
            "disaster_type": "cyclone",
            "location_name": "Nagapattinam",
            "center_lat": 10.7656,
            "center_lng": 79.8424,
            "radius_km": 45.0,
            "status": "active",
            "created_at": "2026-10-08T08:00:00Z"
        }

    case_a_id = "c0000000-0000-0000-0000-000000000001"
    person_a_id = "p0000000-0000-0000-0000-000000000001"
    db.cases[case_a_id] = {
        "id": case_a_id,
        "client_case_uuid": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
        "disaster_id": disaster_id,
        "reporter_id": "11111111-1111-1111-1111-111111111111",
        "case_number": "REX-2026-00001",
        "type": "missing",
        "status": "candidate_found",
        "priority_level": 5,
        "is_minor": True,
        "consent_given": True,
        "synced_from_offline": False,
        "created_at": "2026-10-08T09:00:00Z",
        "updated_at": "2026-10-08T09:00:00Z"
    }
    db.persons[person_a_id] = {
        "id": person_a_id,
        "case_id": case_a_id,
        "full_name": "Aarav Sharma",
        "approximate_age": 8,
        "age_range_min": 7,
        "age_range_max": 9,
        "gender": "male",
        "description": "Fair complexion, curly dark hair, responds to nickname Appu.",
        "clothing_details": "Yellow cartoon t-shirt, blue denim shorts, white sneakers.",
        "physical_marks": "Small birthmark behind left ear.",
        "last_seen_lat": 10.7670,
        "last_seen_lng": 79.8410,
        "last_seen_address": "Old Bus Stand Relief Evacuation Point, Nagapattinam",
        "last_seen_time": "2026-10-08T06:00:00Z",
        "contact_person_name": "Ananya Sharma",
        "contact_phone": "+919876543210",
        "contact_email": "ananya@example.com",
        "contact_relationship": "Mother",
        "medical_notes": "Requires daily asthma inhaler medication",
        "is_vulnerable": True,
        "vulnerability_reasons": ["minor_under_12"],
        "created_at": "2026-10-08T09:00:00Z",
        "updated_at": "2026-10-08T09:00:00Z"
    }
    case_b_id = "c0000000-0000-0000-0000-000000000002"
    person_b_id = "p0000000-0000-0000-0000-000000000002"
    db.cases[case_b_id] = {
        "id": case_b_id,
        "client_case_uuid": "f9e8d7c6-b5a4-4f9e-8d7c-6b5a4f9e8d7c",
        "disaster_id": disaster_id,
        "reporter_id": "22222222-2222-2222-2222-222222222222",
        "case_number": "REX-2026-00002",
        "type": "found",
        "status": "candidate_found",
        "priority_level": 4,
        "is_minor": True,
        "consent_given": True,
        "synced_from_offline": True,
        "created_at": "2026-10-08T11:00:00Z",
        "updated_at": "2026-10-08T11:00:00Z"
    }
    db.persons[person_b_id] = {
        "id": person_b_id,
        "case_id": case_b_id,
        "full_name": "Unidentified Boy (says Appu)",
        "approximate_age": 8,
        "age_range_min": 7,
        "age_range_max": 9,
        "gender": "male",
        "description": "Young boy found alone near river embankment.",
        "clothing_details": "Mud-stained yellow t-shirt, blue shorts.",
        "physical_marks": "Small mark behind left ear.",
        "last_seen_lat": 10.7712,
        "last_seen_lng": 79.8450,
        "last_seen_address": "Camp Delta 3 Relief Shelter, Nagapattinam",
        "last_seen_time": "2026-10-08T10:30:00Z",
        "contact_person_name": "Rohan Kumar",
        "contact_phone": "+919876543211",
        "contact_email": "rohan@redcross.org",
        "contact_relationship": "Volunteer",
        "is_vulnerable": True,
        "vulnerability_reasons": ["unaccompanied_minor"],
        "created_at": "2026-10-08T11:00:00Z",
        "updated_at": "2026-10-08T11:00:00Z"
    }
    match_id = "m0000000-0000-0000-0000-000000000001"
    db.match_candidates[match_id] = {
        "id": match_id,
        "missing_case_id": case_a_id,
        "found_case_id": case_b_id,
        "missing_person_id": person_a_id,
        "found_person_id": person_b_id,
        "face_similarity": 0.92,
        "age_gender_score": 0.95,
        "location_score": 0.90,
        "text_score": 0.85,
        "match_score": 90.5,
        "priority_score": 96.0,
        "score_explanation": {"face_similarity_pct": 92.0},
        "status": "pending_review",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": "2026-10-08T11:10:00Z"
    }
    yield
    db.clear_all()


def test_health_check():
    """Verify health endpoint returns healthy status and version."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "reunite-x-backend"


def test_openapi_docs():
    """Verify OpenAPI Swagger schema and documentation are generated."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "REUNITE-X Disaster Response API"
    assert "/api/v1/cases" in schema["paths"]
    assert "/api/v1/search" in schema["paths"]
    assert "/api/v1/matches" in schema["paths"]
    assert "/api/v1/sync/batch" in schema["paths"]
    assert "/api/v1/dashboard/stats" in schema["paths"]


def test_dashboard_stats():
    """Verify situational dashboard stats endpoint."""
    response = client.get("/api/v1/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] >= 2
    assert "status_breakdown" in data
    assert "type_breakdown" in data


def test_list_cases():
    """Verify listing cases and summary structure."""
    response = client.get("/api/v1/cases")
    assert response.status_code == 200
    cases = response.json()
    assert isinstance(cases, list)
    assert len(cases) >= 2
    first_case = cases[0]
    assert "case_number" in first_case
    assert "type" in first_case
    assert "status" in first_case


def test_get_case_detail():
    """Verify detailed case retrieval including person details and photos."""
    case_id = "c0000000-0000-0000-0000-000000000001"
    response = client.get(f"/api/v1/cases/{case_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == case_id
    assert data["person"]["full_name"] == "Protected person"
    assert data["person"]["last_seen_lat"] is None
    assert data["is_minor"] is True
    # For unauthenticated or public caller, minor phone must be shielded
    assert data["person"]["contact_phone"] == "[REDACTED - MINOR PROTECTION]"


def test_create_case():
    """Verify creating a new missing person report with Pydantic validation."""
    payload = {
        "type": "missing",
        "consent_given": True,
        "person": {
            "full_name": "Kavita Devi",
            "approximate_age": 42,
            "gender": "female",
            "description": "Height approx 5ft 3in, brown eyes, long black hair.",
            "clothing_details": "Red silk saree with gold border.",
            "last_seen_address": "Kumbakonam Bridge Relief Camp",
            "last_seen_lat": 10.9602,
            "last_seen_lng": 79.3845,
            "contact_person_name": "Suresh Devi",
            "contact_phone": "+919876500001",
            "contact_relationship": "Husband",
            "is_vulnerable": False
        }
    }
    response = client.post("/api/v1/cases", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["person"]["full_name"] == "Kavita Devi"
    assert created["case_number"].startswith("REX-2026-")
    assert created["status"] == "reported"


def test_search_cases():
    """Verify search endpoint by name query and minor protection."""
    response = client.get("/api/v1/search?q=Aarav")
    assert response.status_code == 200
    results = response.json()
    assert len(results) >= 1
    found = results[0]
    assert found["person"]["full_name"] == "Protected person"
    assert found["person"]["is_minor"] is True
    assert found["person"]["masked_contact_phone"] == "[REDACTED - MINOR PROTECTION]"


def test_search_radius():
    """Verify spatial radius search using coordinates."""
    # Nagapattinam coords
    response = client.get("/api/v1/search?lat=10.7656&lng=79.8424&radius_km=10")
    assert response.status_code == 200
    results = response.json()
    assert len(results) >= 1


def test_matches_authorization_guard():
    """Verify /matches is protected and rejects anonymous or public requests."""
    # No auth header -> 401
    response = client.get("/api/v1/matches")
    assert response.status_code == 401

    # Public role -> 403 Forbidden
    response = client.get("/api/v1/matches", headers={"Authorization": "Bearer mock-public"})
    assert response.status_code == 403

    # Authority role -> 200 OK
    response = client.get("/api/v1/matches", headers={"Authorization": "Bearer mock-authority"})
    assert response.status_code == 200
    matches = response.json()
    assert len(matches) >= 1
    assert matches[0]["status"] == "pending_review"


def test_invalid_optional_jwt_is_rejected_instead_of_downgraded_to_anonymous():
    response = client.get(
        "/api/v1/cases",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_case_status_cannot_skip_human_verification():
    response = client.patch(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001/status",
        json={"status": "verified", "notes": "Attempted direct transition"},
        headers={"Authorization": "Bearer mock-authority"},
    )
    assert response.status_code == 409


def test_verify_match():
    """Verify authority can confirm a candidate match."""
    match_id = "m0000000-0000-0000-0000-000000000001"
    verify_payload = {
        "notes": "Verified visually against birthmark behind left ear and family photos by Officer Vikram.",
        "verified_location_lat": 10.7712,
        "verified_location_lng": 79.8450,
        "verified_location_name": "Camp Delta 3 Medical Ward",
        "notify_family": True
    }
    response = client.post(
        f"/api/v1/matches/{match_id}/verify",
        json=verify_payload,
        headers={"Authorization": "Bearer mock-authority"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "verified"
    # No provider is configured in the test environment: verification succeeds,
    # but the notification is truthfully recorded as pending rather than sent.
    assert data["family_notified"] is False

    # Check case status updated to verified
    case_resp = client.get("/api/v1/cases/c0000000-0000-0000-0000-000000000001")
    assert case_resp.json()["status"] == "verified"


def test_batch_sync_offline_cases():
    """Verify offline batch sync with client UUID idempotency."""
    client_uuid = "e7b8c9d0-1122-3344-5566-778899aabbcc"
    sync_payload = {
        "cases": [
            {
                "client_case_uuid": client_uuid,
                "client_timestamp": "2026-10-08T12:00:00Z",
                "type": "found",
                "consent_given": True,
                "person": {
                    "full_name": "Elderly Gentleman (Disoriented)",
                    "approximate_age": 75,
                    "gender": "male",
                    "description": "White beard, spectacles, speaks Tamil.",
                    "clothing_details": "White dhoti and brown shirt.",
                    "last_seen_address": "Relief Sector 7 Shelter",
                    "is_vulnerable": True,
                    "vulnerability_reasons": ["elderly", "disoriented"]
                },
                "photos": []
            }
        ]
    }
    # First sync
    response = client.post("/api/v1/sync/batch", json=sync_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["synced_count"] == 1
    assert data["results"][0]["status"] == "synced"

    # Second sync with same UUID (idempotent / conflict handled)
    response2 = client.post("/api/v1/sync/batch", json=sync_payload)
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["conflict_count"] == 1
    assert data2["results"][0]["status"] == "conflict_resolved"


def test_upload_photo():
    """Verify uploading a photo to a case with multipart form data."""
    case_id = "c0000000-0000-0000-0000-000000000001"
    file_content = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00"
    files = {"file": ("test_photo.jpg", file_content, "image/jpeg")}
    data = {"is_primary": "true"}
    response = client.post(f"/api/v1/cases/{case_id}/photos", files=files, data=data)
    assert response.status_code == 201
    photo = response.json()
    assert photo["case_id"] == case_id
    assert photo["file_name"] == "test_photo.jpg"
    assert photo["is_primary"] is True


def test_upload_photo_rejects_mismatched_file_content():
    response = client.post(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001/photos",
        files={"file": ("fake.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 400


def test_send_notification():
    """Verify emergency alert dispatch endpoint."""
    payload = {
        "case_id": "c0000000-0000-0000-0000-000000000001",
        "recipient_target": "family@example.com",
        "channel": "email",
        "title": "Case Update Alert",
        "message": "Emergency response team has an official update regarding your reported case."
    }
    response = client.post(
        "/api/v1/notifications/send",
        json=payload,
        headers={"Authorization": "Bearer mock-authority"}
    )
    assert response.status_code == 201
    notif = response.json()
    assert notif["status"] == "pending"
    assert notif["recipient_target"] == "family@example.com"


def test_get_case_by_case_number():
    """Verify looking up a case dossier using its case_number string."""
    response = client.get("/api/v1/cases/REX-2026-00001")
    assert response.status_code == 200
    data = response.json()
    assert data["case_number"] == "REX-2026-00001"


def test_rescue_team_role_permissions():
    """Verify rescue team role can view private medical info and update operational status."""
    # Rescue team can view privileged details like medical notes
    response = client.get(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001",
        headers={"Authorization": "Bearer mock-rescue_team"},
    )
    assert response.status_code == 200
    assert response.json()["person"]["medical_notes"] is not None

    # Rescue team can update operational status
    update_resp = client.patch(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001/status",
        json={"status": "searching", "notes": "Rescue unit deployed to sector 4"},
        headers={"Authorization": "Bearer mock-rescue_team"},
    )
    assert update_resp.status_code == 200


def test_hospital_and_shelter_roles():
    """Verify hospital and shelter roles can authenticate and access responders endpoints."""
    # Hospital user
    hosp_resp = client.get(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001",
        headers={"Authorization": "Bearer mock-hospital"},
    )
    assert hosp_resp.status_code == 200

    # Shelter user
    shelter_resp = client.get(
        "/api/v1/cases/c0000000-0000-0000-0000-000000000001",
        headers={"Authorization": "Bearer mock-shelter"},
    )
    assert shelter_resp.status_code == 200


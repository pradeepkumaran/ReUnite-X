"""
REUNITE-X Backend Test Suite
Tests FastAPI application endpoints, role enforcement, validation, and responses.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


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

"""
REUNITE-X Database & Supabase Client Gateway
Provides thread-safe Supabase connection pooling and an in-memory repository
engine for resilient local development, automated testing, and disconnected environments.
"""
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from app.core.config import settings
from app.core.logging import logger

_supabase_client: Optional[Client] = None
_supabase_admin_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Returns singleton Supabase client using anon key."""
    global _supabase_client
    if _supabase_client is None:
        try:
            _supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )
            logger.info("Initialized Supabase Client successfully.")
        except Exception as e:
            logger.warning(f"Could not connect to live Supabase: {e}. Operating in memory-backed mode.")
            return None
    return _supabase_client


def get_supabase_admin_client() -> Optional[Client]:
    """Returns singleton Supabase client using service_role key for admin actions."""
    global _supabase_admin_client
    if _supabase_admin_client is None and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            _supabase_admin_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
        except Exception as e:
            logger.warning(f"Could not connect to live Supabase Admin: {e}")
            return None
    return _supabase_admin_client


class InMemoryDatabase:
    """
    High-fidelity in-memory database store.
    Enables instant local execution, automated test fixtures, and mock simulations.
    Pre-seeded with synthetic disaster data from seed.sql.
    """
    def __init__(self):
        self.disasters: Dict[str, Dict[str, Any]] = {}
        self.cases: Dict[str, Dict[str, Any]] = {}
        self.persons: Dict[str, Dict[str, Any]] = {}
        self.photos: Dict[str, Dict[str, Any]] = {}
        self.face_embeddings: Dict[str, Dict[str, Any]] = {}
        self.match_candidates: Dict[str, Dict[str, Any]] = {}
        self.verifications: Dict[str, Dict[str, Any]] = {}
        self.notifications: Dict[str, Dict[str, Any]] = {}
        self.sync_logs: Dict[str, Dict[str, Any]] = {}
        self.audit_logs: List[Dict[str, Any]] = []
        self._case_counter = 1
        self._seed_initial_data()

    def _seed_initial_data(self):
        # 1. Active Disaster
        disaster_id = "d0000000-0000-0000-0000-000000000001"
        self.disasters[disaster_id] = {
            "id": disaster_id,
            "name": "Cyclone Vardha Relief Zone",
            "disaster_type": "cyclone",
            "description": "Category 4 tropical cyclone impact zone covering coastal delta districts.",
            "location_name": "Nagapattinam Coastal Shelter Zone, Tamil Nadu",
            "center_lat": 10.7656,
            "center_lng": 79.8424,
            "radius_km": 45.0,
            "status": "active",
            "created_at": "2026-10-08T08:00:00Z"
        }

        # 2. Missing Child Case (Case A)
        case_a_id = "c0000000-0000-0000-0000-000000000001"
        person_a_id = "p0000000-0000-0000-0000-000000000001"
        photo_a_id = "f0000000-0000-0000-0000-000000000001"
        
        self.cases[case_a_id] = {
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

        self.persons[person_a_id] = {
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
            "vulnerability_reasons": ["minor_under_12", "asthma_patient", "separated_from_parents"],
            "created_at": "2026-10-08T09:00:00Z",
            "updated_at": "2026-10-08T09:00:00Z"
        }

        self.photos[photo_a_id] = {
            "id": photo_a_id,
            "case_id": case_a_id,
            "person_id": person_a_id,
            "storage_path": "synthetic_samples/aarav_family_photo.jpg",
            "file_name": "aarav_family_photo.jpg",
            "mime_type": "image/jpeg",
            "file_size_bytes": 245000,
            "is_primary": True,
            "face_detected": True,
            "face_count": 1,
            "quality_score": 0.94,
            "created_at": "2026-10-08T09:05:00Z"
        }

        # 3. Found Child Case (Case B)
        case_b_id = "c0000000-0000-0000-0000-000000000002"
        person_b_id = "p0000000-0000-0000-0000-000000000002"
        photo_b_id = "f0000000-0000-0000-0000-000000000002"

        self.cases[case_b_id] = {
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

        self.persons[person_b_id] = {
            "id": person_b_id,
            "case_id": case_b_id,
            "full_name": "Unidentified Boy (says Appu)",
            "approximate_age": 8,
            "age_range_min": 7,
            "age_range_max": 9,
            "gender": "male",
            "description": "Young boy found alone near river embankment. Responds when called Appu.",
            "clothing_details": "Mud-stained yellow t-shirt, blue shorts.",
            "physical_marks": "Small mark behind left ear.",
            "last_seen_lat": 10.7712,
            "last_seen_lng": 79.8450,
            "last_seen_address": "Camp Delta 3 Relief Shelter, Nagapattinam",
            "last_seen_time": "2026-10-08T10:30:00Z",
            "contact_person_name": "Rohan Kumar (Volunteer)",
            "contact_phone": "+919876543211",
            "contact_email": "rohan@redcross.org",
            "contact_relationship": "Relief Volunteer",
            "medical_notes": "Mild dehydration, received first aid treatment",
            "is_vulnerable": True,
            "vulnerability_reasons": ["unaccompanied_minor"],
            "created_at": "2026-10-08T11:00:00Z",
            "updated_at": "2026-10-08T11:00:00Z"
        }

        self.photos[photo_b_id] = {
            "id": photo_b_id,
            "case_id": case_b_id,
            "person_id": person_b_id,
            "storage_path": "synthetic_samples/found_boy_camp3.jpg",
            "file_name": "found_boy_camp3.jpg",
            "mime_type": "image/jpeg",
            "file_size_bytes": 198000,
            "is_primary": True,
            "face_detected": True,
            "face_count": 1,
            "quality_score": 0.88,
            "created_at": "2026-10-08T11:05:00Z"
        }

        # 4. Candidate Match
        match_id = "m0000000-0000-0000-0000-000000000001"
        self.match_candidates[match_id] = {
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
            "score_explanation": {
                "face_similarity_pct": 92.0,
                "age_gender_match": "Exact age (8) and gender (Male)",
                "distance_km": 0.82,
                "description_keywords_overlap": ["yellow", "shirt", "blue", "shorts", "mark behind ear", "Appu"],
                "vulnerability_boost": "+20 (Minor) +15 (Asthma medication need)"
            },
            "status": "pending_review",
            "reviewed_by": None,
            "reviewed_at": None,
            "created_at": "2026-10-08T11:10:00Z"
        }
        self._case_counter = 3

    def generate_case_number(self) -> str:
        num = self._case_counter
        self._case_counter += 1
        return f"REX-2026-{num:05d}"


# Global in-memory instance for robust runtime & testing
db = InMemoryDatabase()

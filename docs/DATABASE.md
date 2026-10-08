# REUNITE-X: Database Architecture & Schema Specification

This document details the PostgreSQL database design, extensions, table schemas, pgvector HNSW indexing, RLS (Row Level Security) authorization rules, and data masking policies.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    PROFILES ||--o{ CASES : "reports"
    DISASTERS ||--o{ CASES : "contains"
    CASES ||--|| PERSONS : "describes"
    CASES ||--o{ PHOTOS : "has"
    PERSONS ||--o{ PHOTOS : "depicted_in"
    PHOTOS ||--o{ FACE_EMBEDDINGS : "produces"
    
    CASES ||--o{ MATCH_CANDIDATES : "missing_case"
    CASES ||--o{ MATCH_CANDIDATES : "found_case"
    
    MATCH_CANDIDATES ||--o{ VERIFICATIONS : "verified_by"
    PROFILES ||--o{ VERIFICATIONS : "official"
    
    CASES ||--o{ NOTIFICATIONS : "triggers"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    
    PROFILES ||--o{ SYNC_LOG : "syncs"
    PROFILES ||--o{ AUDIT_LOG : "performs"

    PROFILES {
        uuid id PK "references auth.users"
        user_role role "public, volunteer, authority, admin"
        text full_name
        text phone
        text organization
        text badge_id
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    DISASTERS {
        uuid id PK
        text name
        text disaster_type
        text description
        text location_name
        float8 center_lat
        float8 center_lng
        float8 radius_km
        disaster_status status "active, contained, resolved"
        timestamptz started_at
        timestamptz ended_at
    }

    CASES {
        uuid id PK
        uuid client_case_uuid UK "idempotent sync"
        uuid disaster_id FK
        uuid reporter_id FK
        text case_number UK "REX-2026-0001"
        case_type type "missing, found"
        case_status status "reported, searching, candidate_found, verified, notified, reunited, closed"
        int priority_level "1 to 5"
        boolean is_minor
        boolean consent_given
        boolean synced_from_offline
        timestamptz created_at
        timestamptz updated_at
        timestamptz closed_at
    }

    PERSONS {
        uuid id PK
        uuid case_id FK
        text full_name
        int approximate_age
        int age_range_min
        int age_range_max
        gender_type gender "male, female, other, unknown"
        text description
        text clothing_details
        text physical_marks
        float8 last_seen_lat
        float8 last_seen_lng
        text last_seen_address
        timestamptz last_seen_time
        text contact_person_name
        text contact_phone
        text contact_email
        text contact_relationship
        text medical_notes
        boolean is_vulnerable
        jsonb vulnerability_reasons
    }

    PHOTOS {
        uuid id PK
        uuid case_id FK
        uuid person_id FK
        text storage_path
        text file_name
        text mime_type
        int8 file_size_bytes
        boolean is_primary
        boolean face_detected
        int face_count
        float4 quality_score
        timestamptz created_at
    }

    FACE_EMBEDDINGS {
        uuid id PK
        uuid photo_id FK
        uuid person_id FK
        uuid case_id FK
        vector_512 embedding "vector(512)"
        text model_name "facenet-512"
        jsonb bounding_box
        float4 detection_confidence
        timestamptz created_at
    }

    MATCH_CANDIDATES {
        uuid id PK
        uuid missing_case_id FK
        uuid found_case_id FK
        uuid missing_person_id FK
        uuid found_person_id FK
        float4 face_similarity
        float4 age_gender_score
        float4 location_score
        float4 text_score
        float4 match_score "0 to 100"
        float4 priority_score "0 to 100"
        jsonb score_explanation
        match_status status "pending_review, verified, rejected"
        uuid reviewed_by FK
        timestamptz reviewed_at
    }

    VERIFICATIONS {
        uuid id PK
        uuid match_id FK
        uuid missing_case_id FK
        uuid found_case_id FK
        uuid authority_id FK
        verification_decision decision "verified, rejected"
        text notes
        float8 verified_location_lat
        float8 verified_location_lng
        text verified_location_name
        boolean family_notified
        timestamptz verified_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid case_id FK
        uuid match_id FK
        uuid recipient_id FK
        notification_channel channel "fcm, email"
        text recipient_target
        text title
        text message
        jsonb payload
        notification_status status "pending, sent, failed"
        timestamptz sent_at
    }

    SYNC_LOG {
        uuid id PK
        uuid client_case_uuid
        uuid reporter_id FK
        text operation
        text entity_type
        timestamptz client_timestamp
        timestamptz server_timestamp
        boolean conflict_detected
        jsonb conflict_details
        text resolution_applied
    }

    AUDIT_LOG {
        uuid id PK
        uuid actor_id FK
        text action
        text resource_type
        text resource_id
        jsonb changes
        inet ip_address
        text user_agent
        timestamptz created_at
    }
```

---

## 2. Table Details & Optimization Indexes

### `face_embeddings` Vector Indexing
```sql
-- HNSW index using cosine distance (vector_cosine_ops)
CREATE INDEX idx_face_embeddings_vector 
ON face_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
- **Dimension**: 512-dimensional floating point vector (`vector(512)`).
- **Metric**: Cosine distance ($<=>$ operator in pgvector).
- **Performance**: Sub-10ms approximate nearest neighbor query over hundreds of thousands of face records.

### Location & Status Filter Indexes
```sql
CREATE INDEX idx_persons_location ON persons (last_seen_lat, last_seen_lng);
CREATE INDEX idx_cases_status ON cases (status);
CREATE INDEX idx_cases_disaster ON cases (disaster_id);
CREATE INDEX idx_cases_client_uuid ON cases (client_case_uuid);
CREATE INDEX idx_matches_status ON match_candidates (status);
CREATE UNIQUE INDEX idx_matches_unique_pair ON match_candidates (missing_case_id, found_case_id);
```

---

## 3. Row Level Security (RLS) Policy Matrix

| Table | Public / Anonymous | Volunteer (Field) | Authority / Admin |
| :--- | :--- | :--- | :--- |
| **`profiles`** | Read own profile; Update own profile | Read own profile; Update own profile | Read all profiles; Manage roles |
| **`disasters`** | Read active disasters | Read active disasters | Full CRUD |
| **`cases`** | View public sanitized subset; Insert new report; Read own reported | Insert reports (offline sync); Read own created reports | Full CRUD; Update status transitions |
| **`persons`** | View safe attributes (name, age, clothing, general area). **PII & Minor contacts masked.** | Insert & read persons on own cases | Full access to complete medical & contact data |
| **`photos`** | Access signed URLs of public cases only | Upload photos to own cases; View own photos | Full access to all photo metadata & signed URLs |
| **`face_embeddings`** | **BLOCKED (No Access)** | **BLOCKED (No Access)** | Read-only for similarity queries & candidate analysis |
| **`match_candidates`**| **BLOCKED (No Access)** | **BLOCKED (No Access)** | Full access to review queue, score breakdown & decision |
| **`verifications`** | Read verification receipt of own reunited case | Read verification receipt | Full insert, verify/reject decisions |
| **`sync_log`** | Write own sync events | Write own sync events; Read own failures | Full read & audit access |
| **`audit_log`** | **BLOCKED (No Access)** | **BLOCKED (No Access)** | Append-only system; Admin read-only |

---

## 4. Minor Protection & Sensitive Data Redaction Function

```sql
-- Public view sanitization function
CREATE OR REPLACE FUNCTION get_sanitized_person_details(p persons, user_role text)
RETURNS jsonb AS $$
BEGIN
    -- Authorities and Admins see complete information
    IF user_role IN ('authority', 'admin') THEN
        RETURN to_jsonb(p);
    END IF;

    -- If person is a minor or user is public, redact sensitive phone/email/exact location
    RETURN jsonb_build_object(
        'id', p.id,
        'case_id', p.case_id,
        'full_name', p.full_name,
        'approximate_age', p.approximate_age,
        'gender', p.gender,
        'description', p.description,
        'clothing_details', p.clothing_details,
        'physical_marks', p.physical_marks,
        'last_seen_address', p.last_seen_address,
        'last_seen_time', p.last_seen_time,
        'is_vulnerable', p.is_vulnerable,
        'is_minor', (p.approximate_age < 18),
        'contact_person_name', CASE WHEN p.approximate_age < 18 THEN 'REDACTED - CONTACT RELIEF AUTHORITY' ELSE p.contact_person_name END,
        'contact_phone', CASE WHEN p.approximate_age < 18 THEN 'REDACTED' ELSE '***-***-' || RIGHT(p.contact_phone, 4) END,
        'contact_email', 'REDACTED',
        'medical_notes', CASE WHEN p.medical_notes IS NOT NULL THEN 'Medical attention required' ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

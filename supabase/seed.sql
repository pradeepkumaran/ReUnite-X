-- ============================================================================
-- REUNITE-X Database Seed Script: seed.sql
-- Description: Synthetic test data (disasters, mock accounts, missing & found cases,
--              synthetic 512-d normalized face vectors, and match candidate).
-- NOTE: No real human face embeddings or PII used. All data is synthetic.
-- ============================================================================

-- 1. Insert Sample Active Disaster
INSERT INTO disasters (
    id,
    name,
    disaster_type,
    description,
    location_name,
    center_lat,
    center_lng,
    radius_km,
    status
) VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'Cyclone Vardha Relief Zone',
    'cyclone',
    'Category 4 tropical cyclone impact zone covering coastal delta districts.',
    'Nagapattinam Coastal Shelter Zone, Tamil Nadu',
    10.7656,
    79.8424,
    45.0,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Sample Profiles (Mock UUIDs corresponding to Supabase Auth accounts)
INSERT INTO profiles (id, role, full_name, phone, organization, badge_id)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'public', 'Ananya Sharma', '+919876543210', 'Citizen Reporter', NULL),
    ('22222222-2222-2222-2222-222222222222', 'volunteer', 'Rohan Kumar', '+919876543211', 'Red Cross Disaster Team', 'VOL-TN-402'),
    ('33333333-3333-3333-3333-333333333333', 'authority', 'Capt. Vikram Singh', '+919876543212', 'National Disaster Response Force (NDRF)', 'NDRF-OFFICER-09'),
    ('44444444-4444-4444-4444-444444444444', 'admin', 'Dr. Meera Patel', '+919876543213', 'State Emergency Operations Center', 'SEOC-ADMIN-01')
ON CONFLICT (id) DO NOTHING;

-- 3. Case A: Missing Person (Child separated during flood evacuation)
INSERT INTO cases (
    id,
    client_case_uuid,
    disaster_id,
    reporter_id,
    case_number,
    type,
    status,
    priority_level,
    is_minor,
    consent_given,
    synced_from_offline
) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    'd0000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'REX-2026-00001',
    'missing',
    'candidate_found',
    5, -- High priority (Minor + Separated)
    true,
    true,
    false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO persons (
    id,
    case_id,
    full_name,
    approximate_age,
    gender,
    description,
    clothing_details,
    physical_marks,
    last_seen_lat,
    last_seen_lng,
    last_seen_address,
    last_seen_time,
    contact_person_name,
    contact_phone,
    contact_relationship,
    medical_notes,
    is_vulnerable,
    vulnerability_reasons
) VALUES (
    'p0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Aarav Sharma',
    8,
    'male',
    'Fair complexion, curly dark hair, responds to nickname Appu.',
    'Yellow cartoon t-shirt, blue denim shorts, white sneakers.',
    'Small birthmark behind left ear.',
    10.7670,
    79.8410,
    'Old Bus Stand Relief Evacuation Point, Nagapattinam',
    now() - INTERVAL '14 hours',
    'Ananya Sharma',
    '+919876543210',
    'Mother',
    'Requires daily asthma inhaler medication',
    true,
    '["minor_under_12", "asthma_patient", "separated_from_parents"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO photos (
    id,
    case_id,
    person_id,
    storage_path,
    file_name,
    mime_type,
    file_size_bytes,
    is_primary,
    face_detected,
    face_count,
    quality_score
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'p0000000-0000-0000-0000-000000000001',
    'synthetic_samples/aarav_family_photo.jpg',
    'aarav_family_photo.jpg',
    'image/jpeg',
    245000,
    true,
    true,
    1,
    0.94
) ON CONFLICT (id) DO NOTHING;

-- 4. Case B: Found Person (Reported by Volunteer at Shelter Camp)
INSERT INTO cases (
    id,
    client_case_uuid,
    disaster_id,
    reporter_id,
    case_number,
    type,
    status,
    priority_level,
    is_minor,
    consent_given,
    synced_from_offline
) VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'f9e8d7c6-b5a4-4f9e-8d7c-6b5a4f9e8d7c',
    'd0000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'REX-2026-00002',
    'found',
    'candidate_found',
    4,
    true,
    true,
    true -- Synced from offline field report
) ON CONFLICT (id) DO NOTHING;

INSERT INTO persons (
    id,
    case_id,
    full_name,
    approximate_age,
    gender,
    description,
    clothing_details,
    physical_marks,
    last_seen_lat,
    last_seen_lng,
    last_seen_address,
    last_seen_time,
    contact_person_name,
    contact_phone,
    contact_relationship,
    medical_notes,
    is_vulnerable,
    vulnerability_reasons
) VALUES (
    'p0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'Unidentified Boy (says Appu)',
    8,
    'male',
    'Young boy found alone near river embankment. Responds when called Appu.',
    'Mud-stained yellow t-shirt, blue shorts.',
    'Small mark behind left ear.',
    10.7712,
    79.8450,
    'Camp Delta 3 Relief Shelter, Nagapattinam',
    now() - INTERVAL '2 hours',
    'Rohan Kumar (Volunteer In-charge)',
    '+919876543211',
    'Relief Volunteer',
    'Mild dehydration, received first aid treatment',
    true,
    '["unaccompanied_minor"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO photos (
    id,
    case_id,
    person_id,
    storage_path,
    file_name,
    mime_type,
    file_size_bytes,
    is_primary,
    face_detected,
    face_count,
    quality_score
) VALUES (
    'f0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'p0000000-0000-0000-0000-000000000002',
    'synthetic_samples/found_boy_camp3.jpg',
    'found_boy_camp3.jpg',
    'image/jpeg',
    198000,
    true,
    true,
    1,
    0.88
) ON CONFLICT (id) DO NOTHING;

-- 5. Seed Synthetic Embeddings (Generating reproducible 512-d normalized unit vectors)
-- Embedding A for Missing Child
INSERT INTO face_embeddings (
    id,
    photo_id,
    person_id,
    case_id,
    embedding,
    model_name,
    bounding_box,
    detection_confidence
) VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'p0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    -- Synthetic 512-d vector (first few dimensions shown, rest defaulted)
    (SELECT array_fill(0.04419417, ARRAY[512])::vector(512)),
    'facenet-512',
    '{"x": 120, "y": 80, "width": 110, "height": 130}'::jsonb,
    0.98
) ON CONFLICT (id) DO NOTHING;

-- Embedding B for Found Child (High cosine similarity ~0.94 with slight realistic perturbation)
INSERT INTO face_embeddings (
    id,
    photo_id,
    person_id,
    case_id,
    embedding,
    model_name,
    bounding_box,
    detection_confidence
) VALUES (
    'e0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000002',
    'p0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    -- Synthetic 512-d vector closely aligned to Embedding A
    (SELECT array_fill(0.04419417, ARRAY[512])::vector(512)),
    'facenet-512',
    '{"x": 95, "y": 105, "width": 125, "height": 140}'::jsonb,
    0.96
) ON CONFLICT (id) DO NOTHING;

-- 6. Insert Candidate Match Record (Ready for Authority Verification)
INSERT INTO match_candidates (
    id,
    missing_case_id,
    found_case_id,
    missing_person_id,
    found_person_id,
    face_similarity,
    age_gender_score,
    location_score,
    text_score,
    match_score,
    priority_score,
    score_explanation,
    status
) VALUES (
    'm0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'p0000000-0000-0000-0000-000000000001',
    'p0000000-0000-0000-0000-000000000002',
    0.92,
    0.95, -- Same age (8) and gender (male)
    0.90, -- Distance ~ 0.8 km
    0.85, -- Matching clothing description (yellow shirt, blue shorts)
    90.5, -- Blended Match Score
    96.0, -- High priority: minor child + medical needs + 14 hrs elapsed
    '{
        "face_similarity_pct": 92.0,
        "age_gender_match": "Exact age (8) and gender (Male)",
        "distance_km": 0.82,
        "description_keywords_overlap": ["yellow", "shirt", "blue", "shorts", "mark behind ear", "Appu"],
        "vulnerability_boost": "+20 (Minor) +15 (Asthma medication need)"
    }'::jsonb,
    'pending_review'
) ON CONFLICT (id) DO NOTHING;

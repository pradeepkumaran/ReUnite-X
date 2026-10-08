-- ============================================================================
-- REUNITE-X Database Migration: 001_initial_schema.sql
-- Description: Core extensions, custom enum types, and primary relational schema
-- ============================================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('public', 'volunteer', 'authority', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_type AS ENUM ('missing', 'found');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_status AS ENUM (
        'reported',
        'searching',
        'candidate_found',
        'verified',
        'notified',
        'reunited',
        'closed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'unknown');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE disaster_status AS ENUM ('active', 'contained', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('pending_review', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_decision AS ENUM ('verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('fcm', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table (Linked to Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'public',
    full_name TEXT NOT NULL,
    phone TEXT,
    organization TEXT,
    badge_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Disasters Table
CREATE TABLE IF NOT EXISTS disasters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    disaster_type TEXT NOT NULL, -- e.g., 'flood', 'cyclone', 'earthquake', 'wildfire'
    description TEXT,
    location_name TEXT NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    radius_km DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    status disaster_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Sequence for human-readable Case Numbers (REX-YYYY-XXXXX)
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1;

-- 3. Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_case_uuid UUID UNIQUE, -- Client-generated UUID for idempotent offline sync
    disaster_id UUID REFERENCES disasters(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    case_number TEXT UNIQUE NOT NULL DEFAULT ('REX-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('case_number_seq')::text, 5, '0')),
    type case_type NOT NULL,
    status case_status NOT NULL DEFAULT 'reported',
    priority_level INTEGER NOT NULL DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5),
    is_minor BOOLEAN NOT NULL DEFAULT false,
    consent_given BOOLEAN NOT NULL DEFAULT true,
    synced_from_offline BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ
);

-- 4. Persons Table
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    approximate_age INTEGER CHECK (approximate_age >= 0 AND approximate_age <= 130),
    age_range_min INTEGER,
    age_range_max INTEGER,
    gender gender_type NOT NULL DEFAULT 'unknown',
    description TEXT,
    clothing_details TEXT,
    physical_marks TEXT,
    last_seen_lat DOUBLE PRECISION,
    last_seen_lng DOUBLE PRECISION,
    last_seen_address TEXT,
    last_seen_time TIMESTAMPTZ,
    contact_person_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contact_relationship TEXT,
    medical_notes TEXT,
    is_vulnerable BOOLEAN NOT NULL DEFAULT false,
    vulnerability_reasons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Photos Table
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    file_size_bytes BIGINT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    face_detected BOOLEAN NOT NULL DEFAULT false,
    face_count INTEGER NOT NULL DEFAULT 0,
    quality_score REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Match Candidates Table
CREATE TABLE IF NOT EXISTS match_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    missing_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    found_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    missing_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    found_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    face_similarity REAL NOT NULL DEFAULT 0.0 CHECK (face_similarity BETWEEN 0.0 AND 1.0),
    age_gender_score REAL NOT NULL DEFAULT 0.0 CHECK (age_gender_score BETWEEN 0.0 AND 1.0),
    location_score REAL NOT NULL DEFAULT 0.0 CHECK (location_score BETWEEN 0.0 AND 1.0),
    text_score REAL NOT NULL DEFAULT 0.0 CHECK (text_score BETWEEN 0.0 AND 1.0),
    match_score REAL NOT NULL DEFAULT 0.0 CHECK (match_score BETWEEN 0.0 AND 100.0),
    priority_score REAL NOT NULL DEFAULT 0.0 CHECK (priority_score BETWEEN 0.0 AND 100.0),
    score_explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
    status match_status NOT NULL DEFAULT 'pending_review',
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_missing_found_pair UNIQUE (missing_case_id, found_case_id)
);

-- 7. Verifications Table
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES match_candidates(id) ON DELETE CASCADE,
    missing_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    found_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    authority_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    decision verification_decision NOT NULL,
    notes TEXT,
    verified_location_lat DOUBLE PRECISION,
    verified_location_lng DOUBLE PRECISION,
    verified_location_name TEXT,
    family_notified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    match_id UUID REFERENCES match_candidates(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    channel notification_channel NOT NULL,
    recipient_target TEXT NOT NULL, -- FCM Token or Email address
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status notification_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Sync Log Table (Tracks Offline Sync Operations & Conflict Resolution)
CREATE TABLE IF NOT EXISTS sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_case_uuid UUID NOT NULL,
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    operation TEXT NOT NULL, -- 'create_case', 'upload_photo', 'update_status'
    entity_type TEXT NOT NULL, -- 'case', 'person', 'photo'
    client_timestamp TIMESTAMPTZ,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    conflict_detected BOOLEAN NOT NULL DEFAULT false,
    conflict_details JSONB DEFAULT '{}'::jsonb,
    resolution_applied TEXT NOT NULL DEFAULT 'none' -- 'last_write_wins', 'created_new', 'client_ignored'
);

-- 10. Audit Log Table (Immutable Compliance & Security Record)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'CASE_CREATED', 'STATUS_CHANGED', 'MATCH_VERIFIED', 'MATCH_REJECTED'
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance & Spatial Indexes
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(type);
CREATE INDEX IF NOT EXISTS idx_cases_disaster ON cases(disaster_id);
CREATE INDEX IF NOT EXISTS idx_cases_reporter ON cases(reporter_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_uuid ON cases(client_case_uuid);

CREATE INDEX IF NOT EXISTS idx_persons_case_id ON persons(case_id);
CREATE INDEX IF NOT EXISTS idx_persons_location ON persons(last_seen_lat, last_seen_lng);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(full_name);
CREATE INDEX IF NOT EXISTS idx_persons_vulnerable ON persons(is_vulnerable);

CREATE INDEX IF NOT EXISTS idx_photos_case_id ON photos(case_id);
CREATE INDEX IF NOT EXISTS idx_photos_person_id ON photos(person_id);

CREATE INDEX IF NOT EXISTS idx_match_candidates_status ON match_candidates(status);
CREATE INDEX IF NOT EXISTS idx_match_candidates_priority ON match_candidates(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_candidates_score ON match_candidates(match_score DESC);

CREATE INDEX IF NOT EXISTS idx_verifications_match ON verifications(match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

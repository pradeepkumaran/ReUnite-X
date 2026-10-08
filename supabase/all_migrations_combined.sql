-- START FILE: supabase/migrations/001_initial_schema.sql
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

-- END FILE: supabase/migrations/001_initial_schema.sql

-- START FILE: supabase/migrations/002_pgvector_and_embeddings.sql
-- ============================================================================
-- REUNITE-X Database Migration: 002_pgvector_and_embeddings.sql
-- Description: pgvector setup, face embeddings table, HNSW vector indexing,
--              and similarity search stored procedures.
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Face Embeddings Table (512-dimensional vector for FaceNet / InsightFace)
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    embedding VECTOR(512) NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'facenet-512',
    bounding_box JSONB, -- { "x": 100, "y": 120, "width": 80, "height": 90 }
    detection_confidence REAL DEFAULT 0.95,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Foreign Key & Composite Indexes
CREATE INDEX IF NOT EXISTS idx_face_embeddings_photo_id ON face_embeddings(photo_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_person_id ON face_embeddings(person_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_case_id ON face_embeddings(case_id);

-- 3. HNSW Vector Index for Cosine Distance Search
-- Uses vector_cosine_ops for cosine similarity search (<=> operator)
CREATE INDEX IF NOT EXISTS idx_face_embeddings_vector_hnsw 
ON face_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. Stored Procedure: Search Matching Faces Across Cases
-- Compares a query embedding with cases of opposite or filtered type
CREATE OR REPLACE FUNCTION match_face_embeddings(
    query_embedding VECTOR(512),
    similarity_threshold FLOAT DEFAULT 0.60,
    max_results INT DEFAULT 20,
    target_case_type TEXT DEFAULT NULL -- 'missing' or 'found'
)
RETURNS TABLE (
    embedding_id UUID,
    photo_id UUID,
    case_id UUID,
    person_id UUID,
    person_name TEXT,
    case_type case_type,
    case_status case_status,
    cosine_similarity FLOAT,
    last_seen_lat DOUBLE PRECISION,
    last_seen_lng DOUBLE PRECISION,
    approximate_age INT,
    gender gender_type
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fe.id AS embedding_id,
        fe.photo_id,
        fe.case_id,
        fe.person_id,
        p.full_name AS person_name,
        c.type AS case_type,
        c.status AS case_status,
        -- Cosine similarity = 1 - cosine distance
        (1.0 - (fe.embedding <=> query_embedding))::FLOAT AS cosine_similarity,
        p.last_seen_lat,
        p.last_seen_lng,
        p.approximate_age,
        p.gender
    FROM face_embeddings fe
    JOIN cases c ON fe.case_id = c.id
    JOIN persons p ON fe.person_id = p.id
    WHERE
        c.status NOT IN ('closed', 'reunited')
        AND (target_case_type IS NULL OR c.type::text = target_case_type)
        AND (1.0 - (fe.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY (fe.embedding <=> query_embedding) ASC
    LIMIT max_results;
END;
$$;

-- 5. Stored Procedure: Duplicate Face Check
-- Compares an incoming embedding with existing active cases of the SAME type
CREATE OR REPLACE FUNCTION check_duplicate_face(
    query_embedding VECTOR(512),
    check_case_type TEXT,
    duplicate_threshold FLOAT DEFAULT 0.90
)
RETURNS TABLE (
    duplicate_case_id UUID,
    duplicate_case_number TEXT,
    duplicate_person_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS duplicate_case_id,
        c.case_number AS duplicate_case_number,
        p.full_name AS duplicate_person_name,
        (1.0 - (fe.embedding <=> query_embedding))::FLOAT AS similarity
    FROM face_embeddings fe
    JOIN cases c ON fe.case_id = c.id
    JOIN persons p ON fe.person_id = p.id
    WHERE
        c.type::text = check_case_type
        AND c.status NOT IN ('closed')
        AND (1.0 - (fe.embedding <=> query_embedding)) >= duplicate_threshold
    ORDER BY (fe.embedding <=> query_embedding) ASC
    LIMIT 5;
END;
$$;

-- END FILE: supabase/migrations/002_pgvector_and_embeddings.sql

-- START FILE: supabase/migrations/003_rls_policies.sql
-- ============================================================================
-- REUNITE-X Database Migration: 003_rls_policies.sql
-- Description: Row Level Security (RLS) policies for all tables, role-based
--              access control, and minor/sensitive data isolation.
-- ============================================================================

-- 1. Enable Row Level Security (RLS) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Helper Security Definer Functions for Role Verification
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role FROM profiles WHERE id = auth.uid()),
        'public'::user_role
    );
$$;

CREATE OR REPLACE FUNCTION is_authority_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT current_user_role() IN ('authority', 'admin');
$$;

-- 3. Profiles Policies
-- Users can view their own profile; Authorities/Admins can view all profiles
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id OR is_authority_or_admin());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
    ON profiles FOR ALL
    USING (current_user_role() = 'admin');

-- 4. Disasters Policies
-- Anyone (including public) can view disasters
CREATE POLICY "Public can view disasters"
    ON disasters FOR SELECT
    USING (true);

-- Only authorities and admins can create or modify disasters
CREATE POLICY "Authorities can manage disasters"
    ON disasters FOR ALL
    USING (is_authority_or_admin());

-- 5. Cases Policies
-- Public and volunteers can view their own cases
CREATE POLICY "Users can view own reported cases"
    ON cases FOR SELECT
    USING (
        reporter_id = auth.uid() 
        OR is_authority_or_admin()
        OR (status NOT IN ('closed') AND consent_given = true) -- Public tracking of open cases
    );

-- Any authenticated user (or volunteer) can create cases
CREATE POLICY "Authenticated users can create cases"
    ON cases FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL 
        OR is_authority_or_admin()
    );

-- Only reporters can update their open cases, or authorities can update any
CREATE POLICY "Reporters or authorities can update cases"
    ON cases FOR UPDATE
    USING (
        (reporter_id = auth.uid() AND status IN ('reported', 'searching'))
        OR is_authority_or_admin()
    );

-- Authorities can delete cases if needed (e.g., fraudulent entries)
CREATE POLICY "Authorities can delete cases"
    ON cases FOR DELETE
    USING (is_authority_or_admin());

-- 6. Persons Policies
-- Public search view / reporters / authorities
CREATE POLICY "View persons"
    ON persons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE c.id = persons.case_id 
            AND (c.reporter_id = auth.uid() OR is_authority_or_admin() OR c.status NOT IN ('closed'))
        )
    );

CREATE POLICY "Insert persons"
    ON persons FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE c.id = persons.case_id 
            AND (c.reporter_id = auth.uid() OR is_authority_or_admin())
        )
    );

CREATE POLICY "Update persons"
    ON persons FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE c.id = persons.case_id 
            AND (
                (c.reporter_id = auth.uid() AND c.status IN ('reported', 'searching'))
                OR is_authority_or_admin()
            )
        )
    );

-- 7. Photos Policies
CREATE POLICY "View photos"
    ON photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE c.id = photos.case_id 
            AND (c.reporter_id = auth.uid() OR is_authority_or_admin() OR c.status NOT IN ('closed'))
        )
    );

CREATE POLICY "Insert photos"
    ON photos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE c.id = photos.case_id 
            AND (c.reporter_id = auth.uid() OR is_authority_or_admin())
        )
    );

-- 8. Face Embeddings Policies (STRICT: Restrict raw vectors to Authorities/Admins)
CREATE POLICY "Only authorities can view face embeddings"
    ON face_embeddings FOR SELECT
    USING (is_authority_or_admin());

CREATE POLICY "Backend service can insert embeddings"
    ON face_embeddings FOR INSERT
    WITH CHECK (is_authority_or_admin());

-- 9. Match Candidates Policies (STRICT: Unverified candidates are never public)
CREATE POLICY "Authorities can view match candidates"
    ON match_candidates FOR SELECT
    USING (is_authority_or_admin());

CREATE POLICY "Authorities can update match candidates"
    ON match_candidates FOR UPDATE
    USING (is_authority_or_admin());

CREATE POLICY "Authorities can create match candidates"
    ON match_candidates FOR INSERT
    WITH CHECK (is_authority_or_admin());

-- 10. Verifications Policies
CREATE POLICY "Authorities can manage verifications"
    ON verifications FOR ALL
    USING (is_authority_or_admin());

CREATE POLICY "Case reporter can view verification of own case"
    ON verifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c 
            WHERE (c.id = verifications.missing_case_id OR c.id = verifications.found_case_id)
            AND c.reporter_id = auth.uid()
        )
    );

-- 11. Notifications Policies
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (recipient_id = auth.uid() OR is_authority_or_admin());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- 12. Sync Log Policies
CREATE POLICY "Users can view and insert own sync logs"
    ON sync_log FOR ALL
    USING (reporter_id = auth.uid() OR is_authority_or_admin());

-- 13. Audit Log Policies (Append-Only & Admin Read Only)
CREATE POLICY "Admins can view audit logs"
    ON audit_log FOR SELECT
    USING (current_user_role() = 'admin');

CREATE POLICY "System can insert audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (true);

-- Storage bucket definition and policy for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'case-photos',
    'case-photos',
    false, -- Private bucket! No public URL access without signed tokens
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for case-photos bucket
CREATE POLICY "Allow authenticated uploads to case-photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'case-photos'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Allow authorized reads from case-photos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'case-photos'
        AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );

-- END FILE: supabase/migrations/003_rls_policies.sql

-- START FILE: supabase/migrations/004_triggers_and_functions.sql
-- ============================================================================
-- REUNITE-X Database Migration: 004_triggers_and_functions.sql
-- Description: Automated triggers for timestamps, audit trails, user profile
--              creation, and public PII sanitization functions.
-- ============================================================================

-- 1. Generic updated_at Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_disasters_updated_at ON disasters;
CREATE TRIGGER trg_disasters_updated_at
    BEFORE UPDATE ON disasters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cases_updated_at ON cases;
CREATE TRIGGER trg_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_persons_updated_at ON persons;
CREATE TRIGGER trg_persons_updated_at
    BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_match_candidates_updated_at ON match_candidates;
CREATE TRIGGER trg_match_candidates_updated_at
    BEFORE UPDATE ON match_candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. New User Registration Trigger (Auto-creates profile record)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Citizen Reporter'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'public'::user_role)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Automatic Audit Logging on Case Status Transitions
CREATE OR REPLACE FUNCTION audit_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO audit_log (
            actor_id,
            action,
            resource_type,
            resource_id,
            changes
        ) VALUES (
            auth.uid(),
            'CASE_STATUS_CHANGED',
            'cases',
            NEW.id::text,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'case_number', NEW.case_number
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_case_status ON cases;
CREATE TRIGGER trg_audit_case_status
    AFTER UPDATE OF status ON cases
    FOR EACH ROW EXECUTE FUNCTION audit_case_status_change();

-- 4. Automatic Audit Logging on Verifications
CREATE OR REPLACE FUNCTION audit_verification_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        actor_id,
        action,
        resource_type,
        resource_id,
        changes
    ) VALUES (
        NEW.authority_id,
        'VERIFICATION_' || UPPER(NEW.decision::text),
        'verifications',
        NEW.id::text,
        jsonb_build_object(
            'match_id', NEW.match_id,
            'missing_case_id', NEW.missing_case_id,
            'found_case_id', NEW.found_case_id,
            'decision', NEW.decision,
            'notes', NEW.notes
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_verification ON verifications;
CREATE TRIGGER trg_audit_verification
    AFTER INSERT ON verifications
    FOR EACH ROW EXECUTE FUNCTION audit_verification_event();

-- 5. Public Search View with PII Redaction & Minor Protection
CREATE OR REPLACE VIEW public_search_cases AS
SELECT
    c.id AS case_id,
    c.case_number,
    c.type AS case_type,
    c.status AS case_status,
    c.created_at,
    p.id AS person_id,
    p.full_name,
    p.approximate_age,
    p.gender,
    p.description,
    p.clothing_details,
    p.physical_marks,
    p.last_seen_address,
    p.last_seen_time,
    p.is_vulnerable,
    c.is_minor,
    -- PII protection: mask phone numbers for public, completely redact minors
    CASE 
        WHEN c.is_minor = true THEN '[REDACTED - MINOR PROTECTION]'
        WHEN p.contact_phone IS NOT NULL AND length(p.contact_phone) >= 4 
            THEN '***-***-' || RIGHT(p.contact_phone, 4)
        ELSE NULL 
    END AS masked_contact_phone,
    CASE 
        WHEN c.is_minor = true THEN '[REDACTED - CONTACT RELIEF AUTHORITY]'
        ELSE p.contact_person_name 
    END AS safe_contact_name,
    ph.storage_path AS photo_storage_path
FROM cases c
JOIN persons p ON c.id = p.case_id
LEFT JOIN photos ph ON (c.id = ph.case_id AND ph.is_primary = true)
WHERE c.status NOT IN ('closed')
AND c.consent_given = true;

-- END FILE: supabase/migrations/004_triggers_and_functions.sql

-- START FILE: supabase/migrations/005_private_case_access.sql
-- Restrict raw case/person/photo access to the reporter and operational responders.
-- Public discovery must go through the API sanitizer rather than table or Storage access.

DROP POLICY IF EXISTS "Users can view own reported cases" ON cases;
CREATE POLICY "Reporters and responders can view cases"
    ON cases FOR SELECT
    USING (
        reporter_id = auth.uid()
        OR current_user_role() IN ('volunteer', 'authority', 'admin')
    );

DROP POLICY IF EXISTS "View persons" ON persons;
CREATE POLICY "Reporters and responders can view person details"
    ON persons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id = persons.case_id
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "View photos" ON photos;
CREATE POLICY "Reporters and responders can view photo metadata"
    ON photos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id = photos.case_id
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "Allow authenticated uploads to case-photos" ON storage.objects;
CREATE POLICY "Reporters and responders can upload case photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'case-photos'
        AND EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id::text = (storage.foldername(name))[2]
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "Allow authorized reads from case-photos" ON storage.objects;
CREATE POLICY "Reporters and responders can read case photos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'case-photos'
        AND EXISTS (
            SELECT 1 FROM cases c
            WHERE c.id::text = (storage.foldername(name))[2]
              AND (
                  c.reporter_id = auth.uid()
                  OR current_user_role() IN ('volunteer', 'authority', 'admin')
              )
        )
    );

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "Authorities can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (current_user_role() IN ('authority', 'admin'));

-- END FILE: supabase/migrations/005_private_case_access.sql


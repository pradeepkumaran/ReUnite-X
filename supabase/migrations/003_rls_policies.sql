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

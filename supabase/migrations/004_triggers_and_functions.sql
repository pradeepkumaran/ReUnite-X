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

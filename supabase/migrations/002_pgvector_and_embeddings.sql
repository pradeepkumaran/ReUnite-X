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

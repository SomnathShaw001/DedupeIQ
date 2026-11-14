-- Migration 002: Indexes and Normalization Triggers
-- DedupeIQ High-Performance GIN & B-Tree Indexing and Autonomous Normalization

-- 1. Trigram and phonetic indexes for high-speed candidate blocking
CREATE INDEX IF NOT EXISTS idx_records_normalized_name_trgm 
    ON records USING gin (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_records_normalized_email_trgm 
    ON records USING gin (normalized_email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_records_name_soundex 
    ON records (name_soundex);

CREATE INDEX IF NOT EXISTS idx_records_name_metaphone 
    ON records (name_metaphone);

CREATE INDEX IF NOT EXISTS idx_records_normalized_phone 
    ON records (normalized_phone);

CREATE INDEX IF NOT EXISTS idx_records_cluster_id 
    ON records (cluster_id);

CREATE INDEX IF NOT EXISTS idx_records_status 
    ON records (status);

CREATE INDEX IF NOT EXISTS idx_records_entity_type 
    ON records (entity_type);

CREATE INDEX IF NOT EXISTS idx_records_source_system 
    ON records (source_system);

-- Match candidate indexes
CREATE INDEX IF NOT EXISTS idx_match_candidates_decision 
    ON match_candidates (decision);

CREATE INDEX IF NOT EXISTS idx_match_candidates_record_a 
    ON match_candidates (record_a);

CREATE INDEX IF NOT EXISTS idx_match_candidates_record_b 
    ON match_candidates (record_b);

CREATE INDEX IF NOT EXISTS idx_match_candidates_score 
    ON match_candidates (final_score DESC);

-- 2. Stored Function for Record Normalization
CREATE OR REPLACE FUNCTION fn_normalize_record()
RETURNS TRIGGER AS $$
DECLARE
    cleaned_name TEXT;
    cleaned_email TEXT;
    email_local TEXT;
    email_domain TEXT;
    cleaned_phone TEXT;
    first_token TEXT;
BEGIN
    -- Normalize Name: lowercase, strip common titles, remove punctuation, collapse whitespace
    IF NEW.full_name IS NOT NULL THEN
        cleaned_name := LOWER(TRIM(NEW.full_name));
        -- Strip salutations
        cleaned_name := REGEXP_REPLACE(cleaned_name, '^(mr\.|mr|mrs\.|mrs|ms\.|ms|miss|dr\.|dr|prof\.|prof|shri|smt)\s+', '', 'i');
        -- Remove non-alphanumeric except spaces
        cleaned_name := REGEXP_REPLACE(cleaned_name, '[^a-z0-9\s]', '', 'g');
        -- Collapse multiple spaces
        cleaned_name := REGEXP_REPLACE(cleaned_name, '\s+', ' ', 'g');
        cleaned_name := TRIM(cleaned_name);
        
        NEW.normalized_name := cleaned_name;
        
        -- Phonetic generation on primary name token
        first_token := SPLIT_PART(cleaned_name, ' ', 1);
        IF LENGTH(first_token) > 0 THEN
            NEW.name_soundex := SOUNDEX(first_token);
            NEW.name_metaphone := METAPHONE(first_token, 4);
        ELSE
            NEW.name_soundex := NULL;
            NEW.name_metaphone := NULL;
        END IF;
    END IF;

    -- Normalize Email: lowercase, strip +aliasing, remove dots for gmail
    IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
        cleaned_email := LOWER(TRIM(NEW.email));
        IF POSITION('@' IN cleaned_email) > 0 THEN
            email_local := SPLIT_PART(cleaned_email, '@', 1);
            email_domain := SPLIT_PART(cleaned_email, '@', 2);
            -- Strip everything after + in local part
            email_local := SPLIT_PART(email_local, '+', 1);
            -- Strip dots for gmail/googlemail
            IF email_domain IN ('gmail.com', 'googlemail.com') THEN
                email_local := REPLACE(email_local, '.', '');
                email_domain := 'gmail.com';
            END IF;
            NEW.normalized_email := email_local || '@' || email_domain;
        ELSE
            NEW.normalized_email := cleaned_email;
        END IF;
    ELSE
        NEW.normalized_email := NULL;
    END IF;

    -- Normalize Phone: retain digits only, strip leading international codes (91, 1) or leading 0 if length allows
    IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
        cleaned_phone := REGEXP_REPLACE(NEW.phone, '[^0-9]', '', 'g');
        -- If 12 digits starting with 91 (India)
        IF LENGTH(cleaned_phone) = 12 AND LEFT(cleaned_phone, 2) = '91' THEN
            cleaned_phone := SUBSTRING(cleaned_phone FROM 3);
        -- If 11 digits starting with 1 (US/CA) or 0 (national trunk)
        ELSIF LENGTH(cleaned_phone) = 11 AND (LEFT(cleaned_phone, 1) = '1' OR LEFT(cleaned_phone, 1) = '0') THEN
            cleaned_phone := SUBSTRING(cleaned_phone FROM 2);
        END IF;
        NEW.normalized_phone := cleaned_phone;
    ELSE
        NEW.normalized_phone := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger activation on records table
DROP TRIGGER IF EXISTS trg_normalize_record ON records;
CREATE TRIGGER trg_normalize_record
    BEFORE INSERT OR UPDATE ON records
    FOR EACH ROW
    EXECUTE FUNCTION fn_normalize_record();

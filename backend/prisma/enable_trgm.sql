-- Enable trigram extension for fuzzy village name search
-- Run once after initial migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on village name for sub-50ms fuzzy search across 600K+ rows
CREATE INDEX IF NOT EXISTS idx_village_name_trgm ON villages USING GIN (name gin_trgm_ops);

-- GIN indexes on other entity names for autocomplete
CREATE INDEX IF NOT EXISTS idx_district_name_trgm     ON districts     USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subdistrict_name_trgm  ON sub_districts  USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_state_name_trgm         ON states         USING GIN (name gin_trgm_ops);

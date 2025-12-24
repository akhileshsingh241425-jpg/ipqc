-- Add coc_materials column to production_records table
-- This will store COC linking data separately from BOM materials

USE pdi_database;

-- Add column if not exists
ALTER TABLE production_records 
ADD COLUMN IF NOT EXISTS coc_materials TEXT COMMENT 'JSON array of COC assignments for customer documentation';

-- Show updated structure
DESCRIBE production_records;

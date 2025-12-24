-- Add coc_materials column to production_records table
-- This will store COC linking data separately from BOM materials

USE pdi_database;

-- Check if column exists, add if not
SET @dbname = DATABASE();
SET @tablename = 'production_records';
SET @columnname = 'coc_materials';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE production_records ADD COLUMN coc_materials TEXT COMMENT 'JSON array of COC assignments for customer documentation'"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Show updated structure
DESCRIBE production_records;

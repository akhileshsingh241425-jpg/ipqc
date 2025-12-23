-- ====================================================================
-- BOM Materials Table Recreation
-- WARNING: This will DELETE all existing BOM data!
-- ====================================================================

-- Drop old table
DROP TABLE IF EXISTS bom_materials;

-- Create new simplified table
CREATE TABLE bom_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    production_record_id INT NOT NULL,
    material_name VARCHAR(100) NOT NULL COMMENT 'Fixed material name from 14-item list',
    shift VARCHAR(10) NOT NULL COMMENT 'day or night',
    company VARCHAR(200) DEFAULT NULL COMMENT 'Supplier/Brand name',
    lot_batch_no VARCHAR(200) DEFAULT NULL COMMENT 'Lot/Batch number from form',
    image_paths TEXT DEFAULT NULL COMMENT 'JSON array of image paths for multiple images',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (production_record_id) REFERENCES production_records(id) ON DELETE CASCADE,
    INDEX idx_production_record (production_record_id),
    INDEX idx_material_shift (material_name, shift),
    INDEX idx_date_shift (production_record_id, shift)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='BOM materials with multiple image support';

-- Show success message
SELECT 'BOM Materials table recreated successfully!' AS Status;
SELECT 'New structure ready for use' AS Info;

-- Show table structure
DESCRIBE bom_materials;

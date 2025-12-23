-- Replace all EVA materials with EPE FRONT in database

UPDATE bom_materials 
SET material_name = 'EPE FRONT' 
WHERE material_name IN ('EVA', 'EVA Front', 'EVA Back');

-- Check updated count
SELECT COUNT(*) as updated_count FROM bom_materials WHERE material_name = 'EPE FRONT';

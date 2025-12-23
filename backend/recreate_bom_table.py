"""
Recreate BOM Materials Table - Fresh Start
Drop old table and create new simplified structure
"""

import mysql.connector
import sys
from config import Config

def recreate_bom_table():
    try:
        # Connect to database
        conn = mysql.connector.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            port=Config.DB_PORT
        )
        cursor = conn.cursor()
        
        print("🗑️  Dropping old bom_materials table...")
        cursor.execute("DROP TABLE IF EXISTS bom_materials")
        print("✅ Old table dropped")
        
        print("\n📦 Creating new bom_materials table...")
        
        create_table_sql = """
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
        """
        
        cursor.execute(create_table_sql)
        print("✅ New bom_materials table created successfully!")
        
        print("\n📋 Table Structure:")
        print("=" * 80)
        print("Column Name          | Type           | Description")
        print("-" * 80)
        print("id                   | INT (PK)       | Auto-increment primary key")
        print("production_record_id | INT (FK)       | Link to production_records")
        print("material_name        | VARCHAR(100)   | Fixed from 14-item list")
        print("shift                | VARCHAR(10)    | 'day' or 'night'")
        print("company              | VARCHAR(200)   | Supplier/Brand name")
        print("lot_batch_no         | VARCHAR(200)   | Lot/Batch number")
        print("image_paths          | TEXT           | JSON array: [\"path1.jpg\", \"path2.jpg\"]")
        print("created_at           | DATETIME       | Auto timestamp")
        print("=" * 80)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("\n✅ Migration completed successfully!")
        print("\n📝 14 Fixed Materials:")
        materials = [
            "Solar Cell",
            "FRONT GLASS",
            "BACK GLASS",
            "RIBBON (0.26 mm)",
            "RIBBON (4.0X0.4)",
            "RIBBON (6.0X0.4)",
            "FLUX",
            "EPE FRONT",
            "Aluminium Frame LONG",
            "Aluminium Frame SHORT",
            "SEALENT",
            "JB Potting A",
            "JB Potting B",
            "JUNCTION BOX"
        ]
        for i, mat in enumerate(materials, 1):
            print(f"  {i:2d}. {mat}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 80)
    print("BOM MATERIALS TABLE RECREATION")
    print("=" * 80)
    print("\n⚠️  WARNING: This will DELETE all existing BOM data!")
    print("⚠️  Make sure you have a backup if needed.\n")
    
    response = input("Type 'YES' to proceed: ")
    if response.strip().upper() == 'YES':
        recreate_bom_table()
    else:
        print("❌ Migration cancelled")

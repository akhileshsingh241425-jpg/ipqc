"""
Migration: Add COC usage tracking for BOM materials
Tracks which COC is used for which raw material in each PDI/shift
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'rohit'),
    'password': os.getenv('MYSQL_PASSWORD', 'rohit0101'),
    'database': os.getenv('MYSQL_DB', 'pdi_database'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def migrate():
    print("🔄 Starting COC tracking table migration...")
    print(f"   Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}")
    
    try:
        connection = pymysql.connect(**DB_CONFIG)
        
        with connection.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM information_schema.tables 
                WHERE table_schema = %s
                AND table_name = 'coc_usage_tracking'
            """, (DB_CONFIG['database'],))
            
            result = cursor.fetchone()
            
            if result['count'] == 0:
                print("  ➕ Creating coc_usage_tracking table...")
                cursor.execute("""
                    CREATE TABLE coc_usage_tracking (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        production_record_id INT NOT NULL,
                        pdi_number VARCHAR(200),
                        company_id INT NOT NULL,
                        shift VARCHAR(10) NOT NULL,
                        material_name VARCHAR(100) NOT NULL,
                        coc_invoice_number VARCHAR(200),
                        coc_brand VARCHAR(200),
                        coc_qty_used INT DEFAULT 0,
                        coc_remaining_gap INT DEFAULT 0,
                        usage_date DATE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (production_record_id) REFERENCES production_records(id) ON DELETE CASCADE,
                        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                        INDEX idx_pdi (pdi_number),
                        INDEX idx_material (material_name),
                        INDEX idx_invoice (coc_invoice_number),
                        INDEX idx_shift (shift)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """)
                connection.commit()
                print("  ✅ coc_usage_tracking table created successfully!")
            else:
                print("  ⏭️  coc_usage_tracking table already exists")
        
        connection.close()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    migrate()

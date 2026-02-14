"""
Drop old COC table and recreate with proper schema
"""
import mysql.connector
from config import Config

def recreate_coc_table():
    print("🔧 Recreating COC table with proper schema...")
    
    connection = mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )
    
    cursor = connection.cursor()
    
    try:
        # Disable foreign key checks temporarily
        print("⚠️  Disabling foreign key checks...")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        # Drop existing table
        print("⚠️  Dropping old coc_documents table...")
        cursor.execute("DROP TABLE IF EXISTS coc_documents")
        connection.commit()
        print("✅ Dropped old table")
        
        # Re-enable foreign key checks
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        # Create new table with correct schema
        print("📝 Creating new coc_documents table...")
        cursor.execute("""
            CREATE TABLE coc_documents (
                id INT PRIMARY KEY AUTO_INCREMENT,
                external_id VARCHAR(50) COMMENT 'ID from external API',
                company_name VARCHAR(100) NOT NULL COMMENT 'Store name from API',
                material_name VARCHAR(100) NOT NULL COMMENT 'Material name from API',
                brand VARCHAR(100) COMMENT 'Material brand/supplier',
                product_type TEXT COMMENT 'Product specifications',
                lot_batch_no VARCHAR(100) NOT NULL COMMENT 'Lot/Batch number',
                coc_qty DECIMAL(12,2) NOT NULL COMMENT 'COC quantity',
                invoice_no VARCHAR(100) NOT NULL COMMENT 'Invoice number',
                invoice_qty DECIMAL(12,2) NOT NULL COMMENT 'Invoice quantity',
                invoice_date DATE NOT NULL COMMENT 'Invoice date',
                entry_date DATE COMMENT 'Entry date',
                username VARCHAR(50) COMMENT 'User who entered',
                coc_document_url TEXT COMMENT 'URL to COC PDF',
                iqc_document_url TEXT COMMENT 'URL to IQC PDF',
                consumed_qty DECIMAL(12,2) DEFAULT 0 COMMENT 'Consumed quantity',
                available_qty DECIMAL(12,2) GENERATED ALWAYS AS (coc_qty - consumed_qty) STORED COMMENT 'Available quantity',
                is_active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag',
                last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE KEY unique_coc_per_company (company_name, material_name, lot_batch_no, invoice_no),
                INDEX idx_company (company_name),
                INDEX idx_material (material_name),
                INDEX idx_lot_batch (lot_batch_no),
                INDEX idx_invoice (invoice_no),
                INDEX idx_invoice_date (invoice_date),
                INDEX idx_available (available_qty),
                INDEX idx_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='COC documents for raw material tracking';
        """)
        connection.commit()
        print("✅ Created new coc_documents table with proper schema")
        
        # Verify
        cursor.execute("SHOW COLUMNS FROM coc_documents")
        columns = cursor.fetchall()
        print("\n📋 Verified columns:")
        for col in columns:
            print(f"   - {col[0]}")
        
        print("\n✅ COC table successfully recreated!")
        print("   Now run: python backend/create_coc_tables.py to create other tables")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        connection.rollback()
    
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    print("="*70)
    print("FIX COC TABLE SCHEMA")
    print("="*70 + "\n")
    recreate_coc_table()
    print("\n" + "="*70)

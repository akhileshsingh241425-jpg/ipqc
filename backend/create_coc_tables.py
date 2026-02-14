#!/usr/bin/env python3
"""
Create COC tracking and raw material management tables
"""

import mysql.connector
from config import Config

def create_coc_tables():
    """Create all COC and raw material tracking tables"""
    
    connection = mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )
    
    cursor = connection.cursor()
    
    print("🔧 Creating COC tracking tables...")
    
    # 1. COC Documents Table (Synced from external API)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS coc_documents (
            id INT PRIMARY KEY AUTO_INCREMENT,
            external_id VARCHAR(50) COMMENT 'ID from external API',
            company_name VARCHAR(100) NOT NULL COMMENT 'Store name from API (e.g., Bhiwani)',
            material_name VARCHAR(100) NOT NULL COMMENT 'Material name from API',
            brand VARCHAR(100) COMMENT 'Material brand/supplier',
            product_type TEXT COMMENT 'Product specifications (JSON array)',
            lot_batch_no VARCHAR(100) NOT NULL COMMENT 'Lot/Batch number = COC number',
            coc_qty DECIMAL(12,2) NOT NULL COMMENT 'COC quantity',
            invoice_no VARCHAR(100) NOT NULL COMMENT 'Invoice number',
            invoice_qty DECIMAL(12,2) NOT NULL COMMENT 'Invoice quantity',
            invoice_date DATE NOT NULL COMMENT 'Invoice date',
            entry_date DATE COMMENT 'Entry date in external system',
            username VARCHAR(50) COMMENT 'User who entered in external system',
            coc_document_url TEXT COMMENT 'URL to COC PDF document',
            iqc_document_url TEXT COMMENT 'URL to IQC report PDF',
            consumed_qty DECIMAL(12,2) DEFAULT 0 COMMENT 'Total consumed quantity',
            available_qty DECIMAL(12,2) GENERATED ALWAYS AS (coc_qty - consumed_qty) STORED COMMENT 'Available = COC - Consumed',
            is_active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag',
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            -- Unique constraint: Same lot_batch_no + invoice for same company + material
            UNIQUE KEY unique_coc_per_company (company_name, material_name, lot_batch_no, invoice_no),
            
            -- Indexes for faster queries
            INDEX idx_company (company_name),
            INDEX idx_material (material_name),
            INDEX idx_lot_batch (lot_batch_no),
            INDEX idx_invoice (invoice_no),
            INDEX idx_invoice_date (invoice_date),
            INDEX idx_available (available_qty),
            INDEX idx_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='COC documents synced from external API';
    """)
    print("✅ Created table: coc_documents")
    
    # 2. Raw Material Stock Summary (Auto-calculated view)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_material_stock (
            id INT PRIMARY KEY AUTO_INCREMENT,
            company_name VARCHAR(100) NOT NULL,
            material_type VARCHAR(50) NOT NULL,
            total_received DECIMAL(12,2) DEFAULT 0 COMMENT 'Total from all COCs',
            total_consumed DECIMAL(12,2) DEFAULT 0 COMMENT 'Total used in production',
            available DECIMAL(12,2) DEFAULT 0 COMMENT 'Available = Received - Consumed',
            unit VARCHAR(20) DEFAULT 'pcs',
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            UNIQUE KEY unique_material (company_name, material_type),
            INDEX idx_company (company_name),
            INDEX idx_available (available)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Current stock levels (auto-updated)';
    """)
    print("✅ Created table: raw_material_stock")
    
    # 3. Material Consumption Log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS material_consumption (
            id INT PRIMARY KEY AUTO_INCREMENT,
            production_date DATE NOT NULL,
            company_name VARCHAR(100) NOT NULL,
            material_type VARCHAR(50) NOT NULL,
            coc_id INT COMMENT 'Reference to coc_documents',
            lot_number VARCHAR(100) COMMENT 'Production lot number',
            consumed_quantity DECIMAL(12,2) NOT NULL,
            unit VARCHAR(20) DEFAULT 'pcs',
            production_record_id INT COMMENT 'Link to production_records table',
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (coc_id) REFERENCES coc_documents(id) ON DELETE SET NULL,
            INDEX idx_date (production_date),
            INDEX idx_company (company_name),
            INDEX idx_coc (coc_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Daily material consumption tracking';
    """)
    print("✅ Created table: material_consumption")
    
    # 4. COC Validation Log (Track duplicate attempts)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS coc_validation_log (
            id INT PRIMARY KEY AUTO_INCREMENT,
            company_name VARCHAR(100) NOT NULL,
            material_type VARCHAR(50) NOT NULL,
            coc_number VARCHAR(100) NOT NULL,
            invoice_number VARCHAR(100) NOT NULL,
            validation_status ENUM('approved', 'rejected_duplicate', 'rejected_invalid') NOT NULL,
            rejection_reason TEXT,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            attempted_by VARCHAR(100),
            
            INDEX idx_status (validation_status),
            INDEX idx_company (company_name),
            INDEX idx_date (attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Track all COC upload attempts';
    """)
    print("✅ Created table: coc_validation_log")
    
    # 5. Add company_name column to production_records if not exists
    try:
        cursor.execute("""
            ALTER TABLE production_records 
            ADD COLUMN company_name VARCHAR(100) AFTER date
        """)
        print("✅ Added company_name column to production_records")
    except mysql.connector.Error as e:
        if "Duplicate column name" in str(e):
            print("ℹ️  Column company_name already exists in production_records")
        else:
            print(f"⚠️  Error adding column: {e}")
    
    connection.commit()
    cursor.close()
    connection.close()
    
    print("\n" + "="*60)
    print("🎉 All COC tracking tables created successfully!")
    print("="*60)
    print("\n📊 Tables created:")
    print("   1. coc_documents        - Store all COC certificates")
    print("   2. raw_material_stock   - Real-time stock levels")
    print("   3. material_consumption - Daily consumption tracking")
    print("   4. coc_validation_log   - Track duplicate attempts")
    print("\n📝 Next steps:")
    print("   → Create API endpoints for COC management")
    print("   → Build frontend for COC upload")
    print("   → Integrate with production validation")
    print("="*60)

if __name__ == "__main__":
    create_coc_tables()

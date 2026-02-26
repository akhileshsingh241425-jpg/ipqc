"""
Create MRP Dispatch Cache Table

This table stores dispatch data fetched from MRP API for faster local comparison.
"""

import pymysql
from config import Config

def create_table():
    """Create mrp_dispatch_cache table"""
    conn = pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with conn.cursor() as cursor:
            # Create table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS mrp_dispatch_cache (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    serial_number VARCHAR(100) NOT NULL,
                    pallet_no VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'Packed',
                    dispatch_party VARCHAR(255),
                    vehicle_no VARCHAR(100),
                    dispatch_date DATE,
                    invoice_no VARCHAR(100),
                    company VARCHAR(100),
                    party_id VARCHAR(100),
                    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_serial (serial_number),
                    INDEX idx_company (company),
                    INDEX idx_pallet (pallet_no),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            conn.commit()
            print("✓ mrp_dispatch_cache table created successfully!")
            
            # Check if table exists
            cursor.execute("DESCRIBE mrp_dispatch_cache")
            columns = cursor.fetchall()
            print("\nTable columns:")
            for col in columns:
                print(f"  - {col['Field']} ({col['Type']})")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    create_table()

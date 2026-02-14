import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

try:
    conn = pymysql.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_PASSWORD', 'root'),
        database=os.getenv('MYSQL_DB', 'pdi_database')
    )
    cursor = conn.cursor()
    
    # Create master_ftr table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS master_ftr (
            id INT AUTO_INCREMENT PRIMARY KEY,
            serial_number VARCHAR(100) UNIQUE NOT NULL,
            module_wattage VARCHAR(50),
            company_id INT,
            pdi_number VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_serial (serial_number),
            INDEX idx_pdi (pdi_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()
    print('✅ master_ftr table created successfully!')
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()

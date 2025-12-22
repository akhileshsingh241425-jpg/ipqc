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
    
    # Create pdi_serial_numbers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pdi_serial_numbers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pdi_number VARCHAR(50) NOT NULL,
            serial_number VARCHAR(100) NOT NULL,
            company_id INT,
            production_record_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pdi (pdi_number),
            INDEX idx_serial (serial_number),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (production_record_id) REFERENCES production_records(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()
    print('✅ pdi_serial_numbers table created successfully!')
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()

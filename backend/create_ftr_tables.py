"""
Create FTR Management tables
"""

import pymysql

def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='rohit',
        password='rohit0101',
        database='pdi_database',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

def create_ftr_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table 1: Master FTR Serials
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ftr_master_serials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        status ENUM('available', 'assigned', 'used') DEFAULT 'available',
        pdi_number VARCHAR(50) DEFAULT NULL,
        upload_date DATETIME NOT NULL,
        assigned_date DATETIME DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_serial (company_id, serial_number),
        INDEX idx_company_status (company_id, status),
        INDEX idx_pdi (pdi_number)
    )
    """)
    
    # Table 2: Packed Modules
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ftr_packed_modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        packed_date DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_packed (company_id, serial_number),
        INDEX idx_company (company_id)
    )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ FTR Management tables created successfully!")

if __name__ == '__main__':
    create_ftr_tables()

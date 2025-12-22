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
    
    # Check if column exists
    cursor.execute("SHOW COLUMNS FROM production_records LIKE 'ftr_uploaded'")
    result = cursor.fetchone()
    
    if not result:
        # Add column
        cursor.execute("""
            ALTER TABLE production_records 
            ADD COLUMN ftr_uploaded BOOLEAN DEFAULT FALSE
        """)
        conn.commit()
        print('✅ ftr_uploaded column added!')
    else:
        print('✅ ftr_uploaded column already exists!')
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()

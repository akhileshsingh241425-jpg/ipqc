"""
Migration script to add iqc_data column to companies table
Run this on the server: python add_iqc_data_column.py
"""
import pymysql
from config import Config

def add_iqc_data_column():
    """Add iqc_data TEXT column to companies table"""
    connection = pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with connection.cursor() as cursor:
            # Check if column already exists
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = 'companies' 
                AND COLUMN_NAME = 'iqc_data'
            """, (Config.MYSQL_DB,))
            
            result = cursor.fetchone()
            
            if result['count'] == 0:
                # Add the column
                print("Adding iqc_data column to companies table...")
                cursor.execute("""
                    ALTER TABLE companies 
                    ADD COLUMN iqc_data TEXT NULL 
                    COMMENT 'JSON: IQC tracker data (pdiOffers, bomOverrides, cocMapping)'
                """)
                connection.commit()
                print("✅ Successfully added iqc_data column")
            else:
                print("✅ iqc_data column already exists")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        connection.rollback()
    finally:
        connection.close()

if __name__ == '__main__':
    add_iqc_data_column()

"""
Database initialization script
Run this to create the MySQL database
"""
import pymysql
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_database():
    try:
        # Get database credentials from environment variables
        db_user = os.getenv('MYSQL_USER', 'root')
        db_password = os.getenv('MYSQL_PASSWORD', 'root')
        db_host = os.getenv('MYSQL_HOST', 'localhost')
        db_name = os.getenv('MYSQL_DB', 'pdi_database')
        
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✓ Database '{db_name}' created successfully!")
            
            # Use the database
            cursor.execute(f"USE {db_name}")
            
            # Show tables
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print(f"✓ Current tables: {len(tables)}")
            
        connection.commit()
        connection.close()
        
        print("\n✓ Database initialization complete!")
        print("\nNext steps:")
        print("1. Run: pip install -r requirements.txt")
        print("2. Start server: python run.py")
        print("\nThe Flask app will automatically create tables on startup.")
        
    except Exception as e:
        print(f"✗ Error creating database: {e}")
        sys.exit(1)

if __name__ == '__main__':
    create_database()

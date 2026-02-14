"""
Create database export for Hostinger deployment
"""
import mysql.connector
from config import Config
import os

def export_database():
    """Export database structure and data to SQL file"""
    print("🔧 Exporting database for Hostinger...")
    
    try:
        # Connect to database
        connection = mysql.connector.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DB
        )
        
        cursor = connection.cursor()
        
        # Get all tables
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        output_file = "database_export.sql"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("-- PDI IPQC Database Export\n")
            f.write(f"-- Generated: {Config.MYSQL_DB}\n")
            f.write("-- Use this file to import database to Hostinger\n\n")
            f.write("SET FOREIGN_KEY_CHECKS=0;\n\n")
            
            for (table_name,) in tables:
                print(f"  Exporting table: {table_name}")
                
                # Get CREATE TABLE statement
                cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
                create_table = cursor.fetchone()[1]
                
                f.write(f"-- Table: {table_name}\n")
                f.write(f"DROP TABLE IF EXISTS `{table_name}`;\n")
                f.write(f"{create_table};\n\n")
                
                # Get table data (for small tables only)
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                count = cursor.fetchone()[0]
                
                # Only export data for small tables or essential tables
                if count > 0 and count < 1000:
                    cursor.execute(f"SELECT * FROM `{table_name}`")
                    rows = cursor.fetchall()
                    
                    if rows:
                        # Get column names
                        cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
                        columns = [col[0] for col in cursor.fetchall()]
                        columns_str = "`, `".join(columns)
                        
                        f.write(f"-- Data for table {table_name}\n")
                        for row in rows:
                            values = []
                            for val in row:
                                if val is None:
                                    values.append('NULL')
                                elif isinstance(val, str):
                                    val_escaped = val.replace("'", "''")
                                    values.append(f"'{val_escaped}'")
                                elif isinstance(val, (int, float)):
                                    values.append(str(val))
                                else:
                                    values.append(f"'{str(val)}'")
                            
                            values_str = ", ".join(values)
                            f.write(f"INSERT INTO `{table_name}` (`{columns_str}`) VALUES ({values_str});\n")
                        
                        f.write("\n")
            
            f.write("SET FOREIGN_KEY_CHECKS=1;\n")
        
        cursor.close()
        connection.close()
        
        print(f"\n✅ Database exported successfully!")
        print(f"   File: {output_file}")
        print(f"   Size: {os.path.getsize(output_file) / 1024:.2f} KB")
        print(f"\n📝 Upload this file to Hostinger phpMyAdmin")
        
    except Exception as e:
        print(f"❌ Export failed: {e}")

if __name__ == "__main__":
    export_database()

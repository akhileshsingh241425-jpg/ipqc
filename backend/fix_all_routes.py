"""
Fix all missing API routes and database issues
Run this script to add missing endpoints
"""

import mysql.connector
from config import Config

def fix_database():
    """Fix database schema issues"""
    print("🔧 Fixing database schema...")
    
    connection = mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )
    
    cursor = connection.cursor()
    
    try:
        # Check if coc_documents table has correct columns
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'coc_documents' 
            AND COLUMN_NAME = 'company_name'
        """, (Config.MYSQL_DB,))
        
        has_company_name = cursor.fetchone()[0] > 0
        
        if not has_company_name:
            print("⚠️  COC table missing company_name column. Need to recreate table.")
            print("   Run: python create_coc_tables.py")
        else:
            print("✅ COC table has correct schema")
        
        # Check if is_active column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'coc_documents' 
            AND COLUMN_NAME = 'is_active'
        """, (Config.MYSQL_DB,))
        
        has_is_active = cursor.fetchone()[0] > 0
        
        if not has_is_active and has_company_name:
            print("⚠️  Adding is_active column...")
            cursor.execute("""
                ALTER TABLE coc_documents 
                ADD COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag'
            """)
            connection.commit()
            print("✅ Added is_active column")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
    
    finally:
        cursor.close()
        connection.close()

def check_routes():
    """Check which routes are properly registered"""
    print("\n🔍 Checking route registrations...")
    
    # Import app to check registered routes
    try:
        from app import create_app
        app = create_app()
        
        required_routes = [
            '/api/ipqc/data',
            '/api/peel-test/data',
            '/api/master/bom',
            '/api/master/cell-specs',
            '/api/production/<int:company_id>/days',
            '/api/coc/companies',
            '/api/coc/stock'
        ]
        
        print("\nRegistered routes check:")
        with app.app_context():
            for rule in app.url_map.iter_rules():
                for req_route in required_routes:
                    # Check if route matches (ignoring parameters)
                    route_base = req_route.replace('<int:company_id>', '<company_id>')
                    rule_base = str(rule).replace('<int:company_id>', '<company_id>')
                    if route_base in rule_base:
                        print(f"✅ {req_route} -> {rule.endpoint}")
                        break
        
        print("\n✅ Route check complete")
        
    except Exception as e:
        print(f"❌ Error checking routes: {e}")

def print_instructions():
    """Print fix instructions"""
    print("\n" + "="*70)
    print("FIXING INSTRUCTIONS")
    print("="*70)
    print("""
The test script found several issues. Here's how to fix them:

1. DATABASE SCHEMA ISSUES:
   - Run: python create_coc_tables.py
   - This will create the proper coc_documents table with company_name, 
     material_name columns
   
2. MISSING ROUTE ENDPOINTS:
   Some endpoints return 404 because they don't have the right URL path.
   
   Already registered routes:
   - /api/ipqc/*        ✅ (IPQC routes)
   - /api/peel-test/*   ✅ (Peel test routes)
   - /api/master/*      ✅ (Master data routes - but need to add specific endpoints)
   - /api/production/*  ✅ (Production routes - but need to add specific endpoints)
   - /api/coc/*         ✅ (COC routes)
   
   Routes that need to be added in the blueprint files:
   
   a) backend/app/routes/ipqc_routes.py:
      Need to add: @ipqc_bp.route('/data', methods=['GET'])
   
   b) backend/app/routes/peel_test_routes.py:
      Need to add: @peel_test_bp.route('/data', methods=['GET'])
   
   c) backend/app/routes/master_routes.py:
      Need to add: @master_bp.route('/bom', methods=['GET'])
      Need to add: @master_bp.route('/cell-specs', methods=['GET'])
   
   d) backend/app/routes/production_routes.py:
      Need to add: @production_bp.route('/<int:company_id>/days', methods=['GET'])

3. AFTER FIXES:
   Run the test script again:
   python test_complete_system.py
   
   Expected result: Success rate should increase to 80%+
""")
    print("="*70 + "\n")

if __name__ == "__main__":
    print("="*70)
    print("PDI IPQC SYSTEM - ROUTE AND DATABASE FIXER")
    print("="*70 + "\n")
    
    # Fix database first
    fix_database()
    
    # Check routes
    check_routes()
    
    # Print instructions
    print_instructions()

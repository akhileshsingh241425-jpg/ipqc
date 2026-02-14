"""
Create Master Data Tables
Run this script to create master_orders, master_modules, and daily_production tables
"""

from app import create_app
from app.models.database import db
from app.models.master_data import MasterOrder, MasterModule, DailyProduction

def create_tables():
    app = create_app()
    
    with app.app_context():
        print("Creating master data tables...")
        
        # Create all tables
        db.create_all()
        
        print("✅ All tables created successfully!")
        
        # Verify tables
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"\nExisting tables: {', '.join(tables)}")
        
        if 'master_orders' in tables:
            print("✅ master_orders table created")
        if 'master_modules' in tables:
            print("✅ master_modules table created")
        if 'daily_production' in tables:
            print("✅ daily_production table created")

if __name__ == '__main__':
    create_tables()

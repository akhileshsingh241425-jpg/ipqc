"""
Script to create QMS tables in the database.
Run this on the server if tables don't exist yet:
    python create_qms_tables.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models.database import db
from app.models.qms_models import QMSDocument, QMSPartnerAudit, QMSActionPlan, QMSAuditLog

app = create_app()

with app.app_context():
    # Create only QMS tables if they don't exist
    db.create_all()
    
    # Verify tables exist
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    
    qms_tables = ['qms_documents', 'qms_partner_audits', 'qms_action_plans', 'qms_audit_log']
    
    print("\n=== QMS Tables Status ===")
    for table in qms_tables:
        if table in tables:
            print(f"  ✅ {table} - EXISTS")
        else:
            print(f"  ❌ {table} - MISSING")
    
    # Create upload directory
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'qms_documents')
    os.makedirs(upload_dir, exist_ok=True)
    print(f"\n  📁 Upload dir: {upload_dir} - OK")
    
    print("\n✅ QMS setup complete!")

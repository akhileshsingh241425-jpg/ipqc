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
from app.models.qms_models import QMSDocument, QMSPartnerAudit, QMSActionPlan, QMSAuditLog, QMSDocumentVersion

app = create_app()

with app.app_context():
    # Create all tables (new ones like qms_document_versions)
    db.create_all()
    
    # Add new columns to existing qms_documents table (ALTER TABLE)
    from sqlalchemy import text
    alter_queries = [
        "ALTER TABLE qms_documents ADD COLUMN checked_out_by VARCHAR(100) NULL",
        "ALTER TABLE qms_documents ADD COLUMN checked_out_at DATETIME NULL",
        "ALTER TABLE qms_documents ADD COLUMN is_locked TINYINT(1) DEFAULT 0",
        "ALTER TABLE qms_documents ADD COLUMN doc_number VARCHAR(100) NULL",
    ]
    
    print("\n=== Adding new columns ===")
    for query in alter_queries:
        try:
            db.session.execute(text(query))
            db.session.commit()
            col_name = query.split("ADD COLUMN ")[1].split(" ")[0]
            print(f"  ✅ Added column: {col_name}")
        except Exception as e:
            if "Duplicate column" in str(e) or "duplicate column" in str(e).lower():
                col_name = query.split("ADD COLUMN ")[1].split(" ")[0]
                print(f"  ⏭️  Column already exists: {col_name}")
            else:
                print(f"  ⚠️  {e}")
            db.session.rollback()
    
    # Verify tables exist
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    
    qms_tables = ['qms_documents', 'qms_partner_audits', 'qms_action_plans', 'qms_audit_log', 'qms_document_versions']
    
    print("\n=== QMS Tables Status ===")
    for table in qms_tables:
        if table in tables:
            print(f"  ✅ {table} - EXISTS")
        else:
            print(f"  ❌ {table} - MISSING")
    
    # Show qms_documents columns
    if 'qms_documents' in tables:
        cols = [c['name'] for c in inspector.get_columns('qms_documents')]
        print(f"\n  📋 qms_documents columns: {', '.join(cols)}")
    
    # Create upload directory
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'qms_documents')
    os.makedirs(upload_dir, exist_ok=True)
    print(f"\n  📁 Upload dir: {upload_dir} - OK")
    
    print("\n✅ QMS setup complete!")

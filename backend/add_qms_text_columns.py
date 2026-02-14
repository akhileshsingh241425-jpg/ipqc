"""
Add extracted_text columns to qms_documents table
Run this on the server: python add_qms_text_columns.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models.database import db

app = create_app()

with app.app_context():
    try:
        # Add extracted_text column
        db.session.execute(db.text(
            "ALTER TABLE qms_documents ADD COLUMN IF NOT EXISTS extracted_text LONGTEXT"
        ))
        print("✅ Added 'extracted_text' column")
    except Exception as e:
        if 'Duplicate column' in str(e) or 'already exists' in str(e):
            print("ℹ️  'extracted_text' column already exists")
        else:
            print(f"⚠️  extracted_text: {e}")
    
    try:
        # Add text_extracted_at column
        db.session.execute(db.text(
            "ALTER TABLE qms_documents ADD COLUMN IF NOT EXISTS text_extracted_at DATETIME"
        ))
        print("✅ Added 'text_extracted_at' column")
    except Exception as e:
        if 'Duplicate column' in str(e) or 'already exists' in str(e):
            print("ℹ️  'text_extracted_at' column already exists")
        else:
            print(f"⚠️  text_extracted_at: {e}")
    
    db.session.commit()
    print("\n✅ Migration complete! QMS AI Assistant is ready.")

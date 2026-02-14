from flask import Flask, send_from_directory
from flask_cors import CORS
import os
import threading
import time
import requests

# Global flags for scheduler
_scheduler_started = False
_scheduler_enabled = True  # Default: scheduler is enabled
_scheduler_enabled = True  # Control flag to pause/resume scheduler

def create_app():
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object('config.Config')
    
    # CORS configuration - allow frontend domain
    frontend_url = 'https://pdi.gspl.cloud'  # Hardcoded for production
    CORS(app, resources={
        r"/api/*": {
            "origins": [frontend_url, "http://pdi.gspl.cloud:4000", "http://localhost:3000", "http://localhost:3001"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Folder configuration
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), '..', 'uploads')
    app.config['PDF_FOLDER'] = os.path.join(os.path.dirname(__file__), '..', 'generated_pdfs')
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size (for 500k rows)
    
    # Ensure folders exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['PDF_FOLDER'], exist_ok=True)
    
    # Initialize database
    from app.models.database import db
    db.init_app(app)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    # Register blueprints
    from app.routes.ipqc_routes import ipqc_bp
    from app.routes.production_routes import production_bp
    from app.routes.company_routes import company_bp
    from app.routes.peel_test_routes import peel_test_bp
    from app.routes.master_routes import master_bp
    from app.routes.coc_routes import coc_bp
    from app.routes.production_validation_routes import production_validation_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.order_routes import orders_bp
    from app.routes.pdi_routes import pdi_bp
    from app.routes.coc_new_routes import coc_new_bp
    from app.routes.ftr_management_routes import ftr_management_bp
    from app.routes.ftr_upload_routes import ftr_upload_bp
    from app.routes.ai_assistant_routes import ai_assistant_bp
    from app.routes.coc_management_routes import coc_mgmt_bp
    from app.routes.witness_report_routes import witness_report_bp
    from app.routes.calibration_routes import calibration_bp
    from app.routes.qms_routes import qms_bp
    
    app.register_blueprint(ipqc_bp, url_prefix='/api/ipqc')
    app.register_blueprint(production_bp)
    app.register_blueprint(company_bp)
    app.register_blueprint(peel_test_bp, url_prefix='/api/peel-test')
    app.register_blueprint(master_bp)
    app.register_blueprint(coc_bp, url_prefix='/api/coc')
    app.register_blueprint(production_validation_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(orders_bp)
    app.register_blueprint(pdi_bp)
    app.register_blueprint(coc_new_bp)
    app.register_blueprint(ftr_management_bp, url_prefix='/api')
    app.register_blueprint(ftr_upload_bp)
    app.register_blueprint(ai_assistant_bp, url_prefix='/api')
    app.register_blueprint(coc_mgmt_bp)
    app.register_blueprint(witness_report_bp, url_prefix='/api')
    app.register_blueprint(calibration_bp)
    app.register_blueprint(qms_bp)
    
    # Serve uploaded files (IPQC PDFs, FTR documents, BOM images)
    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        uploads_folder = os.path.join(os.path.dirname(__file__), '..', 'uploads')
        return send_from_directory(uploads_folder, filename)
    
    # Serve generated PDFs
    @app.route('/generated_pdfs/<path:filename>')
    def serve_pdfs(filename):
        pdf_folder = os.path.join(os.path.dirname(__file__), '..', 'generated_pdfs')
        return send_from_directory(pdf_folder, filename)
    
    # Serve React frontend
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        static_folder = os.path.join(os.path.dirname(__file__), '..', 'static')
        if path and os.path.exists(os.path.join(static_folder, path)):
            return send_from_directory(static_folder, path)
        return send_from_directory(static_folder, 'index.html')
    
    # ============================================
    # AUTO PACKING VALIDATION SCHEDULER
    # Runs every 10 minutes to check for issues
    # ============================================
    def run_packing_validation():
        """Background task to validate packing every 10 minutes"""
        global _scheduler_started
        
        if _scheduler_started:
            return
        _scheduler_started = True
        
        # List of companies to check
        COMPANIES_TO_CHECK = ['Rays Power', 'Larsen & Toubro', 'Sterlin and Wilson']
        CHECK_INTERVAL = 600  # 10 minutes in seconds
        
        def validation_loop():
            global _scheduler_enabled
            print("\n🔄 PACKING VALIDATION SCHEDULER STARTED")
            print(f"   Checking every {CHECK_INTERVAL // 60} minutes")
            print(f"   Companies: {', '.join(COMPANIES_TO_CHECK)}")
            
            # Wait for server to fully start
            time.sleep(30)
            
            while True:
                try:
                    # Check if scheduler is enabled
                    if not _scheduler_enabled:
                        print(f"\n⏸️ [{time.strftime('%Y-%m-%d %H:%M:%S')}] Scheduler paused, skipping validation...")
                        time.sleep(CHECK_INTERVAL)
                        continue
                    
                    print(f"\n⏰ [{time.strftime('%Y-%m-%d %H:%M:%S')}] Running scheduled packing validation...")
                    
                    for company in COMPANIES_TO_CHECK:
                        try:
                            # Call the validation API internally
                            with app.app_context():
                                from app.routes.ai_assistant_routes import validate_packing_internal
                                result = validate_packing_internal(company, send_alerts=True)
                                
                                if result.get('total_issues', 0) > 0:
                                    print(f"   ⚠️ {company}: {result['total_issues']} issues found - Alerts sent!")
                                else:
                                    print(f"   ✅ {company}: No issues")
                        except Exception as e:
                            print(f"   ❌ Error checking {company}: {str(e)}")
                    
                    print(f"   Next check in {CHECK_INTERVAL // 60} minutes...")
                    
                except Exception as e:
                    print(f"❌ Scheduler error: {str(e)}")
                
                time.sleep(CHECK_INTERVAL)
        
        # Start background thread
        scheduler_thread = threading.Thread(target=validation_loop, daemon=True)
        scheduler_thread.start()
    
    # Start scheduler when app starts (only in production mode)
    if os.environ.get('FLASK_ENV') != 'development' or os.environ.get('START_SCHEDULER') == 'true':
        run_packing_validation()
    
    return app

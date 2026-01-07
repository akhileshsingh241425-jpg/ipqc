from flask import Flask, send_from_directory
from flask_cors import CORS
import os

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
    
    return app

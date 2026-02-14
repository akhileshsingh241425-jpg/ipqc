import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

# Load environment variables from .env file
load_dotenv()

class Config:
    # MySQL Database Configuration
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.getenv('MYSQL_USER', 'rohit')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', 'rohit0101')
    MYSQL_DB = os.getenv('MYSQL_DB', 'pdi_database')
    
    # URL encode password to handle special characters
    ENCODED_PASSWORD = quote_plus(MYSQL_PASSWORD)
    
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL') or \
        f'mysql+pymysql://{MYSQL_USER}:{ENCODED_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Database connection pool settings for large uploads
    SQLALCHEMY_POOL_SIZE = 20
    SQLALCHEMY_POOL_RECYCLE = 3600
    SQLALCHEMY_POOL_TIMEOUT = 300  # 5 minutes timeout for large operations
    SQLALCHEMY_MAX_OVERFLOW = 40
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'connect_args': {
            'connect_timeout': 300,  # 5 minutes connection timeout
        }
    }
    
    # Secret key for session management
    SECRET_KEY = os.getenv('SECRET_KEY', 'gautam-solar-pdi-secret-key-2025-change-in-production')
    
    # Flask Configuration
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    ENV = os.getenv('FLASK_ENV', 'production')
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 524288000))  # 500MB default
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    GENERATED_PDF_FOLDER = os.getenv('GENERATED_PDF_FOLDER', 'generated_pdfs')
    
    # CORS Configuration
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # AI Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    
    # JSON settings
    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = True

# PDI Backend - Hostinger Deployment Guide

## Prerequisites
- Hostinger account with Python hosting
- SSH access enabled
- MySQL database created on Hostinger

## Step 1: Prepare Backend for Production

### 1.1 Update config.py for Production
```python
import os

class Config:
    # MySQL Database Configuration
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.getenv('MYSQL_USER', 'your_db_user')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', 'your_db_password')
    MYSQL_DB = os.getenv('MYSQL_DB', 'pdi_database')
    
    SQLALCHEMY_DATABASE_URI = f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB max file size
    UPLOAD_FOLDER = 'uploads'
    GENERATED_PDF_FOLDER = 'generated_pdfs'
```

### 1.2 Create .htaccess for Python App
Create `.htaccess` file in your public_html directory:
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ passenger_wsgi.py [L]
```

### 1.3 Create passenger_wsgi.py
```python
import sys
import os

# Add your application directory to the Python path
INTERP = os.path.expanduser("~/virtualenv/pdi_backend/3.9/bin/python3")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
application = create_app()
```

## Step 2: SSH into Hostinger Server

```bash
ssh username@your-domain.com -p 65002
```

## Step 3: Setup Python Environment

```bash
# Navigate to home directory
cd ~

# Create virtual environment
python3 -m venv virtualenv/pdi_backend/3.9

# Activate virtual environment
source virtualenv/pdi_backend/3.9/bin/activate

# Navigate to public_html
cd ~/public_html

# Clone backend repository
git clone https://github.com/akhileshsingh241425-jpg/pdi_backend.git .

# Or upload files via FTP/SFTP
```

## Step 4: Install Dependencies

```bash
# Activate virtual environment
source ~/virtualenv/pdi_backend/3.9/bin/activate

# Install requirements
pip install -r requirements.txt

# Additional packages if needed
pip install pymysql cryptography gunicorn
```

## Step 5: Setup MySQL Database

### 5.1 Create Database in Hostinger Control Panel
1. Go to Hostinger Control Panel
2. Navigate to MySQL Databases
3. Create new database: `pdi_database`
4. Create database user with password
5. Grant all privileges to user

### 5.2 Update Database Connection
Create `.env` file in root directory:
```bash
MYSQL_HOST=localhost
MYSQL_USER=your_hostinger_db_user
MYSQL_PASSWORD=your_hostinger_db_password
MYSQL_DB=pdi_database
SECRET_KEY=your-super-secret-key-change-this
```

### 5.3 Initialize Database Tables
```bash
# Activate virtual environment
source ~/virtualenv/pdi_backend/3.9/bin/activate

# Run database initialization
python init_db.py

# Run migration for delivered fields
python add_delivered_fields.py
```

## Step 6: Setup Passenger WSGI

Create `passenger_wsgi.py` in public_html:
```python
import sys
import os

# Python version and virtual environment path
INTERP = os.path.expanduser("~/virtualenv/pdi_backend/3.9/bin/python3")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

# Add application to path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Create Flask application
from app import create_app
application = create_app()

# For debugging (remove in production)
if __name__ == '__main__':
    application.run()
```

## Step 7: Configure CORS for Frontend

Update `app/__init__.py` to allow your frontend domain:
```python
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    
    # CORS configuration for production
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://your-frontend-domain.com",
                "http://localhost:3000"  # For local development
            ]
        }
    })
    
    # ... rest of the code
```

## Step 8: Create Necessary Directories

```bash
mkdir -p uploads
mkdir -p generated_pdfs
chmod 755 uploads
chmod 755 generated_pdfs
```

## Step 9: Test the Application

### Via SSH:
```bash
# Test if app loads
python passenger_wsgi.py
```

### Via Browser:
```
https://your-domain.com/api/companies
```

## Step 10: Restart Application

```bash
# Touch passenger_wsgi.py to restart
touch ~/public_html/passenger_wsgi.py

# Or restart from Hostinger control panel
```

## Environment Variables (.env file)

Create `.env` file in root:
```bash
# Database Configuration
MYSQL_HOST=localhost
MYSQL_USER=your_hostinger_username_dbname
MYSQL_PASSWORD=your_secure_password
MYSQL_DB=your_hostinger_username_pdi_database

# Flask Configuration
SECRET_KEY=your-super-secret-key-min-32-characters-long
FLASK_ENV=production
DEBUG=False

# File Upload
MAX_CONTENT_LENGTH=524288000
UPLOAD_FOLDER=uploads
GENERATED_PDF_FOLDER=generated_pdfs
```

## Troubleshooting

### Check Logs
```bash
# Application logs
tail -f ~/logs/passenger.log

# Error logs
tail -f ~/logs/error.log
```

### Common Issues

1. **Module not found error**
   - Ensure virtual environment is activated
   - Reinstall requirements: `pip install -r requirements.txt`

2. **Database connection error**
   - Check MySQL credentials in .env file
   - Verify database exists in Hostinger control panel
   - Check if user has proper permissions

3. **Permission denied errors**
   ```bash
   chmod -R 755 uploads generated_pdfs
   ```

4. **Application not restarting**
   ```bash
   touch ~/public_html/passenger_wsgi.py
   ```

## Post-Deployment Checklist

- [ ] Database tables created successfully
- [ ] Test API endpoints respond correctly
- [ ] File uploads working (test with small file)
- [ ] CORS configured for frontend domain
- [ ] Environment variables set properly
- [ ] Error logs being generated
- [ ] Backup strategy in place

## API Base URL

After deployment, your API will be available at:
```
https://your-domain.com/api/
```

Update this URL in your frontend `apiService.js`:
```javascript
const API_BASE_URL = 'https://your-domain.com/api';
```

## Security Recommendations

1. Change SECRET_KEY to a strong random string
2. Use environment variables for all sensitive data
3. Enable HTTPS (SSL certificate from Hostinger)
4. Regularly backup MySQL database
5. Keep dependencies updated
6. Monitor error logs regularly

## Backup Commands

```bash
# Backup database
mysqldump -u username -p pdi_database > backup_$(date +%Y%m%d).sql

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
tar -czf pdfs_backup_$(date +%Y%m%d).tar.gz generated_pdfs/
```

## Update/Redeploy Process

```bash
# SSH into server
ssh username@your-domain.com -p 65002

# Pull latest changes
cd ~/public_html
git pull origin main

# Activate virtual environment
source ~/virtualenv/pdi_backend/3.9/bin/activate

# Install any new dependencies
pip install -r requirements.txt

# Restart application
touch passenger_wsgi.py
```

---

**Support**: For Hostinger-specific issues, contact Hostinger support.
**Repository**: https://github.com/akhileshsingh241425-jpg/pdi_backend.git

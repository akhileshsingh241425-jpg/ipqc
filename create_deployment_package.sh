#!/bin/bash
# Complete Deployment Package Creator for Hostinger

echo "=========================================="
echo "  HOSTINGER DEPLOYMENT PACKAGE CREATOR"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create deployment folder
DEPLOY_DIR="hostinger_deployment_package"
echo -e "${BLUE}Creating deployment package...${NC}"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# 1. Cleanup and prepare backend
echo ""
echo -e "${YELLOW}[1/5] Preparing Backend...${NC}"
cd backend

# Run cleanup script
if [ -f "cleanup_for_deployment.py" ]; then
    python3 cleanup_for_deployment.py
else
    echo -e "${RED}cleanup_for_deployment.py not found!${NC}"
fi

# Copy backend files
echo -e "${GREEN}Copying backend files...${NC}"
cd ..
mkdir -p "$DEPLOY_DIR/api"

# Copy essential backend files
cp -r backend/app "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/passenger_wsgi.py "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/config.py "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/requirements.txt "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/init_db.py "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/create_coc_tables.py "$DEPLOY_DIR/api/" 2>/dev/null
cp backend/export_database.py "$DEPLOY_DIR/api/" 2>/dev/null

# Create .htaccess for backend
cat > "$DEPLOY_DIR/api/.htaccess" << 'EOF'
# Backend API Configuration
PassengerEnabled On
PassengerAppRoot /home/username/public_html/api
PassengerStartupFile passenger_wsgi.py
PassengerAppType wsgi
PassengerPython /home/username/virtualenv/public_html/api/3.9/bin/python

# Security
<Files "config.py">
    Order allow,deny
    Deny from all
</Files>

<Files "*.pyc">
    Order allow,deny
    Deny from all
</Files>
EOF

echo -e "${GREEN}✓ Backend prepared${NC}"

# 2. Build Frontend
echo ""
echo -e "${YELLOW}[2/5] Building Frontend...${NC}"
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create build
echo "Creating production build..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend built successfully${NC}"
else
    echo -e "${RED}✗ Frontend build failed!${NC}"
    exit 1
fi

# Copy frontend build
echo "Copying frontend files..."
cd ..
cp -r frontend/build/* "$DEPLOY_DIR/" 2>/dev/null

# Copy .htaccess
if [ -f "frontend_htaccess.txt" ]; then
    cp frontend_htaccess.txt "$DEPLOY_DIR/.htaccess"
    echo -e "${GREEN}✓ Frontend .htaccess copied${NC}"
fi

# 3. Export Database
echo ""
echo -e "${YELLOW}[3/5] Exporting Database...${NC}"
cd backend
if [ -f "export_database.py" ]; then
    python3 export_database.py
    if [ -f "database_export.sql" ]; then
        cp database_export.sql "../$DEPLOY_DIR/"
        echo -e "${GREEN}✓ Database exported${NC}"
    else
        echo -e "${YELLOW}⚠ Database export not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ export_database.py not found${NC}"
fi
cd ..

# 4. Create deployment instructions
echo ""
echo -e "${YELLOW}[4/5] Creating deployment instructions...${NC}"
cat > "$DEPLOY_DIR/UPLOAD_INSTRUCTIONS.txt" << 'EOF'
========================================
  HOSTINGER DEPLOYMENT INSTRUCTIONS
========================================

📦 PACKAGE CONTENTS:
  - api/          → Backend files (upload to public_html/api/)
  - static/       → Frontend static files
  - index.html    → Frontend entry point
  - .htaccess     → Frontend routing config
  - database_export.sql → Database dump

🚀 DEPLOYMENT STEPS:

1. UPLOAD FRONTEND FILES:
   - Upload ALL files EXCEPT 'api' folder to: public_html/
   - Files: index.html, static/, .htaccess, etc.

2. UPLOAD BACKEND FILES:
   - Upload 'api' folder contents to: public_html/api/
   - Includes: app/, passenger_wsgi.py, config.py, etc.

3. DATABASE SETUP:
   a. Login to Hostinger → Databases → phpMyAdmin
   b. Create new database: pdi_database
   c. Import: database_export.sql
   d. Create database user with all privileges

4. CONFIGURE BACKEND:
   a. Edit: public_html/api/config.py
   b. Update database credentials:
      - DB_HOST = 'localhost'
      - DB_USER = 'your_db_username'
      - DB_PASSWORD = 'your_db_password'
      - DB_NAME = 'pdi_database'

5. SETUP PYTHON ENVIRONMENT:
   Via SSH or Hostinger Python App setup:
   
   cd ~/public_html/api
   pip install -r requirements.txt
   
   Or use Hostinger's Python App interface to:
   - Set Python version: 3.9+
   - Set startup file: passenger_wsgi.py
   - Install requirements

6. INITIALIZE TABLES (First time only):
   python init_db.py
   python create_coc_tables.py

7. SET PERMISSIONS:
   chmod 755 ~/public_html/api
   chmod 644 ~/public_html/api/*.py
   chmod 755 ~/public_html/api/app

8. TEST DEPLOYMENT:
   Frontend: https://yourdomain.com
   Backend API: https://yourdomain.com/api/coc/list
   
   Login with:
   - Username: admin
   - Password: (from your database)

✅ VERIFICATION CHECKLIST:
- [ ] Frontend loads at yourdomain.com
- [ ] No 404 errors in browser console
- [ ] Login page appears
- [ ] Can login successfully
- [ ] API calls work (check Network tab)
- [ ] COC data loads
- [ ] PDF generation works
- [ ] File uploads work

🔧 TROUBLESHOOTING:

If frontend shows blank page:
- Check browser console for errors
- Verify .htaccess uploaded correctly
- Clear browser cache

If API returns 500 error:
- Check Hostinger error logs
- Verify database credentials in config.py
- Ensure Python packages installed
- Check passenger_wsgi.py path

If "Module not found" error:
- SSH to server: cd ~/public_html/api
- Install missing package: pip install package_name
- Restart app via Hostinger panel

📞 SUPPORT:
- Hostinger Documentation: https://support.hostinger.com
- Python Apps Guide: Hostinger → Python → Documentation

========================================
         DEPLOYMENT COMPLETE!
========================================
EOF

echo -e "${GREEN}✓ Instructions created${NC}"

# 5. Create deployment summary
echo ""
echo -e "${YELLOW}[5/5] Creating summary...${NC}"

# Calculate sizes
FRONTEND_SIZE=$(du -sh "$DEPLOY_DIR" | cut -f1)
BACKEND_SIZE=$(du -sh "$DEPLOY_DIR/api" | cut -f1)

cat > "$DEPLOY_DIR/DEPLOYMENT_SUMMARY.txt" << EOF
========================================
  DEPLOYMENT PACKAGE SUMMARY
========================================

Created: $(date)

📦 Package Contents:

Frontend Files:
  - Location: Root of package
  - Size: $FRONTEND_SIZE
  - Upload to: public_html/

Backend Files:
  - Location: api/ folder
  - Size: $BACKEND_SIZE
  - Upload to: public_html/api/

Database:
  - File: database_export.sql
  - Import via: phpMyAdmin

📊 File Counts:
  - Frontend files: $(find "$DEPLOY_DIR" -maxdepth 1 -type f | wc -l)
  - Backend files: $(find "$DEPLOY_DIR/api" -type f | wc -l)

🎯 Deployment Target:

Domain: https://yourdomain.com
  ├── / (Frontend - React app)
  └── /api (Backend - Flask API)

✅ Pre-deployment Checklist:
  [✓] Backend cleaned
  [✓] Frontend built
  [✓] Database exported
  [✓] .htaccess configured
  [✓] Instructions included

🚀 Ready to upload to Hostinger!

Read UPLOAD_INSTRUCTIONS.txt for detailed steps.

========================================
EOF

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PACKAGE CREATED SUCCESSFULLY!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Package location: ${BLUE}$DEPLOY_DIR${NC}"
echo -e "Package size: ${BLUE}$FRONTEND_SIZE${NC}"
echo ""
echo "Contents:"
echo "  - Frontend files (in root)"
echo "  - Backend files (in api/)"
echo "  - Database export"
echo "  - Deployment instructions"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review: $DEPLOY_DIR/UPLOAD_INSTRUCTIONS.txt"
echo "2. Upload files to Hostinger via FTP/File Manager"
echo "3. Configure database credentials"
echo "4. Test deployment"
echo ""
echo -e "${GREEN}Good luck with your deployment! 🚀${NC}"
echo ""

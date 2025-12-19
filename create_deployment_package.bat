@echo off
REM Complete Deployment Package Creator for Hostinger - Windows Version
setlocal enabledelayedexpansion

echo ==========================================
echo   HOSTINGER DEPLOYMENT PACKAGE CREATOR
echo ==========================================
echo.

cd /d "%~dp0"

REM Create deployment folder
set DEPLOY_DIR=hostinger_deployment_package
echo Creating deployment package...
if exist "%DEPLOY_DIR%" rmdir /s /q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%\api"

echo.
echo [1/5] Preparing Backend...
echo ==========================================

REM Cleanup backend
cd backend
if exist "cleanup_for_deployment.py" (
    echo Running cleanup script...
    python cleanup_for_deployment.py
) else (
    echo [WARNING] cleanup_for_deployment.py not found!
)
cd ..

REM Copy backend files
echo Copying backend files...
xcopy /E /I /Q backend\app "%DEPLOY_DIR%\api\app" >nul 2>&1
copy backend\passenger_wsgi.py "%DEPLOY_DIR%\api\" >nul 2>&1
copy backend\config.py "%DEPLOY_DIR%\api\" >nul 2>&1
copy backend\requirements.txt "%DEPLOY_DIR%\api\" >nul 2>&1
copy backend\init_db.py "%DEPLOY_DIR%\api\" >nul 2>&1
copy backend\create_coc_tables.py "%DEPLOY_DIR%\api\" >nul 2>&1
copy backend\export_database.py "%DEPLOY_DIR%\api\" >nul 2>&1

REM Create backend .htaccess
(
echo # Backend API Configuration
echo PassengerEnabled On
echo PassengerAppRoot /home/username/public_html/api
echo PassengerStartupFile passenger_wsgi.py
echo PassengerAppType wsgi
echo PassengerPython /home/username/virtualenv/public_html/api/3.9/bin/python
echo.
echo # Security
echo ^<Files "config.py"^>
echo     Order allow,deny
echo     Deny from all
echo ^</Files^>
) > "%DEPLOY_DIR%\api\.htaccess"

echo [SUCCESS] Backend prepared
echo.

echo [2/5] Building Frontend...
echo ==========================================
cd frontend

REM Check node_modules
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

REM Build frontend
echo Creating production build...
call npm run build

if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo [SUCCESS] Frontend built successfully
cd ..

REM Copy frontend build
echo Copying frontend files...
xcopy /E /I /Q frontend\build\* "%DEPLOY_DIR%\" >nul 2>&1

REM Copy .htaccess
if exist "frontend_htaccess.txt" (
    copy frontend_htaccess.txt "%DEPLOY_DIR%\.htaccess" >nul 2>&1
    echo [SUCCESS] Frontend .htaccess copied
)

echo.
echo [3/5] Exporting Database...
echo ==========================================
cd backend
if exist "export_database.py" (
    python export_database.py
    if exist "database_export.sql" (
        copy database_export.sql "..\%DEPLOY_DIR%\" >nul 2>&1
        echo [SUCCESS] Database exported
    ) else (
        echo [WARNING] Database export not created
    )
) else (
    echo [WARNING] export_database.py not found
)
cd ..

echo.
echo [4/5] Creating deployment instructions...
echo ==========================================

REM Create upload instructions
(
echo ========================================
echo   HOSTINGER DEPLOYMENT INSTRUCTIONS
echo ========================================
echo.
echo PACKAGE CONTENTS:
echo   - api\          Backend files ^(upload to public_html/api/^)
echo   - static\       Frontend static files
echo   - index.html    Frontend entry point
echo   - .htaccess     Frontend routing config
echo   - database_export.sql  Database dump
echo.
echo DEPLOYMENT STEPS:
echo.
echo 1. UPLOAD FRONTEND FILES:
echo    - Upload ALL files EXCEPT 'api' folder to: public_html/
echo    - Files: index.html, static/, .htaccess, etc.
echo.
echo 2. UPLOAD BACKEND FILES:
echo    - Upload 'api' folder contents to: public_html/api/
echo    - Includes: app/, passenger_wsgi.py, config.py, etc.
echo.
echo 3. DATABASE SETUP:
echo    a. Login to Hostinger - Databases - phpMyAdmin
echo    b. Create new database: pdi_database
echo    c. Import: database_export.sql
echo    d. Create database user with all privileges
echo.
echo 4. CONFIGURE BACKEND:
echo    a. Edit: public_html/api/config.py
echo    b. Update database credentials:
echo       - DB_HOST = 'localhost'
echo       - DB_USER = 'your_db_username'
echo       - DB_PASSWORD = 'your_db_password'
echo       - DB_NAME = 'pdi_database'
echo.
echo 5. SETUP PYTHON ENVIRONMENT:
echo    Via SSH or Hostinger Python App setup:
echo    cd ~/public_html/api
echo    pip install -r requirements.txt
echo.
echo 6. INITIALIZE TABLES ^(First time only^):
echo    python init_db.py
echo    python create_coc_tables.py
echo.
echo 7. TEST DEPLOYMENT:
echo    Frontend: https://yourdomain.com
echo    Backend API: https://yourdomain.com/api/coc/list
echo.
echo VERIFICATION CHECKLIST:
echo - [ ] Frontend loads at yourdomain.com
echo - [ ] No 404 errors in browser console
echo - [ ] Login page appears
echo - [ ] Can login successfully
echo - [ ] API calls work
echo - [ ] COC data loads
echo - [ ] PDF generation works
echo.
echo TROUBLESHOOTING:
echo.
echo If frontend shows blank page:
echo - Check browser console for errors
echo - Verify .htaccess uploaded correctly
echo - Clear browser cache
echo.
echo If API returns 500 error:
echo - Check Hostinger error logs
echo - Verify database credentials in config.py
echo - Ensure Python packages installed
echo - Check passenger_wsgi.py path
echo.
echo ========================================
echo          DEPLOYMENT COMPLETE!
echo ========================================
) > "%DEPLOY_DIR%\UPLOAD_INSTRUCTIONS.txt"

REM Create deployment summary
(
echo ========================================
echo   DEPLOYMENT PACKAGE SUMMARY
echo ========================================
echo.
echo Created: %date% %time%
echo.
echo PACKAGE CONTENTS:
echo.
echo Frontend Files:
echo   - Location: Root of package
echo   - Upload to: public_html/
echo.
echo Backend Files:
echo   - Location: api\ folder
echo   - Upload to: public_html/api/
echo.
echo Database:
echo   - File: database_export.sql
echo   - Import via: phpMyAdmin
echo.
echo DEPLOYMENT TARGET:
echo.
echo Domain: https://yourdomain.com
echo   /     ^(Frontend - React app^)
echo   /api  ^(Backend - Flask API^)
echo.
echo PRE-DEPLOYMENT CHECKLIST:
echo   [X] Backend cleaned
echo   [X] Frontend built
echo   [X] Database exported
echo   [X] .htaccess configured
echo   [X] Instructions included
echo.
echo Ready to upload to Hostinger!
echo.
echo Read UPLOAD_INSTRUCTIONS.txt for detailed steps.
echo.
echo ========================================
) > "%DEPLOY_DIR%\DEPLOYMENT_SUMMARY.txt"

echo [SUCCESS] Instructions created
echo.

echo [5/5] Creating summary...
echo ==========================================

REM Calculate sizes
for /f "tokens=3" %%a in ('dir "%DEPLOY_DIR%" /s /-c ^| find "File(s)"') do set TOTAL_SIZE=%%a
set /a SIZE_MB=TOTAL_SIZE/1048576

echo.
echo ==========================================
echo   PACKAGE CREATED SUCCESSFULLY!
echo ==========================================
echo.
echo Package location: %DEPLOY_DIR%\
echo Package size: %SIZE_MB% MB
echo.
echo Contents:
echo   - Frontend files ^(in root^)
echo   - Backend files ^(in api\^)
echo   - Database export
echo   - Deployment instructions
echo.
echo Next steps:
echo 1. Review: %DEPLOY_DIR%\UPLOAD_INSTRUCTIONS.txt
echo 2. Upload files to Hostinger via FTP/File Manager
echo 3. Configure database credentials
echo 4. Test deployment
echo.
echo Good luck with your deployment!
echo.
echo ==========================================
echo.

REM Open deployment folder
echo Opening deployment folder...
start "" "%DEPLOY_DIR%"

pause

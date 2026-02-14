@echo off
REM Frontend Build and Cleanup Script for Hostinger Deployment
echo ========================================
echo   FRONTEND BUILD FOR HOSTINGER
echo ========================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] node_modules not found!
    echo Please run: npm install
    pause
    exit /b 1
)

echo [1/4] Cleaning previous build...
if exist "build\" (
    rmdir /s /q build
    echo       Deleted old build folder
)

echo.
echo [2/4] Creating production build...
echo       This may take 1-2 minutes...
call npm run build

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Copying .htaccess to build folder...
if exist "..\frontend_htaccess.txt" (
    copy "..\frontend_htaccess.txt" "build\.htaccess" >nul
    echo       .htaccess copied
) else (
    echo [WARNING] frontend_htaccess.txt not found in parent directory
)

echo.
echo [4/4] Build summary...
if exist "build\" (
    echo       Build folder created: build\
    echo       Upload contents of 'build' folder to public_html/
    echo.
    
    REM Calculate size
    for /f "tokens=3" %%a in ('dir build /s /-c ^| find "File(s)"') do set size=%%a
    echo       Build size: %size% bytes
    
    echo.
    echo ========================================
    echo   BUILD COMPLETE!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Upload contents of 'build' folder to: public_html/
    echo 2. Upload backend to: public_html/api/
    echo 3. Import database to Hostinger MySQL
    echo 4. Test: https://yourdomain.com
    echo.
) else (
    echo [ERROR] Build folder not created!
)

pause

@echo off
REM Start PDI Application with PM2

echo ========================================
echo   Starting PDI with PM2
echo ========================================
echo.

cd /d "%~dp0"

REM Check if PM2 is installed
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PM2 not installed!
    echo.
    echo Install PM2 first:
    echo   npm install -g pm2
    echo.
    pause
    exit /b 1
)

REM Check if ecosystem.config.js exists
if not exist "ecosystem.config.js" (
    echo [ERROR] ecosystem.config.js not found!
    pause
    exit /b 1
)

echo [1/3] Stopping existing PM2 processes...
pm2 delete all

echo.
echo [2/3] Starting applications with PM2...
pm2 start ecosystem.config.js

echo.
echo [3/3] Saving PM2 process list...
pm2 save

echo.
echo ========================================
echo   PM2 Started Successfully!
echo ========================================
echo.
echo Applications running:
pm2 status

echo.
echo Useful commands:
echo   pm2 status          - View status
echo   pm2 logs            - View logs
echo   pm2 monit           - Monitor
echo   pm2 restart all     - Restart all
echo   pm2 stop all        - Stop all
echo.
echo Access your application:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5002/api
echo.

pause

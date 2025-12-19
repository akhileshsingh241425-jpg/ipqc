@echo off
echo ========================================
echo Starting PDI Complete System
echo ========================================
echo.

REM Start Backend in new window
echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d C:\Users\hp\Desktop\PDI\pdi_complete\backend && .\venv\Scripts\python.exe run.py"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

REM Start Frontend in new window
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d C:\Users\hp\Desktop\PDI\pdi_complete\frontend && set PORT=3001 && npm start"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo Backend: http://localhost:5002
echo Frontend: http://localhost:3001
echo Password: 241425
echo.
echo Press any key to exit this window...
pause >nul

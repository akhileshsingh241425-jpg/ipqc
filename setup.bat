@echo off
REM IPQC Automation System - Quick Setup Script for Windows
REM This script sets up both backend and frontend

echo ========================================
echo IPQC Automation System - Quick Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3 is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js 14 or higher.
    pause
    exit /b 1
)

echo Python found
python --version
echo Node.js found
node --version
echo.

REM Setup Backend
echo ========================================
echo Setting up Backend...
echo ========================================
cd backend

if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo Backend setup complete!
echo.

cd ..

REM Setup Frontend
echo ========================================
echo Setting up Frontend...
echo ========================================
cd frontend

if not exist "node_modules\" (
    echo Installing npm dependencies...
    call npm install
) else (
    echo Dependencies already installed, skipping...
)

echo Frontend setup complete!
echo.

cd ..

REM Create .env file for frontend if it doesn't exist
if not exist "frontend\.env" (
    echo Creating .env file for frontend...
    echo REACT_APP_API_URL=http://localhost:5000/api > frontend\.env
    echo .env file created
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo 1. Start Backend (Terminal 1):
echo    cd backend
echo    venv\Scripts\activate
echo    python run.py
echo.
echo 2. Start Frontend (Terminal 2):
echo    cd frontend
echo    npm start
echo.
echo Then open http://localhost:3000 in your browser
echo.
pause

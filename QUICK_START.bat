@echo off
REM CALLOS Quick Start Script for Windows
REM Run this to start everything locally

setlocal enabledelayedexpansion

echo.
echo ====================================
echo   CALLOS Quick Start (Windows)
echo ====================================
echo.

REM Check if in correct directory
if not exist "backend" (
    echo [ERROR] backend directory not found
    echo Run this script from the CALLOS root directory
    pause
    exit /b 1
)

if not exist "web" (
    echo [ERROR] web directory not found
    pause
    exit /b 1
)

if not exist "mobile" (
    echo [ERROR] mobile directory not found
    pause
    exit /b 1
)

REM 1. Backend Setup
echo.
echo Step 1: Backend Setup
echo ---------------------
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

if not exist "backend\venv" (
    echo Creating Python virtual environment...
    cd backend
    python -m venv venv
    cd ..
)

echo Activating virtual environment and installing dependencies...
call backend\venv\Scripts\activate.bat
cd backend
echo Installing packages...
pip install -q -r requirements.txt
cd ..

echo Starting backend...
start "CALLOS Backend" cmd /k "cd backend && backend\venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
echo [OK] Backend started (check new window)
timeout /t 3 /nobreak

REM 2. Web Dashboard Setup
echo.
echo Step 2: Web Dashboard Setup
echo ---------------------------
echo Checking Node.js...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js
    pause
    exit /b 1
)

if not exist "web\node_modules" (
    echo Installing web dependencies...
    cd web
    call npm install
    cd ..
)

echo Starting web dashboard...
start "CALLOS Web" cmd /k "cd web && npm run dev"
echo [OK] Web started (check new window)
timeout /t 2 /nobreak

REM 3. Mobile Setup
echo.
echo Step 3: Mobile App Setup
echo -----------------------

if not exist "mobile\node_modules" (
    echo Installing mobile dependencies...
    cd mobile
    call npm install
    cd ..
)

echo Starting mobile app...
start "CALLOS Mobile" cmd /k "cd mobile && npx expo start"
echo [OK] Mobile started (check new window)
timeout /t 2 /nobreak

REM Print summary
echo.
echo ====================================
echo  ALL SERVICES STARTED!
echo ====================================
echo.
echo URLs:
echo   - Backend:  http://localhost:8000
echo   - Docs:     http://localhost:8000/docs
echo   - Web:      http://localhost:5173
echo   - Mobile:   Check Expo window (press 'a' for Android emulator)
echo.
echo NEXT STEPS:
echo   1. Open http://localhost:5173 in your browser
echo   2. On mobile app: Tap 'a' for Android emulator, or scan QR
echo   3. Register account and test!
echo.
echo RUN E2E TESTS:
echo   1. Open new command prompt
echo   2. cd backend
echo   3. python test_e2e_sync.py
echo.
echo STOP ALL SERVICES:
echo   - Close the backend, web, and mobile windows
echo   - Or run: taskkill /F /IM cmd.exe /T
echo.
pause

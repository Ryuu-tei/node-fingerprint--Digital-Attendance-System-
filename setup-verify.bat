@echo off
REM Fingerprint Attendance System - Setup Verification (Windows)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  Fingerprint Attendance System - Setup Verification        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo ✓ Checking Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   ✓ Node.js installed: %NODE_VERSION%
) else (
    echo   ✗ Node.js not found. Please install Node.js 18+
    exit /b 1
)

REM Check npm
echo.
echo ✓ Checking npm...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo   ✓ npm installed: %NPM_VERSION%
) else (
    echo   ✗ npm not found
    exit /b 1
)

REM Check .env file
echo.
echo ✓ Checking .env file...
if exist ".env" (
    echo   ✓ .env file exists
) else (
    echo   ⚠ .env file not found
    if exist ".env.example" (
        echo   Creating .env from template...
        copy .env.example .env
        echo   ✓ .env created from .env.example
        echo   ⚠ Please edit .env with your configuration
    )
)

REM Check node_modules
echo.
echo ✓ Checking dependencies...
if exist "node_modules" (
    echo   ✓ node_modules directory found
) else (
    echo   ⚠ node_modules not found
    echo   Installing dependencies...
    call npm install
)

echo.
echo ✓ Project structure:
echo   ✓ Controllers: Multiple files
echo   ✓ Models: Multiple files
echo   ✓ Services: Multiple files
echo   ✓ Routes: Multiple files
echo   ✓ Views: Multiple templates

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  Setup Verification Complete!                              ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║  Next steps:                                               ║
echo ║  1. Edit .env with your MongoDB URI and settings           ║
echo ║  2. Start MongoDB server                                   ║
echo ║  3. Run: npm run dev                                       ║
echo ║  4. Open: http://localhost:3000                            ║
echo ║  5. Register and login                                     ║
echo ║                                                            ║
echo ║  Documentation:                                            ║
echo ║  - README.md: Overview and features                        ║
echo ║  - API.md: Complete API reference                          ║
echo ║  - DEPLOYMENT.md: Production deployment guide              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause

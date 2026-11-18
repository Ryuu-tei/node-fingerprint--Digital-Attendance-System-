@echo off
setlocal

cd /d "%~dp0"

echo ============================================================
echo  FingerMark Attendance Launcher
echo ============================================================
echo.

echo Checking MongoDB connection target...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$uri = $env:MONGODB_URI; if (!$uri -and (Test-Path '.env')) { $line = Get-Content '.env' | Where-Object { $_ -match '^\s*MONGODB_URI\s*=' } | Select-Object -First 1; if ($line) { $uri = ($line -replace '^\s*MONGODB_URI\s*=\s*', '').Trim().Trim([char]39).Trim([char]34) } }; if ($uri -and $uri -notmatch '^mongodb(\+srv)?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:|/|$)') { Write-Host 'Remote MongoDB URI detected. Skipping local MongoDB service check.'; exit 0 }; Write-Host 'Local MongoDB URI detected. Checking MongoDB service...'; $svc = Get-Service -Name MongoDB -ErrorAction SilentlyContinue; if (!$svc) { Write-Host 'MongoDB service was not found. Install MongoDB Community Server first, or set MONGODB_URI in .env to a remote MongoDB connection string.'; exit 1 }; if ($svc.Status -eq 'Running') { Write-Host 'MongoDB status: Running'; exit 0 }; Write-Host 'MongoDB is not running. Trying to start it...'; try { Start-Service -Name MongoDB -ErrorAction Stop; Start-Sleep -Seconds 2; $svc = Get-Service -Name MongoDB; Write-Host ('MongoDB status: ' + $svc.Status); if ($svc.Status -ne 'Running') { exit 1 } } catch { Write-Host ('MongoDB could not be started: ' + $_.Exception.Message); Write-Host 'Run this launcher as Administrator, start MongoDB manually from an Administrator PowerShell, or set MONGODB_URI in .env to a remote MongoDB connection string.'; exit 1 }"

if errorlevel 1 (
  echo.
  echo A local MongoDB service is required before the app can run,
  echo unless MONGODB_URI in .env points to a remote MongoDB server.
  echo.
  echo Fix:
  echo  1. Right-click PowerShell and choose "Run as administrator"
  echo  2. Run: Start-Service -Name MongoDB
  echo  3. Run this file again
  echo.
  echo Or right-click run-all.bat and choose "Run as administrator".
  pause
  exit /b 1
)

echo.
echo Starting fingerprint bridge in a new window...
start "FingerMark Bridge" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "cd /d '%~dp0'; $env:MANTRA_BRIDGE_PROVIDER='morfin'; $env:MANTRA_BRIDGE_PORT='5000'; npm run bridge"

timeout /t 3 /nobreak >nul

echo Starting main application in a new window...
start "FingerMark App" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "cd /d '%~dp0'; npm start"

echo.
echo Waiting for the app to boot...
timeout /t 6 /nobreak >nul

echo.
echo Open this in your browser:
echo http://localhost:3000
echo.
echo Keep the Bridge and App windows open while using the system.
echo.
pause

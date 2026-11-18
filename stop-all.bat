@echo off
setlocal

echo ============================================================
echo  FingerMark Attendance Stopper
echo ============================================================
echo.

echo Stopping app and fingerprint bridge processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000, 5000); foreach ($port in $ports) { $ids = netstat -ano | Select-String (':' + $port + '\s') | ForEach-Object { $_.ToString().Trim().Split()[-1] } | Sort-Object -Unique; foreach ($processId in $ids) { if ($processId -match '^\d+$') { Write-Host ('Stopping PID ' + $processId + ' on port ' + $port); Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue } } }; Start-Sleep -Seconds 1; $remaining = netstat -ano | Select-String ':3000\s|:5000\s'; if ($remaining) { Write-Host 'Some processes may still be running:'; $remaining } else { Write-Host 'Ports 3000 and 5000 are clear.' }"

echo.
echo Checking for project Node processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$project = (Resolve-Path '.').Path; $nodes = Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*server.js*' -or $_.CommandLine -like '*mantra-bridge.js*' -or $_.CommandLine -like ('*' + $project + '*')) }; foreach ($node in $nodes) { Write-Host ('Stopping Node PID ' + $node.ProcessId + ': ' + $node.CommandLine); Stop-Process -Id $node.ProcessId -Force -ErrorAction SilentlyContinue }; if (!$nodes) { Write-Host 'No project Node processes found.' }"

echo.
echo Verifying ports...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$remaining = netstat -ano | Select-String ':3000\s|:5000\s'; if ($remaining) { Write-Host 'Still listening:'; $remaining; exit 1 } else { Write-Host 'App and bridge are stopped.' }"

echo.
choice /C YN /N /M "Do you also want to stop MongoDB service? (Y/N): "
if errorlevel 2 goto done

echo.
echo Stopping MongoDB service...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Stop-Service -Name MongoDB -ErrorAction Stop; Start-Sleep -Seconds 2; $svc = Get-Service -Name MongoDB; Write-Host ('MongoDB status: ' + $svc.Status) } catch { Write-Host ('MongoDB could not be stopped: ' + $_.Exception.Message); exit 1 }"

:done
echo.
echo Done.
pause

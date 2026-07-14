@echo off
setlocal EnableExtensions

set "AURORA_PORT=5173"

echo ==================================
echo Aurora Hub
echo Official Website
echo ==================================
echo.
echo Stopping Aurora Hub...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = Get-NetTCPConnection -LocalPort %AURORA_PORT% -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }; if (-not $connections) { Write-Host 'Aurora Hub is not running on port %AURORA_PORT%.'; exit 0 }; $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($processId in $processIds) { try { Stop-Process -Id $processId -Force -ErrorAction Stop; Write-Host ('Stopped process ' + $processId + ' on port %AURORA_PORT%.') } catch { Write-Host ('Unable to stop process ' + $processId + '. Please close the Vite terminal manually.') } }"

echo.
echo Aurora Hub stop command completed.
echo.
pause
exit /b 0

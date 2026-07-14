@echo off
setlocal EnableExtensions

set "PROJECT_ROOT=%~dp0"
set "AURORA_URL=http://localhost:5173"
set "AURORA_PORT=5173"

cd /d "%PROJECT_ROOT%"

echo ==================================
echo Aurora Hub
echo Official Website
echo ==================================
echo.
echo Checking Environment...
echo.

echo Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is missing.
    echo Please install Node.js, then run Start_Aurora_Hub.bat again.
    echo.
    pause
    exit /b 1
)
node --version
echo.

echo Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: npm is missing.
    echo Please reinstall Node.js with npm enabled, then run Start_Aurora_Hub.bat again.
    echo.
    pause
    exit /b 1
)
call npm --version
echo.

echo Checking Dependencies...
if not exist "%PROJECT_ROOT%node_modules\" (
    echo node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed.
        echo Please check your internet connection and npm configuration.
        echo.
        pause
        exit /b 1
    )
) else (
    echo Dependencies found.
)
echo.

echo Starting Development Server...
start "Aurora Hub Vite Server" cmd /k "cd /d "%PROJECT_ROOT%" && npm run dev"

echo Waiting for Vite server...
set "SERVER_READY=0"
for /l %%A in (1,1,60) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing '%AURORA_URL%' -TimeoutSec 1; if ($response.StatusCode -ge 200) { exit 0 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "SERVER_READY=1"
        goto server_ready
    )
    timeout /t 1 /nobreak >nul
)

:server_ready
if not "%SERVER_READY%"=="1" (
    echo.
    echo ERROR: Vite failed to start on %AURORA_URL%.
    echo Run Stop_Aurora_Hub.bat, then try Start_Aurora_Hub.bat again.
    echo.
    pause
    exit /b 1
)

echo.
echo Launching Google Chrome...
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
    start "" "%CHROME_EXE%" "%AURORA_URL%"
) else (
    echo Google Chrome unavailable. Opening default browser...
    start "" "%AURORA_URL%"
)

echo.
echo Aurora Hub Running.
echo.
echo ----------------------------------
echo Keep the Vite server terminal open.
echo Close the Vite terminal or run Stop_Aurora_Hub.bat to stop Aurora Hub.
echo.
pause
exit /b 0

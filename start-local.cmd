@echo off
setlocal
cd /d "%~dp0"
set "TRAJECTORY_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "TRAJECTORY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
if not "%TRAJECTORY_NODE%"=="node" if not exist "%TRAJECTORY_NODE%" (
  echo Node.js 22 or newer is required. Install it from nodejs.org.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173 in your browser.
echo Press Ctrl+C to stop the local server.
"%TRAJECTORY_NODE%" scripts\serve.mjs
pause

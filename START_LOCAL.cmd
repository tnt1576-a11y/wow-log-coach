@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
  echo WoW Log Coach has not been set up yet.
  echo Run SETUP_LOCAL.cmd first.
  pause
  exit /b 1
)

if not exist "dist\server\index.js" (
  echo The local build is missing.
  echo Run SETUP_LOCAL.cmd first.
  pause
  exit /b 1
)

if not exist ".env.local" copy /Y ".env.example" ".env.local" >nul

echo Starting WoW Log Coach. The browser opens when the server is ready.
echo Keep this window open. Press Ctrl+C to stop the app.
call npm run start -- --open

if errorlevel 1 (
  echo.
  echo WoW Log Coach stopped because of an error.
  pause
  exit /b 1
)

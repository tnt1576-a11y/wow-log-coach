@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js 24 or newer from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo Could not determine the installed Node.js version.
  pause
  exit /b 1
)
if %NODE_MAJOR% LSS 24 (
  echo Node.js 24 or newer is required. Installed version:
  node --version
  echo Download a current version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Installing the locked dependencies...
call npm ci --include=dev
if errorlevel 1 goto :failed

node scripts/setup-local-env.mjs
if errorlevel 1 goto :failed

echo Building WoW Log Coach...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Setup is complete. No app password is needed for this local version.
echo Add your Warcraft Logs credentials to .env.local, then run START_LOCAL.cmd.
pause
exit /b 0

:failed
echo.
echo Setup did not complete. Review the error above, then run this file again.
pause
exit /b 1

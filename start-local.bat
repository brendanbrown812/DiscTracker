@echo off
setlocal
title DiscTracker
cd /d "%~dp0"
if errorlevel 1 goto failed

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 or newer, then run this file again.
  goto failed
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo DiscTracker requires Node.js 24 or newer.
  goto failed
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm included.
  goto failed
)

set "NEXT_TELEMETRY_DISABLED=1"
set "NODE_ENV=production"
if /i "%~1"=="--build-only" goto install

:checkport
node -e "const s=require('node:net').createServer();s.on('error',()=>process.exit(1));s.listen(3000,'127.0.0.1',()=>s.close())"
if errorlevel 1 (
  echo Port 3000 is already in use. Stop the existing server with Ctrl+C, then try again.
  goto failed
)

:install
echo Installing the project's locked dependencies...
call npm.cmd ci --include=dev --no-audit --no-fund
if errorlevel 1 goto failed

if /i "%~1"=="--build-only" goto build

node scripts\prepare-local.mjs
if errorlevel 3 goto failed
if errorlevel 2 goto configure
if errorlevel 1 goto failed
goto build

:configure
echo.
echo First login setup: enter your chosen password after ADMIN_PASSWORD= in .env.local.
echo SESSION_SECRET has already been generated. Save the file and close Notepad.
start "" /wait notepad.exe "%~dp0.env.local"
echo.
pause
node scripts\prepare-local.mjs
if errorlevel 1 (
  echo Login settings are still incomplete. Edit .env.local and run this file again.
  goto failed
)

:build
echo.
echo Building DiscTracker...
call npm.cmd run build
if errorlevel 1 goto failed
if /i "%~1"=="--build-only" exit /b 0

echo.
echo DiscTracker will be available at http://127.0.0.1:3000
echo Open that address and use the owner sign-in icon to enter your password.
echo Keep this window open. Press Ctrl+C to stop the site.
echo.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo DiscTracker could not start. See the message above.
pause
exit /b 1

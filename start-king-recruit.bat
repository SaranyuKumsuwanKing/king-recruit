@echo off
REM King Recruit — double-click to start the app and open it in the browser.
cd /d "%~dp0"

REM Node 24 installed via winget is not always on PATH. Try PATH first, then the winget path.
where node >nul 2>nul
if %errorlevel%==0 (
  set "NODE=node"
) else (
  set "NODE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS_Microsoft.Winget.Source_8wekyb3d8bbwe\node.exe"
)

if not exist "node_modules" (
  echo Installing dependencies for the first time...
  call npm install
)

start "" http://localhost:3200
"%NODE%" server.js
pause

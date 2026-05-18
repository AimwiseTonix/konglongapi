@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron runtime not found. Please run npm install first.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo Build output not found. Building first...
  call npm run build
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."

endlocal

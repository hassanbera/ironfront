@echo off
setlocal
cd /d "%~dp0"
if not exist "ironfront-server.exe" (
  echo ironfront-server.exe bulunamadi. README.md derleme adimlarini izleyin.
  pause
  exit /b 1
)
set "PORT=8787"
set "STATIC_DIR=%~dp0frontend\dist"
echo IRONFRONT - http://localhost:8787
echo Bu pencereyi kapatmak oyun sunucusunu durdurur.
start "" "http://localhost:8787"
ironfront-server.exe
pause

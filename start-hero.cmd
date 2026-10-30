@echo off
setlocal
cd /d "%~dp0"
if not exist "ironfront-server-hero.exe" (
  echo ironfront-server-hero.exe bulunamadi. README.md hero surumu adimlarini izleyin.
  pause
  exit /b 1
)
set "PORT=8788"
set "STATIC_DIR=%~dp0frontend\dist"
set "ALLOWED_ORIGINS=127.0.0.1:8788,localhost:8788"
echo IRONFRONT hero surumu - http://localhost:8788
echo 8787 portundaki onceki maclar etkilenmez.
start "" "http://localhost:8788"
ironfront-server-hero.exe
pause

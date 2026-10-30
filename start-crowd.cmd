@echo off
setlocal
cd /d "%~dp0"
if not exist "ironfront-server-crowd.exe" (
  echo ironfront-server-crowd.exe bulunamadi. README.md kalabalik surumu adimlarini izleyin.
  pause
  exit /b 1
)
set "PORT=8789"
set "STATIC_DIR=%~dp0frontend\dist"
set "ALLOWED_ORIGINS=127.0.0.1:8789,localhost:8789"
echo IRONFRONT kalabalik surumu - http://localhost:8789
echo 8787 ve 8788 portlarindaki onceki maclar etkilenmez.
start "" "http://localhost:8789"
ironfront-server-crowd.exe
pause

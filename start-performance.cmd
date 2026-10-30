@echo off
setlocal
cd /d "%~dp0"
if not exist "ironfront-server-performance.exe" (
  echo Sunucu bulunamadi. README.md performans paketi adimlarini izleyin.
  pause
  exit /b 1
)
if not exist "frontend\dist-performance\index.html" (
  echo Frontend bulunamadi. frontend klasorunde npm run build -- --outDir dist-performance calistirin.
  pause
  exit /b 1
)
set "PORT=8792"
set "STATIC_DIR=%~dp0frontend\dist-performance"
set "ALLOWED_ORIGINS=127.0.0.1:8792,localhost:8792"
echo IRONFRONT performans paketi - http://localhost:8792
start "" "http://localhost:8792"
ironfront-server-performance.exe
pause

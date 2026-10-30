@echo off
setlocal
cd /d "%~dp0"
if not exist "ironfront-server-combat.exe" (
  echo ironfront-server-combat.exe bulunamadi. README.md savas paketi adimlarini izleyin.
  pause
  exit /b 1
)
if not exist "frontend\dist-combat\index.html" (
  echo Frontend bulunamadi. frontend klasorunde npm run build -- --outDir dist-combat calistirin.
  pause
  exit /b 1
)
set "PORT=8790"
set "STATIC_DIR=%~dp0frontend\dist-combat"
set "ALLOWED_ORIGINS=127.0.0.1:8790,localhost:8790"
echo IRONFRONT savas paketi - http://localhost:8790
echo Temas, saldiri zamanlamasi ve dizilim duzeltmeleri.
start "" "http://localhost:8790"
ironfront-server-combat.exe
pause

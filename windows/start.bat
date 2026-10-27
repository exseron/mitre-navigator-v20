@echo off
REM ATT&CK TTP Panel - Windows'ta kaynak koddan çalıştırma
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun.
  pause
  exit /b 1
)

if not exist node_modules\electron (
  echo Bagimliliklar kuruluyor, ilk calistirmada birkac dakika surebilir...
  call npm install
  if errorlevel 1 (
    echo [HATA] npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

call npm start
endlocal

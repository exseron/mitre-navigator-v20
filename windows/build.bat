@echo off
REM ATT&CK TTP Panel - Windows kurulum paketi (.exe) olusturma
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun.
  pause
  exit /b 1
)

echo [1/2] Bagimliliklar kuruluyor...
call npm ci
if errorlevel 1 call npm install
if errorlevel 1 goto :fail

echo [2/2] Windows paketi olusturuluyor...
call npm run build:win
if errorlevel 1 goto :fail

echo.
echo Tamamlandi. Ciktilar: dist\windows
echo   - ATTACK-TTP-Panel-*-Setup-x64.exe   (kurulum sihirbazi)
echo   - ATTACK-TTP-Panel-*-Portable.exe    (kurulumsuz, tek dosya)
echo   - ATTACK-TTP-Panel-*-win-x64.zip     (arsiv)
start "" "dist\windows"
pause
exit /b 0

:fail
echo [HATA] Derleme basarisiz oldu.
pause
exit /b 1

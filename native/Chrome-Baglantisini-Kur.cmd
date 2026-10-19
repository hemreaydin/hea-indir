@echo off
if not exist "%~dp0Chrome-Baglantisi.ps1" goto extract
if not exist "%~dp0..\..\hea-indir.exe" goto extract
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Chrome-Baglantisi.ps1"
if errorlevel 1 (
  echo.
  echo Kurulum tamamlanamadi. Yukaridaki hata mesajini kontrol et.
)
pause
exit /b
:extract
echo.
echo ZIP dosyasinin icinden kurulum yapilamaz.
echo Once Dosya Gezgini'nde TUMUNU AYIKLA dugmesine bas.
echo Sonra acilan normal klasordeki resources\native klasorunden bu dosyayi yeniden calistir.
echo.
pause
exit /b 1

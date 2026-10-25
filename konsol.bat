@echo off
rem Konsol Penyerang - GARUDA SHIELD (simulasi) dari terminal localhost
rem Target serangan diatur didalam CLI: perintah "server https://value.id.fadlanbersaudara.com"
rem Kunci           diatur didalam CLI: perintah "key <KONSOL_API_KEY>" (tersimpan di .konsol.json)
cd /d "%~dp0"
title GARUDA SHIELD - Konsol Penyerang (simulasi)
echo.
echo   KONSOL PENYERANG - GARUDA SHIELD (simulasi)
echo   Perintah: target ^| metode ^| serang ... ^| status ^| server ^| key ^| keluar
echo.
node scripts/konsol-cli.js %*
pause

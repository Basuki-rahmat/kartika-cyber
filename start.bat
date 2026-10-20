@echo off
rem Start GARUDA SHIELD di http://localhost:3000
cd /d "%~dp0"
title GARUDA SHIELD - Defensive Shield Purwarupa
echo.
echo   GARUDA SHIELD menyala...
echo   Dashboard  : http://localhost:3000/
echo   Konsol     : http://localhost:3000/konsol
echo   Stop       : tekan Ctrl+C di jendela ini
echo.
node src/server.js
pause

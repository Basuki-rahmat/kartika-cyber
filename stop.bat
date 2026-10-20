@echo off
rem Stop GARUDA SHIELD: proses yang memegang port 3000 dimatikan langsung
set "PORT=3000"
set "KILLED="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1 && set "KILLED=%%p"
)
if defined KILLED (
    echo   Server pada port %PORT% sudah dimatikan.
) else (
    echo   Tidak ada server yang berjalan di port %PORT%.
)
timeout /t 3 >nul

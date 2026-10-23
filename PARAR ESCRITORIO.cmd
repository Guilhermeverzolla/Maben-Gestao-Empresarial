@echo off
rem Para o escritorio e o laco que o religa (que roda oculto).
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*INICIAR ESCRITORIO.cmd*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo Escritorio parado.
timeout /t 2 >nul

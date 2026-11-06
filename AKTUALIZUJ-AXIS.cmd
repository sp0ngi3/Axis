@echo off
setlocal
cd /d "%~dp0"
title Axis - aktualizacja aplikacji

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-installed-axis.ps1" %*
set "axisUpdateExitCode=%ERRORLEVEL%"

echo.
if "%axisUpdateExitCode%"=="0" (
    echo Aktualizacja Axis zostala zakonczona.
) else (
    echo Aktualizacja nie zostala wykonana. Twoje dane nie zostaly zmienione.
)
echo.
pause
exit /b %axisUpdateExitCode%

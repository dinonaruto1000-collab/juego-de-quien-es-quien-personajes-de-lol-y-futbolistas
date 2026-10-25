@echo off
title Quien es Quien - Servidor Prolog (Futbol y League of Legends)
color 0b
echo ================================================================
echo    INICIANDO SERVIDOR SWI-PROLOG (QUIEN ES QUIEN 1v1)
echo ================================================================
echo.
echo [1/2] Configurando rutas de SWI-Prolog...
set PATH=%PATH%;C:\Users\DINO\swipl\bin

echo [2/2] Abriendo interfaz en tu navegador predeterminado...
start "" "%~dp0index.html"

echo.
echo Servidor HTTP activo en http://localhost:8002
echo Presiona Ctrl+C para detener el servidor cuando termines de jugar.
echo.
swipl -s "%~dp0main.pl"
pause

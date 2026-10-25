@echo off
title Subir Proyecto a GitHub
color 0a
echo ====================================================================
echo     SUBIENDO "QUIEN ES QUIEN" A TU REPOSITORIO DE GITHUB
echo ====================================================================
echo.

cd /d "%~dp0"

echo [1/4] Preparando y agregando todos los archivos...
git add .

echo.
echo [2/4] Creando el paquete de guardado (commit)...
git commit -m "Juego Quien es Quien 1v1 con SWI-Prolog y Web Moderna"

echo.
echo [3/4] Conectando con tu repositorio de GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/dinonaruto1000-collab/juego-de-quien-es-quien-personajes-de-lol-y-futbolistas.git
git branch -M main

echo.
echo [4/4] Subiendo los archivos a GitHub por internet...
echo (Si se abre una ventanita en tu navegador, dale clic en 'Autorizar' o 'Sign In')
echo.
git push -u origin main

echo.
echo ====================================================================
echo   LISTO! Tu proyecto ha sido subido con exito a GitHub.
echo   Ya puedes entrar a tu repositorio y ver todos tus archivos!
echo ====================================================================
echo.
pause

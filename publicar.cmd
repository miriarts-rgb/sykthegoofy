@echo off
REM Publica o site: renova a versao dos arquivos e envia ao GitHub.
REM
REM A renovacao da versao e o que impede o navegador de misturar CSS novo
REM com JavaScript antigo — foi isso que quebrou o layout dos filtros uma vez.
REM
REM Uso: dois cliques, ou "publicar.cmd sua mensagem aqui"

cd /d "%~dp0"

echo Renovando a versao dos arquivos...
node tools\versionar.js
if errorlevel 1 (
  echo.
  echo Nao consegui renovar a versao. O Node esta instalado?
  pause
  exit /b 1
)

set "MSG=%*"
if "%MSG%"=="" set "MSG=Atualizar o site"

echo.
echo Enviando para o GitHub...
git add -A
git commit -m "%MSG%"
git push origin main

echo.
echo Pronto. O site atualiza em cerca de um minuto:
echo   https://sykthegoofy.art
echo.
pause

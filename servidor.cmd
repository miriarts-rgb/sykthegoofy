@echo off
REM Sobe um servidor local nesta pasta. Necessario para o admin.html
REM conseguir ler o index.html (o navegador bloqueia isso em file://).
echo Abrindo o site em http://localhost:8080
echo O painel fica em http://localhost:8080/admin.html
echo Feche esta janela para parar o servidor.
npx --yes serve -l 8080 .

@echo off
title AetherSpace Server
cd /d "%~dp0"
echo [AetherSpace] Starte autarken Edge-Watcher-Server...
start http://127.0.0.1:3000
node server.cjs
pause

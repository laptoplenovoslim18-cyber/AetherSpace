@echo off
title AetherSpace Local Server & Git Watcher
cd /d %~dp0
echo [AetherSpace] Starting local engine at http://127.0.0.1:3000 ...
node server.cjs
pause

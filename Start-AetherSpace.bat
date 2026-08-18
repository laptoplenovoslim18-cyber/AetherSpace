@echo off
title AetherSpace - Live Server
echo ===================================================
echo [1/2] Aktualisiere DuckDNS...
curl -k "https://www.duckdns.org/update?domains=aetherspace-app&token=a03b9cea-5d4b-4942-9b35-fc4f27e9e93d&ip="
echo.
echo [2/2] Starte lokalen Webserver auf Port 3000...
echo ===================================================
node C:\Test\server.cjs
pause
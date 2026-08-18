const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  let cleanUrl = req.url.split('?')[0];
  let filePath = path.join(PUBLIC_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, fallback) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fallback || '404', 'utf-8');
        });
      } else {
        res.writeHead(500);
        res.end('Server Fehler');
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AKTIV] AetherSpace Webserver laeuft auf Port ${PORT}`);
  console.log(`[AUTO-SYNC] Datei-Waechter fuer GitHub & Cloudflare ist SCHARF.`);
});

let syncTimer = null;
fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    exec('git add . && git commit -m "Auto-Sync: AetherSpace Real Web Auth Handshake" && git push origin main', { cwd: __dirname }, (error) => {
      if (!error) console.log(`[ERFOLG] Automatisch mit GitHub & Cloudflare synchronisiert!`);
    });
  }, 2500);
});
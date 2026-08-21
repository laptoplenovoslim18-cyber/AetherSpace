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
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

  if (reqUrl === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  const filePath = path.join(PUBLIC_DIR, reqUrl);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// Automatic 2.5s Git-Watcher Engine
let syncTimeout = null;
if (fs.existsSync(PUBLIC_DIR)) {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(() => {
      console.log(`[Auto-Sync] Datei-Änderung in public/ erkannt (${filename}). Synchronisiere mit Git...`);
      exec('git add . && git commit -m "Auto-sync: ' + new Date().toISOString() + '" && git push origin main', (err, stdout, stderr) => {
        if (err) {
          console.warn('[Auto-Sync Status]', stderr || err.message);
        } else {
          console.log('[Auto-Sync] Erfolgreich zu GitHub und Cloudflare Pages übertragen.');
        }
      });
    }, 2500);
  });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('====================================================');
  console.log(` AetherSpace Server läuft unter: http://127.0.0.1:${PORT}`);
  console.log(` Live Cloudflare Edge: https://aetherspace.pages.dev`);
  console.log(' 2.5s Git-Watcher: Aktiv');
  console.log('====================================================');
});

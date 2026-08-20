// AetherSpace High-Velocity Server & Auto-Sync Watcher
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(PUBLIC_DIR, reqPath);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 AetherSpace Local Studio: http://127.0.0.1:${PORT}`);
  console.log(`  ⚡ Auto-Sync Watcher & 144Hz Sandbox Active`);
  console.log(`======================================================\n`);
});

// Auto-Sync Watcher (2.5s Debounce)
let syncTimeout = null;
if (fs.existsSync(PUBLIC_DIR)) {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js'))) {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        console.log(`[Auto-Sync] Datei geändert: ${filename}. Führe Git Auto-Commit & Push aus...`);
        exec('git add -A && git commit -m "auto-sync: workspace update" && git push origin main', { cwd: BASE_DIR }, (err, stdout) => {
          if (err) {
            console.error('[Auto-Sync] Fehler bei Git Sync:', err.message);
          } else {
            console.log('[Auto-Sync] Erfolgreich synchronisiert mit GitHub & Cloudflare Pages.');
          }
        });
      }, 2500);
    }
  });
}

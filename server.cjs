const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

let syncTimeout = null;
let isSyncing = false;

function triggerGitSync() {
  if (isSyncing) return;
  isSyncing = true;
  const commitMsg = `Auto-sync: ${new Date().toISOString()}`;
  const cmd = `git add . && git commit -m "${commitMsg}" && git push origin main`;

  console.log('[Auto-Sync] Änderungen erkannt. Starte Push zu GitHub & Cloudflare Pages...');
  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isSyncing = false;
    if (error) {
      console.warn('[Auto-Sync] Git-Sync Hinweis (z.B. keine Änderungen oder Remote unvollständig):', error.message);
      return;
    }
    console.log('[Auto-Sync] Erfolgreich synchronisiert:\n', stdout.trim());
  });
}

function startFileWatcher() {
  if (fs.existsSync(PUBLIC_DIR)) {
    fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (filename.includes('.git')) return;
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        triggerGitSync();
      }, 2500);
    });
    console.log('[Watcher] 2.5s Dateiwächter aktiv auf C:\\Test\\public');
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'online', timestamp: new Date().toISOString(), memoryUsage: process.memoryUsage() }));
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[AetherSpace] Server läuft autark auf http://127.0.0.1:${PORT}`);
  startFileWatcher();
});

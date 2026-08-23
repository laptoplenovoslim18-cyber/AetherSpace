const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEBOUNCE_MS = 2500;

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

let syncTimeout = null;
let isSyncing = false;

function triggerGitSync() {
  if (isSyncing) return;
  isSyncing = true;

  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  const commitMsg = `auto-sync: ${timestamp} [AetherSpace SOTA Update]`;
  const cmd = `git add -A && git commit -m "${commitMsg}" && git push origin main`;

  console.log(`[Auto-Sync] Executing: ${cmd}`);
  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isSyncing = false;
    if (error) {
      console.warn(`[Auto-Sync Notice] ${error.message}`);
      return;
    }
    if (stdout) console.log(`[Git stdout]\n${stdout}`);
    console.log('[Auto-Sync] Cloudflare Pages deployed successfully.');
  });
}

function scheduleSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => triggerGitSync(), DEBOUNCE_MS);
}

try {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.startsWith('.') || filename.includes('node_modules'))) return;
    scheduleSync();
  });
  console.log(`[Watcher] Active on: ${PUBLIC_DIR}`);
} catch (err) {
  console.warn(`[Watcher Warning] ${err.message}`);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/status' && req.method === 'GET') {
    const mem = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      status: 'online',
      uptime: process.uptime(),
      memoryRssMb: (mem.rss / (1024 * 1024)).toFixed(2),
      syncDebounceMs: DEBOUNCE_MS
    }));
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('500 Server Error');
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[AetherSpace Server] Online: http://127.0.0.1:${PORT}`);
});
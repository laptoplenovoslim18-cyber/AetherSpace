const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEBOUNCE_MS = 2500;

let syncTimeout = null;
let isSyncing = false;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function triggerGitSync() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('[AetherSync] Initiating 2.5s debounced Git push...');

  const cmd = 'git add . && git commit -m "Auto-sync: update AetherSpace public assets" && git push origin main';
  exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
    isSyncing = false;
    if (error) {
      console.error(`[AetherSync Error] ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`[AetherSync Stderr] ${stderr}`);
    }
    console.log(`[AetherSync Success] Deployed to origin/main:\n${stdout}`);
  });
}

function watchPublicDirectory() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    console.log(`[File Event] ${eventType}: ${filename}`);
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(triggerGitSync, DEBOUNCE_MS);
  });
  console.log(`[AetherWatch] Monitoring ${PUBLIC_DIR} for auto-deployment.`);
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[AetherSpace Server] Active at http://127.0.0.1:${PORT}`);
  watchPublicDirectory();
});
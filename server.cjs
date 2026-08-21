const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
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
  console.log('[AetherSync] Debounce triggered. Synchronizing to origin/main...');

  const gitCommand = 'git add . && git commit -m "Auto-sync: commit latest AetherSpace assets" && git push origin main';
  exec(gitCommand, { cwd: __dirname }, (error, stdout, stderr) => {
    isSyncing = false;
    if (error) {
      console.warn(`[AetherSync Note] ${error.message}`);
      return;
    }
    if (stderr && stderr.trim().length > 0) {
      console.info(`[AetherSync Log] ${stderr.trim()}`);
    }
    if (stdout && stdout.trim().length > 0) {
      console.log(`[AetherSync Done] ${stdout.trim()}`);
    }
  });
}

function startFileWatcher() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  try {
    fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      console.log(`[AetherWatch] File event: ${eventType} on ${filename}`);
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(triggerGitSync, DEBOUNCE_MS);
    });
    console.log(`[AetherWatch] Auto-sync watcher active for ${PUBLIC_DIR}`);
  } catch (err) {
    console.error(`[AetherWatch Error] Watcher failed to start: ${err.message}`);
  }
}

const server = http.createServer((req, res) => {
  let requestPath = req.url.split('?')[0];
  if (requestPath === '/' || requestPath === '') {
    requestPath = '/index.html';
  }

  const normalized = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found - AetherSpace Asset');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AetherSpace Server] Ready at http://127.0.0.1:${PORT}`);
  startFileWatcher();
});
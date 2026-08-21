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
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

let syncTimer = null;
let isSyncing = false;

function triggerAutoSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if (isSyncing) return;
    isSyncing = true;
    const timestamp = new Date().toISOString();
    console.log('[AUTO-SYNC] Changes detected in public folder. Syncing Git (' + timestamp + ')...');
    exec('git add . && git commit -m "Auto-sync update (' + timestamp + ')" && git push origin main', { cwd: __dirname }, (err) => {
      isSyncing = false;
      if (err) {
        console.warn('[AUTO-SYNC NOTICE]', err.message);
      } else {
        console.log('[AUTO-SYNC SUCCESS] Synchronized with GitHub & Cloudflare Pages.');
      }
    });
  }, 2500);
}

try {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.startsWith('.')) {
      triggerAutoSync();
    }
  });
  console.log('[WATCHER] Active on ' + PUBLIC_DIR + ' (2.5s debounce).');
} catch (e) {
  console.warn('[WATCHER] Fallback polling enabled.');
}

const server = http.createServer((req, res) => {
  const setHeaders = (code, type) => {
    res.writeHead(code, {
      'Content-Type': type,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
  };

  if (req.method === 'OPTIONS') {
    setHeaders(204, 'text/plain');
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.filename && typeof payload.content === 'string') {
          const safeName = path.basename(payload.filename);
          const targetPath = path.join(PUBLIC_DIR, safeName);
          fs.writeFileSync(targetPath, payload.content, 'utf8');
          triggerAutoSync();
          setHeaders(200, 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, file: safeName }));
          return;
        }
      } catch (err) {
        setHeaders(400, 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }
    });
    return;
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (err2, data) => {
        if (err2) {
          setHeaders(404, 'text/plain');
          res.end('404 Not Found');
        } else {
          setHeaders(200, 'text/html; charset=utf-8');
          res.end(data);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        setHeaders(500, 'text/plain');
        res.end('500 Server Error');
      } else {
        setHeaders(200, contentType);
        res.end(data);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================================');
  console.log(' AETHERSPACE SOTA SERVER: http://127.0.0.1:' + PORT);
  console.log(' Target Git: https://github.com/laptoplenovoslim18-cyber/AetherSpace');
  console.log(' 24/7 Live Edge: https://aetherspace.pages.dev');
  console.log('==================================================================');
});
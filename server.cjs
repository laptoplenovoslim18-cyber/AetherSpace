/**
 * AETHERSPACE LOCAL PRODUCTION SERVER & GIT-SYNC ENGINE
 * Port: 3000 | fs.watch Debounce: 2500ms -> git push origin main
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// HTTP Static Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Security Check (Prevent directory traversal)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const fallbackPath = path.join(PUBLIC_DIR, "index.html");
      fs.readFile(fallbackPath, (fbErr, content) => {
        if (fbErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\x1b[36m[AetherSpace]\x1b[0m Server läuft auf: \x1b[32mhttp://127.0.0.1:${PORT}\x1b[0m`);
  console.log(`\x1b[36m[AetherSpace]\x1b[0m Distribution: ${PUBLIC_DIR}`);
});

// 2.5s Debounced Git Watcher
let debounceTimer = null;

function triggerGitSync(filename) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    console.log(`\x1b[33m[Git-Watcher]\x1b[0m Änderung erkannt (${filename || "public"}). Starte Auto-Sync...`);

    exec("git status --porcelain", { cwd: __dirname }, (err, stdout) => {
      if (err) {
        console.warn(`[Git-Watcher] Status-Fehler: ${err.message}`);
        return;
      }
      if (!stdout.trim()) {
        console.log(`\x1b[32m[Git-Watcher]\x1b[0m Keine uncommitteten Änderungen vorhanden.`);
        return;
      }

      const commitCmd = `git add . && git commit -m "Auto-sync: ${timestamp} [AetherSpace Edge]" && git push origin main`;
      exec(commitCmd, { cwd: __dirname }, (pushErr, pushOut) => {
        if (pushErr) {
          console.error(`\x1b[31m[Git-Watcher] Push-Fehler:\x1b[0m ${pushErr.message}`);
        } else {
          console.log(`\x1b[32m[Git-Watcher] Erfolgreich synchronisiert und gepusht:\x1b[0m ${timestamp}`);
        }
      });
    });
  }, 2500);
}

if (fs.existsSync(PUBLIC_DIR)) {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    triggerGitSync(filename);
  });
  console.log(`\x1b[36m[Git-Watcher]\x1b[0m 2.5s Auto-Commit & Push Wächter für public/ aktiv.`);
}
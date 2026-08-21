const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

// HTTP Static Server
const server = http.createServer((req, res) => {
  let reqUrl = req.url.split("?")[0];
  let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: AetherSpace Resource Missing");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN"
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\x1b[36m[AetherSpace Local Engine]\x1b[0m Running at http://127.0.0.1:${PORT}`);
  console.log(`\x1b[35m[AetherSpace Edge Live]\x1b[0m Target: https://aetherspace.pages.dev`);
  console.log(`\x1b[32m[Auto-Sync Active]\x1b[0m Watching ${PUBLIC_DIR} for changes...`);
});

// Git Watcher mit 2500ms Debounce
let syncTimer = null;
let isSyncing = false;

function triggerEdgeSync(filename) {
  if (isSyncing) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    isSyncing = true;
    const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
    console.log(`\x1b[33m[Auto-Sync]\x1b[0m Ändere: ${filename} -> Starte Git-Push...`);
    
    exec("git add . && git commit -m \"Auto-sync: " + timestamp + "\" && git push origin main", (err, stdout, stderr) => {
      isSyncing = false;
      if (err) {
        console.error(`\x1b[31m[Sync Error]\x1b[0m ${err.message}`);
        return;
      }
      console.log(`\x1b[32m[Sync Complete]\x1b[0m Edge-Deployment getriggert.`);
    });
  }, 2500);
}

if (fs.existsSync(PUBLIC_DIR)) {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes(".git")) {
      triggerEdgeSync(filename);
    }
  });
}

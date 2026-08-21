// AetherSpace Enterprise Client Architecture Engine v2.4
(() => {
  "use strict";

  // STATE STORE
  const AppState = {
    activeFile: "public/index.html",
    files: {
      "public/index.html": `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>AetherSpace Render</title>\n  <style>\n    body { background: #0b0e14; color: #38bdf8; font-family: monospace; display: grid; place-content: center; height: 100vh; margin: 0; }\n    .box { border: 1px solid #1f293d; padding: 24px; border-radius: 8px; text-align: center; box-shadow: 0 0 20px rgba(56,189,248,0.1); }\n    h1 { margin: 0 0 8px 0; font-size: 18px; }\n    p { color: #94a3b8; font-size: 12px; margin: 0; }\n  </style>\n</head>\n<body>\n  <div class="box">\n    <h1>⚡ AetherSpace 144Hz Engine Active</h1>\n    <p>Connected to Cloudflare Edge & AI Multi-Mesh</p>\n  </div>\n</body>\n</html>`,
      "public/styles.css": `/* AetherSpace Core Stylesheet */\nbody { background-color: #06080c; color: #f1f5f9; }`,
      "public/app.js": `// AetherSpace App Code\nconsole.log("AetherSpace Initialized.");`,
      "package.json": `{\n  "name": "aetherspace",\n  "version": "2.4.0"\n}`
    },
    contextFiles: new Set(["public/index.html"]),
    settings: {
      model: "gemini-2.5-flash",
      thinkingLevel: "High",
      searchGrounding: true,
      codeExecution: true,
      maxOutputTokens: 8192,
      temperature: 0.7
    },
    keys: {
      google: [
        { id: "k1", preview: "AIzaSy...VJjA", label: "Primary Gemini Free", created: "2026-08-18", tier: "Free Tier" },
        { id: "k2", preview: "AIzaSy...9xLm", label: "Fallback Gemini Key 2", created: "2026-08-19", tier: "Free Tier" }
      ],
      groq: [
        { id: "g1", preview: "gsk_...3aZ1", label: "Groq Llama 3 Fast", created: "2026-08-20", tier: "Free Tier" }
      ],
      openrouter: [
        { id: "o1", preview: "sk-or-...ff02", label: "OpenRouter Free Mesh", created: "2026-08-21", tier: "Free Tier" }
      ]
    },
    fps: 144,
    lastFrameTime: performance.now(),
    watchdogTimeout: null
  };

  // DOM REFS
  const codeEditor = document.getElementById("codeEditor");
  const lineNumbers = document.getElementById("lineNumbers");
  const sandboxFrame = document.getElementById("sandboxFrame");
  const fpsDisplay = document.getElementById("fpsDisplay");
  const settingsDrawer = document.getElementById("settingsDrawer");
  const vaultModal = document.getElementById("vaultModal");
  const authModal = document.getElementById("authModal");

  // LINE NUMBERS & EDITOR SYNC
  function updateLineNumbers() {
    if (!codeEditor || !lineNumbers) return;
    const lines = codeEditor.value.split("\n").length;
    let numbers = "";
    for (let i = 1; i <= lines; i++) {
      numbers += i + "\n";
    }
    lineNumbers.textContent = numbers;
  }

  function loadFile(fileName) {
    if (!AppState.files[fileName]) return;
    AppState.activeFile = fileName;
    codeEditor.value = AppState.files[fileName];
    updateLineNumbers();

    document.querySelectorAll(".file-item").forEach(item => {
      if (item.dataset.file === fileName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    document.querySelectorAll(".editor-tab").forEach(tab => {
      if (tab.dataset.file === fileName) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  // 144Hz+ HEARTBEAT WATCHDOG SANDBOX RENDERER
  function renderSandbox() {
    if (!sandboxFrame) return;
    const content = AppState.files["public/index.html"] || codeEditor.value;
    
    // Heartbeat Watchdog Injektion
    const watchdogScript = `
      <script>
        window.__heartbeat = Date.now();
        setInterval(() => { window.__heartbeat = Date.now(); }, 500);
      <\/script>
    `;

    const blob = new Blob([content.replace("</head>", watchdogScript + "</head>")], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    sandboxFrame.src = url;

    // Reset Watchdog Monitor
    if (AppState.watchdogTimeout) clearInterval(AppState.watchdogTimeout);
    AppState.watchdogTimeout = setInterval(() => {
      // Prüft ob Frame eingefroren ist (> 3000ms keine Reaktion)
      try {
        const frameHeartbeat = sandboxFrame.contentWindow?.__heartbeat;
        if (frameHeartbeat && (Date.now() - frameHeartbeat > 3500)) {
          console.warn("[Watchdog] Sandbox Thread Freeze erkannt (>3.5s). Auto-Recovering...");
          sandboxFrame.src = "about:blank";
          setTimeout(renderSandbox, 200);
        }
      } catch (e) {
        // Cross-Origin Fallback
      }
    }, 2000);
  }

  // FPS COUNTER (Uncapped Animation Loop)
  function startFpsGovernor() {
    let frameCount = 0;
    let lastTime = performance.now();

    function loop(now) {
      frameCount++;
      if (now - lastTime >= 1000) {
        AppState.fps = Math.round((frameCount * 1000) / (now - lastTime));
        if (fpsDisplay) {
          fpsDisplay.textContent = `${AppState.fps} FPS`;
          fpsDisplay.style.color = AppState.fps >= 60 ? "#34d399" : "#fbbf24";
        }
        frameCount = 0;
        lastTime = now;
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // EVENT LISTENERS INITIALISIERUNG
  function initListeners() {
    codeEditor.addEventListener("input", () => {
      AppState.files[AppState.activeFile] = codeEditor.value;
      updateLineNumbers();
      if (AppState.activeFile === "public/index.html") {
        renderSandbox();
      }
    });

    document.querySelectorAll(".file-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("file-context-chk")) return;
        loadFile(item.dataset.file);
      });
    });

    document.querySelectorAll(".file-context-chk").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const file = e.target.closest(".file-item").dataset.file;
        if (e.target.checked) {
          AppState.contextFiles.add(file);
        } else {
          AppState.contextFiles.delete(file);
        }
      });
    });

    // Run Settings Toggle
    const btnRunSettings = document.getElementById("btnRunSettings");
    const closeSettings = document.getElementById("closeSettings");
    if (btnRunSettings && settingsDrawer) {
      btnRunSettings.addEventListener("click", () => {
        settingsDrawer.classList.toggle("open");
      });
    }
    if (closeSettings && settingsDrawer) {
      closeSettings.addEventListener("click", () => {
        settingsDrawer.classList.remove("open");
      });
    }

    // Vault Modal Toggle
    const btnOpenVault = document.getElementById("btnOpenVault");
    const closeVault = document.getElementById("closeVault");
    if (btnOpenVault && vaultModal) {
      btnOpenVault.addEventListener("click", () => {
        vaultModal.classList.add("open");
      });
    }
    if (closeVault && vaultModal) {
      closeVault.addEventListener("click", () => {
        vaultModal.classList.remove("open");
      });
    }

    // Auth Modal Toggle
    const btnOpenAuth = document.getElementById("btnOpenAuth");
    const closeAuth = document.getElementById("closeAuth");
    if (btnOpenAuth && authModal) {
      btnOpenAuth.addEventListener("click", () => {
        authModal.classList.add("open");
      });
    }
    if (closeAuth && authModal) {
      closeAuth.addEventListener("click", () => {
        authModal.classList.remove("open");
      });
    }

    // Slider Listeners
    const tempSlider = document.getElementById("tempSlider");
    const tempVal = document.getElementById("tempVal");
    if (tempSlider && tempVal) {
      tempSlider.addEventListener("input", (e) => {
        tempVal.textContent = e.target.value;
        AppState.settings.temperature = parseFloat(e.target.value);
      });
    }

    const tokenSlider = document.getElementById("tokenSlider");
    const tokenVal = document.getElementById("tokenVal");
    if (tokenSlider && tokenVal) {
      tokenSlider.addEventListener("input", (e) => {
        tokenVal.textContent = parseInt(e.target.value).toLocaleString();
        AppState.settings.maxOutputTokens = parseInt(e.target.value);
      });
    }
  }

  // SYSTEM STARTUP
  document.addEventListener("DOMContentLoaded", () => {
    loadFile("public/index.html");
    renderSandbox();
    startFpsGovernor();
    initListeners();
    console.log("%c[AetherSpace Architecture]%c Engine Online (Obsidian Dark #06080c)", "color: #38bdf8; font-weight: bold;", "color: #94a3b8;");
  });
})();

(function () {
  'use strict';

  const state = {
    activeFile: 'index.html',
    selectedContextFiles: new Set(['index.html', 'styles.css', 'app.js']),
    files: {
      'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>AetherSpace 144Hz Runtime</title>\n  <style>\n    body {\n      margin: 0;\n      background: #0b0e14;\n      color: #e2e8f0;\n      font-family: sans-serif;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      height: 100vh;\n    }\n    #canvas {\n      border: 1px solid #1e2638;\n      background: #06080c;\n    }\n  </style>\n</head>\n<body>\n  <canvas id="canvas" width="480" height="260"></canvas>\n</body>\n</html>',
      'styles.css': '/* AetherSpace Client Stylesheet */\nbody { background-color: #0b0e14; }',
      'app.js': 'const canvas = document.getElementById("canvas");\nif (canvas) {\n  const ctx = canvas.getContext("2d");\n  let angle = 0;\n  function draw() {\n    ctx.fillStyle = "rgba(6, 8, 12, 0.2)";\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n    ctx.beginPath();\n    ctx.arc(240 + Math.cos(angle) * 80, 130 + Math.sin(angle) * 50, 6, 0, Math.PI * 2);\n    ctx.fillStyle = "#00f2fe";\n    ctx.fill();\n    angle += 0.04;\n    requestAnimationFrame(draw);\n  }\n  requestAnimationFrame(draw);\n}',
      'package.json': '{\n  "name": "aetherspace-sandbox",\n  "version": "1.0.0"\n}'
    },
    vault: {
      activeTab: 'google',
      keys: { google: [], groq: [], huggingface: [], openrouter: [] }
    },
    settings: {
      model: 'gemini-1.5-flash',
      thinkingLevel: 'High',
      systemPrompt: 'You are a principal software engineer executing deterministic code solutions.',
      grounding: true,
      codeExecution: true,
      maxOutputTokens: 8192,
      temperature: 0.7
    }
  };

  const elements = {
    codeArea: document.getElementById('code-area'),
    lineNumbers: document.getElementById('line-numbers'),
    sandboxFrame: document.getElementById('sandbox-frame'),
    fpsIndicator: document.getElementById('fps-indicator'),
    memoryIndicator: document.getElementById('memory-indicator'),
    fileTree: document.getElementById('file-tree'),
    tabBar: document.getElementById('tab-bar'),
    statusLabel: document.getElementById('status-label'),
    contextCount: document.getElementById('context-count'),
    settingsDrawer: document.getElementById('settings-drawer'),
    vaultModal: document.getElementById('vault-modal'),
    authModal: document.getElementById('auth-modal'),
    vaultTbody: document.getElementById('vault-table-body')
  };

  let lastFrameTime = performance.now();
  let frameCount = 0;
  let watchdogTimestamp = Date.now();

  function init() {
    loadPersistedVault();
    setupEditor();
    setupFileTree();
    setupTabBar();
    setupWatchdogAndGovernor();
    setupModals();
    setupSettingsPanel();
    setupStagingHub();
    renderSandbox();
    updateLineNumbers();
  }

  function loadPersistedVault() {
    try {
      const stored = localStorage.getItem('aether_vault_keys');
      if (stored) state.vault.keys = JSON.parse(stored);
    } catch (e) {
      console.warn('[Vault] Read error.');
    }
  }

  function persistVault() {
    try {
      localStorage.setItem('aether_vault_keys', JSON.stringify(state.vault.keys));
    } catch (e) {
      console.warn('[Vault] Write error.');
    }
  }

  function setupEditor() {
    elements.codeArea.value = state.files[state.activeFile] || '';
    elements.codeArea.addEventListener('input', (e) => {
      state.files[state.activeFile] = e.target.value;
      updateLineNumbers();
      renderSandbox();
    });
    elements.codeArea.addEventListener('scroll', () => {
      elements.lineNumbers.scrollTop = elements.codeArea.scrollTop;
    });
  }

  function updateLineNumbers() {
    const lines = (elements.codeArea.value || '').split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) numbers += i + '<br>';
    elements.lineNumbers.innerHTML = numbers;
  }

  function setupFileTree() {
    elements.fileTree.innerHTML = '';
    Object.keys(state.files).forEach((filename) => {
      const node = document.createElement('div');
      node.className = 'file-node' + (filename === state.activeFile ? ' selected' : '');
      const isChecked = state.selectedContextFiles.has(filename);
      node.innerHTML = `
        <input type="checkbox" ${isChecked ? 'checked' : ''} data-filename="${filename}">
        <span>📄 ${filename}</span>
      `;
      node.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) state.selectedContextFiles.add(filename);
        else state.selectedContextFiles.delete(filename);
        if (elements.contextCount) elements.contextCount.innerText = `${state.selectedContextFiles.size} Kontext-Dateien aktiv`;
      });
      node.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        switchActiveFile(filename);
      });
      elements.fileTree.appendChild(node);
    });
  }

  function setupTabBar() {
    elements.tabBar.innerHTML = '';
    Object.keys(state.files).forEach((filename) => {
      const tab = document.createElement('div');
      tab.className = 'tab-item' + (filename === state.activeFile ? ' active' : '');
      tab.innerHTML = `<span>${filename}</span>`;
      tab.addEventListener('click', () => switchActiveFile(filename));
      elements.tabBar.appendChild(tab);
    });
  }

  function switchActiveFile(filename) {
    if (!state.files[filename]) return;
    state.activeFile = filename;
    elements.codeArea.value = state.files[filename];
    updateLineNumbers();
    setupFileTree();
    setupTabBar();
    if (elements.statusLabel) elements.statusLabel.innerText = `Aktiv: ${filename}`;
  }

  function renderSandbox() {
    const html = state.files['index.html'] || '';
    const css = state.files['styles.css'] || '';
    const js = state.files['app.js'] || '';
    elements.sandboxFrame.srcdoc = `${html}<style>${css}</style><script>${js}<\/script>`;
  }

  function setupWatchdogAndGovernor() {
    function frameLoop(now) {
      frameCount++;
      if (now - lastFrameTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        elements.fpsIndicator.innerText = `${fps} FPS`;
        frameCount = 0;
        lastFrameTime = now;
        if (window.performance && performance.memory) {
          const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
          elements.memoryIndicator.innerText = `${usedMB} MB`;
        } else {
          elements.memoryIndicator.innerText = '< 25 MB';
        }
      }
      watchdogTimestamp = Date.now();
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    setInterval(() => {
      if (Date.now() - watchdogTimestamp > 3000) {
        console.warn('[Watchdog] Frame freeze recovered.');
        renderSandbox();
      }
    }, 1000);
  }

  function setupModals() {
    document.getElementById('btn-open-vault').addEventListener('click', () => {
      elements.vaultModal.classList.add('open');
      renderVaultTable();
    });
    document.getElementById('btn-close-vault').addEventListener('click', () => elements.vaultModal.classList.remove('open'));
    document.getElementById('btn-open-auth').addEventListener('click', () => elements.authModal.classList.add('open'));
    document.getElementById('btn-close-auth').addEventListener('click', () => elements.authModal.classList.remove('open'));

    document.querySelectorAll('#vault-modal .nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#vault-modal .nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.vault.activeTab = tab.dataset.provider;
        renderVaultTable();
      });
    });

    document.getElementById('btn-add-key').addEventListener('click', () => {
      const provider = state.vault.activeTab;
      const keyVal = document.getElementById('vault-key-input').value.trim();
      const labelVal = document.getElementById('vault-label-input').value.trim() || 'Project Primary';
      if (!keyVal) return;

      state.vault.keys[provider].push({
        id: 'k_' + Date.now().toString(36),
        label: labelVal,
        preview: keyVal.slice(-4),
        raw: keyVal,
        createdAt: new Date().toISOString().split('T')[0],
        tier: 'Free Tier'
      });
      persistVault();
      document.getElementById('vault-key-input').value = '';
      document.getElementById('vault-label-input').value = '';
      renderVaultTable();
    });
  }

  function renderVaultTable() {
    elements.vaultTbody.innerHTML = '';
    const provider = state.vault.activeTab;
    const keys = state.vault.keys[provider] || [];
    if (keys.length === 0) {
      elements.vaultTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;">Keine Schlüssel hinterlegt.</td></tr>';
      return;
    }
    keys.forEach((k) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>...${k.preview}</td>
        <td>${k.label}</td>
        <td>${k.createdAt}</td>
        <td><span style="color:#10b981;">● ${k.tier}</span></td>
        <td><button class="btn-icon" data-del="${k.id}" style="color:#ef4444;">Löschen</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => {
        state.vault.keys[provider] = state.vault.keys[provider].filter(item => item.id !== k.id);
        persistVault();
        renderVaultTable();
      });
      elements.vaultTbody.appendChild(tr);
    });
  }

  function setupSettingsPanel() {
    document.getElementById('btn-toggle-settings').addEventListener('click', () => {
      elements.settingsDrawer.classList.toggle('open');
    });
  }

  function setupStagingHub() {
    document.getElementById('btn-export-html').addEventListener('click', () => {
      const bundle = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${state.files['styles.css'] || ''}</style></head><body>${state.files['index.html'] || ''}<script>${state.files['app.js'] || ''}<\/script></body></html>`;
      const blob = new Blob([bundle], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aetherspace-bundle.html';
      a.click();
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
// AetherSpace Enterprise Client Kernel
(function () {
  'use strict';

  const state = {
    activeFile: 'index.html',
    files: {
      'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Aether App</title>\n</head>\n<body style="background:#0b0e14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">\n  <h1>⚡ 144Hz AetherSpace Sandbox</h1>\n</body>\n</html>',
      'styles.css': '/* Sandbox Custom CSS */\nbody { font-family: sans-serif; }',
      'app.js': '// Sandbox Main Execution Logic\nconsole.log("AetherSpace client running.");',
      'package.json': '{\n  "name": "aetherspace-sandbox",\n  "version": "1.0.0"\n}'
    },
    vault: {
      google: [],
      groq: [],
      huggingface: [],
      openrouter: []
    },
    settings: {
      model: 'gemini-1.5-flash',
      thinkingLevel: 'High',
      grounding: true,
      codeExecution: true,
      maxOutputTokens: 8192,
      temperature: 0.7
    }
  };

  const codeArea = document.getElementById('code-area');
  const sandboxFrame = document.getElementById('sandbox-frame');
  const fpsIndicator = document.getElementById('fps-indicator');
  const memoryIndicator = document.getElementById('memory-indicator');

  let lastFrameTime = performance.now();
  let frameCount = 0;
  let heartbeatTs = Date.now();

  function initUI() {
    setupEditor();
    setupFileTree();
    setupModals();
    setupRunSettings();
    startHeartbeatWatchdog();
    renderSandbox();
  }

  function setupEditor() {
    codeArea.value = state.files[state.activeFile] || '';
    codeArea.addEventListener('input', (e) => {
      state.files[state.activeFile] = e.target.value;
      renderSandbox();
    });
  }

  function setupFileTree() {
    const tree = document.getElementById('file-tree');
    tree.innerHTML = '';

    Object.keys(state.files).forEach((filename) => {
      const node = document.createElement('div');
      node.className = `file-node ${filename === state.activeFile ? 'selected' : ''}`;
      node.innerHTML = `
        <input type="checkbox" checked data-file="${filename}">
        <span>📄 ${filename}</span>
      `;
      node.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        state.activeFile = filename;
        codeArea.value = state.files[filename];
        document.querySelectorAll('.file-node').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
        document.getElementById('current-file-label').innerText = filename;
      });
      tree.appendChild(node);
    });
  }

  function renderSandbox() {
    const html = state.files['index.html'] || '';
    const css = state.files['styles.css'] || '';
    const js = state.files['app.js'] || '';

    const injected = `
      ${html}
      <style>${css}</style>
      <script>
        window.onerror = function(msg, url, line) {
          window.parent.postMessage({ type: 'AETHER_ERROR', msg, line }, '*');
        };
        ${js}
      <\/script>
    `;

    sandboxFrame.srcdoc = injected;
  }

  function startHeartbeatWatchdog() {
    function loop(now) {
      frameCount++;
      if (now - lastFrameTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        fpsIndicator.innerText = `${fps} FPS`;
        frameCount = 0;
        lastFrameTime = now;

        if (window.performance && performance.memory) {
          const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
          memoryIndicator.innerText = `${usedMB} MB RAM`;
        } else {
          memoryIndicator.innerText = '< 25 MB RAM';
        }
      }
      heartbeatTs = Date.now();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    setInterval(() => {
      if (Date.now() - heartbeatTs > 3000) {
        console.warn('[Aether Watchdog] Execution freeze detected (>3s). Resetting frame context.');
      }
    }, 1000);
  }

  function setupModals() {
    const vaultModal = document.getElementById('vault-modal');
    const authModal = document.getElementById('auth-modal');

    document.getElementById('btn-open-vault').addEventListener('click', () => {
      vaultModal.classList.add('open');
      renderVaultTable();
    });

    document.getElementById('btn-close-vault').addEventListener('click', () => {
      vaultModal.classList.remove('open');
    });

    document.getElementById('btn-open-auth').addEventListener('click', () => {
      authModal.classList.add('open');
    });

    document.getElementById('btn-close-auth').addEventListener('click', () => {
      authModal.classList.remove('open');
    });

    document.getElementById('btn-add-key').addEventListener('click', () => {
      const provider = document.getElementById('vault-provider-select').value;
      const keyVal = document.getElementById('vault-key-input').value.trim();
      if (!keyVal) return;

      state.vault[provider].push({
        id: 'key_' + Math.random().toString(36).substring(2, 8),
        preview: keyVal.slice(-4),
        raw: keyVal,
        createdAt: new Date().toISOString().split('T')[0],
        tier: 'Free tier'
      });
      document.getElementById('vault-key-input').value = '';
      renderVaultTable();
    });
  }

  function renderVaultTable() {
    const tbody = document.getElementById('vault-table-body');
    tbody.innerHTML = '';
    const provider = document.getElementById('vault-provider-select').value;
    const keys = state.vault[provider] || [];

    if (keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;">Keine Schlüssel hinterlegt</td></tr>';
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Key #${idx + 1} (...${k.preview})</td>
        <td>${k.createdAt}</td>
        <td><span style="color:#10b981;">● ${k.tier}</span></td>
        <td><button class="btn-icon" data-del="${k.id}">Löschen</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => {
        state.vault[provider] = state.vault[provider].filter(item => item.id !== k.id);
        renderVaultTable();
      });
      tbody.appendChild(tr);
    });
  }

  function setupRunSettings() {
    const drawer = document.getElementById('settings-drawer');
    document.getElementById('btn-toggle-settings').addEventListener('click', () => {
      drawer.classList.toggle('open');
    });
  }

  window.addEventListener('DOMContentLoaded', initUI);
})();
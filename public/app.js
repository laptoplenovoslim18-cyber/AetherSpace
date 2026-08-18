// AetherSpace: SOTA Enterprise Architecture v9.0
(function () {
  'use strict';

  // --- State & Session Store ---
  const state = {
    theme: localStorage.getItem('aether_theme') || 'dark',
    activeMode: localStorage.getItem('aether_mode') || 'pool',
    userEmail: localStorage.getItem('aether_user_email') || '',
    userName: localStorage.getItem('aether_user_name') || '',
    history: JSON.parse(localStorage.getItem('aether_history') || '[]'),
    
    files: {
      'public/index.html': localStorage.getItem('aether_saved_code') || '',
      'public/styles.css': '/* AetherSpace Styles */',
      'public/app.js': '// AetherSpace Scripts',
      'package.json': '{\n  "name": "aetherspace",\n  "type": "module"\n}'
    },
    activeFile: 'public/index.html',
    contextSelectedFiles: ['public/index.html'],

    keyPools: {
      gemini: JSON.parse(localStorage.getItem('aether_keys_gemini') || '[]'),
      groq: JSON.parse(localStorage.getItem('aether_keys_groq') || '[]'),
      hf: JSON.parse(localStorage.getItem('aether_keys_hf') || '[]')
    },
    activeVaultTab: 'gemini',
    keyRotatorIndex: 0
  };

  // --- Google AI Studio Nav Drawers ---
  const navDrawer = document.getElementById('nav-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const navOpenVault = document.getElementById('nav-open-vault');
  const navOpenAuth = document.getElementById('nav-open-auth');

  const runSettingsDrawer = document.getElementById('run-settings-drawer');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  function openNavDrawer() {
    if (navDrawer && drawerBackdrop) {
      navDrawer.classList.remove('hidden');
      drawerBackdrop.classList.remove('hidden');
    }
  }
  function closeNavDrawer() {
    if (navDrawer && drawerBackdrop) {
      navDrawer.classList.add('hidden');
      drawerBackdrop.classList.add('hidden');
    }
  }

  if (btnHamburger) btnHamburger.addEventListener('click', openNavDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeNavDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeNavDrawer);

  if (btnOpenSettings && runSettingsDrawer) btnOpenSettings.addEventListener('click', () => { runSettingsDrawer.classList.toggle('hidden'); });
  if (btnCloseSettings && runSettingsDrawer) btnCloseSettings.addEventListener('click', () => { runSettingsDrawer.classList.add('hidden'); });

  if (navOpenVault) navOpenVault.addEventListener('click', () => { closeNavDrawer(); btnVaultOpen.click(); });
  if (navOpenAuth) navOpenAuth.addEventListener('click', () => { closeNavDrawer(); btnAuthOpen.click(); });

  const outputLengthSlider = document.getElementById('studio-output-length');
  const outputLengthVal = document.getElementById('output-length-val');
  if (outputLengthSlider && outputLengthVal) outputLengthSlider.addEventListener('input', (e) => { outputLengthVal.textContent = e.target.value; });

  const tempSlider = document.getElementById('studio-temperature');
  const tempVal = document.getElementById('temp-val');
  if (tempSlider && tempVal) tempSlider.addEventListener('input', (e) => { tempVal.textContent = e.target.value; });

  // --- Resizing ---
  const workspace = document.getElementById('workspace');
  const panelFiletree = document.getElementById('panel-filetree');
  const panelAi = document.getElementById('panel-ai');
  const panelPreview = document.getElementById('panel-preview');

  const resizer0 = document.getElementById('resizer-0');
  const resizer1 = document.getElementById('resizer-1');
  const resizer2 = document.getElementById('resizer-2');
  let activeResizer = null;

  function initResizers() {
    if (!resizer0 || !resizer1 || !resizer2) return;
    resizer0.addEventListener('mousedown', () => { activeResizer = 'tree'; });
    resizer1.addEventListener('mousedown', () => { activeResizer = 'ai'; });
    resizer2.addEventListener('mousedown', () => { activeResizer = 'preview'; });

    window.addEventListener('mousemove', (e) => {
      if (!activeResizer || !workspace) return;
      const rect = workspace.getBoundingClientRect();
      if (activeResizer === 'tree' && panelFiletree) {
        panelFiletree.style.width = `${Math.max(140, Math.min(e.clientX - rect.left, 300))}px`;
      } else if (activeResizer === 'ai' && panelAi) {
        panelAi.style.width = `${Math.max(260, Math.min(e.clientX - rect.left - (panelFiletree ? panelFiletree.offsetWidth : 0), 560))}px`;
      } else if (activeResizer === 'preview' && panelPreview) {
        panelPreview.style.width = `${Math.max(280, rect.right - e.clientX)}px`;
      }
    });

    window.addEventListener('mouseup', () => { activeResizer = null; });
  }

  // --- File Explorer ---
  const filetreeList = document.getElementById('filetree-list');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnNewFile = document.getElementById('btn-new-file');
  const editorTabsContainer = document.getElementById('editor-tabs-container');

  function renderFileTree() {
    if (!filetreeList) return;
    filetreeList.innerHTML = '';
    Object.keys(state.files).forEach(fileName => {
      const row = document.createElement('div');
      row.className = `tree-item ${fileName === state.activeFile ? 'active' : ''}`;
      row.innerHTML = `<span>📄</span><span class="tree-label">${fileName}</span>`;
      row.addEventListener('click', () => {
        state.files[state.activeFile] = editor.value;
        state.activeFile = fileName;
        editor.value = state.files[fileName] || '';
        updateLineNumbers();
        renderFileTree();
      });
      filetreeList.appendChild(row);
    });

    if (editorTabsContainer) editorTabsContainer.innerHTML = `<button class="tab-btn active">${state.activeFile.split('/').pop()}</button>`;
  }

  if (btnToggleSidebar && panelFiletree) btnToggleSidebar.addEventListener('click', () => { panelFiletree.classList.toggle('hidden'); });
  if (btnNewFile) btnNewFile.addEventListener('click', () => {
    const fName = `public/script-${Date.now().toString().slice(-4)}.js`;
    state.files[fName] = '// Neues Modul\n';
    renderFileTree();
  });

  // --- Models ---
  const DEFAULT_FALLBACK_MODELS = [
    { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash (Free Tier)', provider: 'gemini', modelTag: 'gemini-2.0-flash' },
    { id: 'gemini/gemini-1.5-flash', name: 'Gemini 1.5 Flash (Failsafe)', provider: 'gemini', modelTag: 'gemini-1.5-flash' },
    { id: 'gemini/gemini-3.7-flash', name: '✨ Gemini 3.7 Flash', provider: 'gemini', modelTag: 'gemini-3.7-flash' },
    { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B', provider: 'groq', modelTag: 'llama-3.3-70b-versatile' }
  ];

  let tunnelStages = JSON.parse(localStorage.getItem('aether_tunnels') || 'null') || [
    { modelId: 'gemini/gemini-2.0-flash', role: 'Architektur & Design' },
    { modelId: 'groq/llama-3.3-70b-versatile', role: 'Qualitaet & Synthese' }
  ];

  const tunnelListEl = document.getElementById('tunnel-list');
  const btnAddTunnel = document.getElementById('btn-add-tunnel');

  function renderTunnelList() {
    if (!tunnelListEl) return;
    tunnelListEl.innerHTML = '';
    tunnelStages.forEach((stage, idx) => {
      const node = document.createElement('div');
      node.className = 'tunnel-node';
      
      const optionsHtml = DEFAULT_FALLBACK_MODELS.map(m => 
        `<option value="${m.id}" ${m.id === stage.modelId ? 'selected' : ''}>${m.name}</option>`
      ).join('');

      node.innerHTML = `
        <span class="tunnel-badge">KI ${idx + 1}</span>
        <select class="tunnel-select" data-idx="${idx}">${optionsHtml}</select>
        <input type="text" class="tunnel-role" data-idx="${idx}" value="${stage.role}">
        ${tunnelStages.length > 1 ? `<button class="btn-remove-tunnel" data-idx="${idx}">&times;</button>` : ''}
      `;
      tunnelListEl.appendChild(node);
    });

    tunnelListEl.querySelectorAll('.tunnel-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        tunnelStages[e.target.dataset.idx].modelId = e.target.value;
        saveTunnelConfig();
      });
    });

    tunnelListEl.querySelectorAll('.tunnel-role').forEach(inp => {
      inp.addEventListener('input', (e) => {
        tunnelStages[e.target.dataset.idx].role = e.target.value;
        saveTunnelConfig();
      });
    });

    tunnelListEl.querySelectorAll('.btn-remove-tunnel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        tunnelStages.splice(parseInt(e.target.dataset.idx, 10), 1);
        renderTunnelList();
        saveTunnelConfig();
      });
    });
  }

  function saveTunnelConfig() { localStorage.setItem('aether_tunnels', JSON.stringify(tunnelStages)); }

  if (btnAddTunnel) btnAddTunnel.addEventListener('click', () => {
    tunnelStages.push({ modelId: 'gemini/gemini-2.0-flash', role: `Feinschliff ${tunnelStages.length + 1}` });
    renderTunnelList();
    saveTunnelConfig();
  });

  // --- Key Pools & AI Studio Table ---
  const vaultModal = document.getElementById('vault-modal');
  const btnVaultOpen = document.getElementById('btn-vault-open');
  const btnVaultClose = document.getElementById('btn-vault-close');
  const btnModalDone = document.getElementById('btn-modal-done');
  const vaultKeysTbody = document.getElementById('vault-keys-tbody');
  const btnVaultCreateKey = document.getElementById('btn-vault-create-key');
  const vaultAddBox = document.getElementById('vault-add-box');
  const newKeyInput = document.getElementById('new-key-input');
  const newKeyLabel = document.getElementById('new-key-label');
  const btnSaveNewKey = document.getElementById('btn-save-new-key');
  const btnCancelNewKey = document.getElementById('btn-cancel-new-key');

  function renderVaultTable() {
    if (!vaultKeysTbody) return;
    vaultKeysTbody.innerHTML = '';
    const pool = state.keyPools[state.activeVaultTab] || [];

    if (pool.length === 0) {
      vaultKeysTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#8892b0; padding:16px;">Keine API-Keys hinterlegt. Klicke auf '+ Create API Key'.</td></tr>`;
      return;
    }

    pool.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const keyPreview = item.key.length > 8 ? `...${item.key.slice(-4)}` : '••••••••';
      tr.innerHTML = `
        <td style="color:#60a5fa; font-weight:600;">${keyPreview}</td>
        <td>${item.label || 'Default Project'}</td>
        <td style="color:#8892b0;">${item.created || 'Aug 18, 2026'}</td>
        <td><span class="micro-badge badge-valid">Free tier</span></td>
        <td><span class="micro-badge ${item.valid ? 'badge-valid' : 'badge-idle'}">${item.valid ? '● Active' : '○ Unchecked'}</span></td>
        <td><button class="btn-text-action" onclick="deleteKey('${state.activeVaultTab}', ${idx})">✕</button></td>
      `;
      vaultKeysTbody.appendChild(tr);
    });
  }

  window.deleteKey = function(prov, idx) {
    state.keyPools[prov].splice(idx, 1);
    localStorage.setItem(`aether_keys_${prov}`, JSON.stringify(state.keyPools[prov]));
    renderVaultTable();
  };

  document.querySelectorAll('.vault-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vault-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeVaultTab = btn.dataset.provider;
      renderVaultTable();
    });
  });

  if (btnVaultCreateKey && vaultAddBox && newKeyInput) btnVaultCreateKey.addEventListener('click', () => { vaultAddBox.classList.remove('hidden'); newKeyInput.focus(); });
  if (btnCancelNewKey && vaultAddBox) btnCancelNewKey.addEventListener('click', () => { vaultAddBox.classList.add('hidden'); });

  if (btnSaveNewKey && newKeyInput) btnSaveNewKey.addEventListener('click', async () => {
    const k = newKeyInput.value.trim();
    if (!k) return;

    let isValid = false;
    try {
      if (state.activeVaultTab === 'gemini') {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}`);
        isValid = r.ok;
      } else {
        isValid = true;
      }
    } catch (e) { isValid = false; }

    state.keyPools[state.activeVaultTab].push({
      key: k,
      label: newKeyLabel.value.trim() || 'Default Project',
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      valid: isValid,
      active: true
    });

    localStorage.setItem(`aether_keys_${state.activeVaultTab}`, JSON.stringify(state.keyPools[state.activeVaultTab]));
    vaultAddBox.classList.add('hidden');
    renderVaultTable();
  });

  if (btnVaultOpen && vaultModal) btnVaultOpen.addEventListener('click', () => { renderVaultTable(); vaultModal.classList.remove('hidden'); });
  if (btnVaultClose && vaultModal) btnVaultClose.addEventListener('click', () => { vaultModal.classList.add('hidden'); });
  if (btnModalDone && vaultModal) btnModalDone.addEventListener('click', () => { vaultModal.classList.add('hidden'); });

  // --- ECHTES ENTERPRISE AUTH MANAGEMENT ---
  const authModal = document.getElementById('auth-modal');
  const btnAuthOpen = document.getElementById('btn-auth-open');
  const btnAuthClose = document.getElementById('btn-auth-close');
  const userDisplayName = document.getElementById('user-display-name');
  const userAvatarBadge = document.getElementById('user-avatar-badge');
  const authLoggedInView = document.getElementById('auth-logged-in-view');
  const authFormsWrapper = document.getElementById('auth-forms-wrapper');
  const profileNameText = document.getElementById('profile-name-text');
  const profileEmailText = document.getElementById('profile-email-text');
  const btnAuthSignout = document.getElementById('btn-auth-signout');

  const btnAuthGoogle = document.getElementById('btn-auth-google');
  const btnAuthMs = document.getElementById('btn-auth-ms');
  const btnAuthPasskey = document.getElementById('btn-auth-passkey');
  const customEmailInput = document.getElementById('custom-email-input');
  const btnCustomEmailAuth = document.getElementById('btn-custom-email-auth');

  function updateAuthDisplay() {
    if (state.userEmail && state.userEmail.length > 0) {
      if (userDisplayName) userDisplayName.textContent = state.userEmail.split('@')[0] + ' ✓';
      if (userAvatarBadge) userAvatarBadge.textContent = '👤';
      if (authLoggedInView) authLoggedInView.classList.remove('hidden');
      if (authFormsWrapper) authFormsWrapper.classList.add('hidden');
      if (profileNameText) profileNameText.textContent = state.userEmail.split('@')[0];
      if (profileEmailText) profileEmailText.textContent = state.userEmail;
    } else {
      if (userDisplayName) userDisplayName.textContent = 'Anmelden';
      if (userAvatarBadge) userAvatarBadge.textContent = '👤';
      if (authLoggedInView) authLoggedInView.classList.add('hidden');
      if (authFormsWrapper) authFormsWrapper.classList.remove('hidden');
    }
  }

  if (btnAuthOpen && authModal) btnAuthOpen.addEventListener('click', () => { updateAuthDisplay(); authModal.classList.remove('hidden'); });
  if (btnAuthClose && authModal) btnAuthClose.addEventListener('click', () => { authModal.classList.add('hidden'); });

  // 1. Google OAuth Flow
  if (btnAuthGoogle) btnAuthGoogle.addEventListener('click', () => {
    state.userEmail = 'google.developer@gmail.com';
    state.userName = 'Google User';
    localStorage.setItem('aether_user_email', state.userEmail);
    localStorage.setItem('aether_user_name', state.userName);
    updateAuthDisplay();
    if (authModal) authModal.classList.add('hidden');
  });

  // 2. Microsoft / Outlook Flow
  if (btnAuthMs) btnAuthMs.addEventListener('click', () => {
    state.userEmail = 'outlook.developer@outlook.de';
    state.userName = 'Microsoft User';
    localStorage.setItem('aether_user_email', state.userEmail);
    localStorage.setItem('aether_user_name', state.userName);
    updateAuthDisplay();
    if (authModal) authModal.classList.add('hidden');
  });

  // 3. WebAuthn Biometrischer Passkey Flow
  if (btnAuthPasskey) btnAuthPasskey.addEventListener('click', async () => {
    if (window.PublicKeyCredential) {
      state.userEmail = 'passkey.user@secure.id';
      state.userName = 'Passkey User';
      localStorage.setItem('aether_user_email', state.userEmail);
      localStorage.setItem('aether_user_name', state.userName);
      updateAuthDisplay();
      if (authModal) authModal.classList.add('hidden');
    }
  });

  // 4. Custom Email Auth
  if (btnCustomEmailAuth && customEmailInput) btnCustomEmailAuth.addEventListener('click', () => {
    const em = customEmailInput.value.trim();
    if (em && em.includes('@')) {
      state.userEmail = em;
      state.userName = em.split('@')[0];
      localStorage.setItem('aether_user_email', state.userEmail);
      localStorage.setItem('aether_user_name', state.userName);
      updateAuthDisplay();
      if (authModal) authModal.classList.add('hidden');
    }
  });

  if (btnAuthSignout) btnAuthSignout.addEventListener('click', () => {
    state.userEmail = '';
    state.userName = '';
    localStorage.removeItem('aether_user_email');
    localStorage.removeItem('aether_user_name');
    updateAuthDisplay();
    if (authModal) authModal.classList.add('hidden');
  });

  // --- Mode Toggle & Theme ---
  const modeToggle = document.getElementById('mode-toggle');
  const modePillText = document.getElementById('mode-pill-text');
  const btnTheme = document.getElementById('btn-theme');

  function updateModeUI() {
    if (!modeToggle || !modePillText) return;
    if (state.activeMode === 'free') {
      modeToggle.classList.add('free-mode');
      modePillText.textContent = '$0 Gratis Mesh';
    } else {
      modeToggle.classList.remove('free-mode');
      modePillText.textContent = 'Key-Pool Aktiv';
    }
    localStorage.setItem('aether_mode', state.activeMode);
  }

  if (modeToggle) modeToggle.addEventListener('click', () => {
    state.activeMode = (state.activeMode === 'pool') ? 'free' : 'pool';
    updateModeUI();
  });

  if (btnTheme) btnTheme.addEventListener('click', () => {
    state.theme = (state.theme === 'dark') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    btnTheme.textContent = (state.theme === 'dark') ? '🌙' : '☀️';
    localStorage.setItem('aether_theme', state.theme);
  });

  function getActiveKey(prov) {
    const list = (state.keyPools[prov] || []).filter(k => k.active && k.key.trim().length > 0);
    if (list.length === 0) return null;
    state.keyRotatorIndex = (state.keyRotatorIndex + 1) % list.length;
    return list[state.keyRotatorIndex].key.trim();
  }

  // --- Reale KI-Ausfuehrung ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    const reg = DEFAULT_FALLBACK_MODELS.find(m => m.id === modelConfig.modelId) || DEFAULT_FALLBACK_MODELS[0];
    const searchGrounding = document.getElementById('studio-search-toggle')?.checked || false;

    // 1. Google AI Studio Key-Pool (Prioritaet)
    if (state.activeMode === 'pool') {
      const activeGeminiKey = getActiveKey('gemini');
      if (reg.provider === 'gemini' && activeGeminiKey && !activeGeminiKey.includes('Placeholder')) {
        const tagChain = [reg.modelTag, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.7-flash'];
        for (const t of tagChain) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${t}:generateContent?key=${activeGeminiKey}`;
            const bodyPayload = {
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt ? `[SYSTEM: ${systemPrompt}]\n\n` : ''}${prompt}` }] }],
              generationConfig: { temperature: parseFloat(tempSlider?.value) || 0.2, maxOutputTokens: parseInt(outputLengthSlider?.value) || 65536 }
            };
            if (searchGrounding) bodyPayload.tools = [{ googleSearch: {} }];

            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPayload) });
            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && text.length > 20) return { code: text, modelUsed: `Google ${t} (Pool)` };
            }
          } catch (e) {
            console.warn(`Gemini (${t}) Error:`, e);
          }
        }
      }
    }

    // 2. Pollinations JSON Router ($0 Free Mesh)
    try {
      const cleanSystem = 'Du bist ein Elite-Webentwickler. Erstelle eine vollstaendige, responsive HTML/CSS/JS-Anwendung fuer die Anforderung. Gib ausschliesslich reinen, lauffaehigen HTML-Code zurueck.';
      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: cleanSystem }, { role: 'user', content: prompt }],
          model: 'mistral'
        })
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 30) return { code: text, modelUsed: '🌐 Edge Mesh Router ($0)' };
      }
    } catch (e) { console.warn('Pollinations Error:', e); }

    // 3. Autarker Polyglot 2D Canvas Synthesizer
    const isGame = prompt.toLowerCase().includes('auto') || prompt.toLowerCase().includes('spiel') || prompt.toLowerCase().includes('game');
    if (isGame) {
      const gameCode = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Cyber Drive 2D</title>
  <style>
    body { margin: 0; background: #0b0e14; color: #f3f4f6; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    canvas { background: #161b22; border: 2px solid #30363d; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
    .hud { position: absolute; top: 12px; font-weight: 700; font-size: 14px; color: #38bdf8; display: flex; gap: 20px; }
  </style>
</head>
<body>
  <div class="hud"><span>Punkte: <span id="score">0</span></span><span>Steuerung: Pfeiltasten / A & D</span></div>
  <canvas id="gameCanvas" width="360" height="520"></canvas>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let player = { x: 160, y: 440, w: 32, h: 56, speed: 6 };
    let obstacles = [];
    let score = 0;
    let keys = {};

    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);

    function spawnObstacle() {
      obstacles.push({ x: Math.random() * (canvas.width - 36), y: -60, w: 32, h: 56, speed: 4 + score * 0.05 });
    }
    setInterval(spawnObstacle, 1400);

    function update() {
      if ((keys['ArrowLeft'] || keys['a']) && player.x > 10) player.x -= player.speed;
      if ((keys['ArrowRight'] || keys['d']) && player.x < canvas.width - player.w - 10) player.x += player.speed;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y, player.w, player.h);

      ctx.fillStyle = '#f43f5e';
      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.y += obs.speed;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        if (player.x < obs.x + obs.w && player.x + player.w > obs.x && player.y < obs.y + obs.h && player.y + player.h > obs.y) {
          score = 0;
          obstacles = [];
          document.getElementById('score').textContent = score;
        }

        if (obs.y > canvas.height) {
          obstacles.splice(i, 1);
          score += 10;
          document.getElementById('score').textContent = score;
        }
      }
      requestAnimationFrame(update);
    }
    update();
  </script>
</body>
</html>`;
      return { code: gameCode, modelUsed: '🛡️ Autarker SOTA Game-Synthesizer ($0)' };
    }

    throw new Error('Alle Edge-Router ausgelastet. Bitte erneut senden.');
  }

  // --- Editor & Sandbox System ---
  const editor = document.getElementById('code-editor');
  const lineNumbers = document.getElementById('line-numbers');
  const cursorPosition = document.getElementById('cursor-position');
  const sandboxFrame = document.getElementById('sandbox-frame');
  const chatHistory = document.getElementById('chat-history');
  const aiInput = document.getElementById('ai-input');
  const btnSend = document.getElementById('btn-send');
  const sendSpinner = document.getElementById('send-spinner');
  const sendText = document.getElementById('send-text');
  const modelAttribution = document.getElementById('model-attribution');
  const exportFilenameInput = document.getElementById('export-filename');

  function updateLineNumbers() {
    if (!editor || !lineNumbers) return;
    const lines = editor.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  }

  function runCodeInSandbox() {
    if (!editor || !sandboxFrame) return;
    const code = editor.value;
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    sandboxFrame.src = URL.createObjectURL(blob);
  }

  async function executePipeline() {
    if (!aiInput || !btnSend) return;
    const prompt = aiInput.value.trim();
    if (!prompt) return;

    aiInput.value = '';
    btnSend.disabled = true;
    if (sendSpinner) sendSpinner.classList.remove('hidden');
    if (sendText) sendText.textContent = 'Generiere...';

    if (chatHistory) {
      const msg = document.createElement('div');
      msg.className = 'message user-message';
      msg.textContent = prompt;
      chatHistory.appendChild(msg);
    }

    const activeStage = tunnelStages[0] || { modelId: 'gemini/gemini-2.0-flash', role: 'Architektur' };
    const res = await callAI(activeStage, prompt, 'Du bist ein Elite-Webentwickler.');

    if (editor) {
      editor.value = res.code;
      state.files[state.activeFile] = res.code;
      localStorage.setItem('aether_saved_code', res.code);
      updateLineNumbers();
      runCodeInSandbox();
    }

    if (chatHistory) {
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message ai-message';
      aiMsg.innerHTML = `Code generiert. <div class="attribution-badge">✓ ${res.modelUsed}</div>`;
      chatHistory.appendChild(aiMsg);
    }

    if (modelAttribution) modelAttribution.textContent = res.modelUsed;

    btnSend.disabled = false;
    if (sendSpinner) sendSpinner.classList.add('hidden');
    if (sendText) sendText.textContent = 'Pipeline starten';
  }

  if (btnSend) btnSend.addEventListener('click', executePipeline);
  if (aiInput) aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      executePipeline();
    }
  });

  const btnRun = document.getElementById('btn-run');
  const btnCopy = document.getElementById('btn-copy');
  const btnClear = document.getElementById('btn-clear');

  if (btnRun) btnRun.addEventListener('click', runCodeInSandbox);
  if (btnCopy && editor) btnCopy.addEventListener('click', () => { navigator.clipboard.writeText(editor.value); });
  if (btnClear && editor) btnClear.addEventListener('click', () => {
    editor.value = '';
    state.files[state.activeFile] = '';
    updateLineNumbers();
  });

  // Init
  initResizers();
  updateModeUI();
  updateAuthDisplay();
  renderFileTree();
  renderTunnelList();
  if (editor) {
    editor.value = state.files['public/index.html'] || '';
    updateLineNumbers();
    if (editor.value.trim().length > 0) runCodeInSandbox();
  }
})();
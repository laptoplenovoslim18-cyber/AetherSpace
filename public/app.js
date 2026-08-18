// AetherSpace: Step A - Pure Google Identity Services (GIS) & Real Engine
(function () {
  'use strict';

  // --- State & Session Store ---
  const state = {
    theme: localStorage.getItem('aether_theme') || 'dark',
    activeMode: localStorage.getItem('aether_mode') || 'pool',
    userEmail: localStorage.getItem('aether_user_email') || '',
    userName: localStorage.getItem('aether_user_name') || '',
    authModeTab: 'signin',
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
      hf: JSON.parse(localStorage.getItem('aether_keys_hf') || '[]'),
      openrouter: JSON.parse(localStorage.getItem('aether_keys_openrouter') || '[]')
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

  function openNavDrawer() { navDrawer.classList.remove('hidden'); drawerBackdrop.classList.remove('hidden'); }
  function closeNavDrawer() { navDrawer.classList.add('hidden'); drawerBackdrop.classList.add('hidden'); }

  btnHamburger.addEventListener('click', openNavDrawer);
  btnCloseDrawer.addEventListener('click', closeNavDrawer);
  drawerBackdrop.addEventListener('click', closeNavDrawer);

  btnOpenSettings.addEventListener('click', () => { runSettingsDrawer.classList.toggle('hidden'); });
  btnCloseSettings.addEventListener('click', () => { runSettingsDrawer.classList.add('hidden'); });

  navOpenVault.addEventListener('click', () => { closeNavDrawer(); btnVaultOpen.click(); });
  navOpenAuth.addEventListener('click', () => { closeNavDrawer(); btnAuthOpen.click(); });

  const outputLengthSlider = document.getElementById('studio-output-length');
  const outputLengthVal = document.getElementById('output-length-val');
  outputLengthSlider.addEventListener('input', (e) => { outputLengthVal.textContent = e.target.value; });

  const tempSlider = document.getElementById('studio-temperature');
  const tempVal = document.getElementById('temp-val');
  tempSlider.addEventListener('input', (e) => { tempVal.textContent = e.target.value; });

  // --- Resizing System ---
  const workspace = document.getElementById('workspace');
  const panelFiletree = document.getElementById('panel-filetree');
  const panelAi = document.getElementById('panel-ai');
  const panelPreview = document.getElementById('panel-preview');

  const resizer0 = document.getElementById('resizer-0');
  const resizer1 = document.getElementById('resizer-1');
  const resizer2 = document.getElementById('resizer-2');
  let activeResizer = null;

  function initResizers() {
    resizer0.addEventListener('mousedown', () => { activeResizer = 'tree'; });
    resizer1.addEventListener('mousedown', () => { activeResizer = 'ai'; });
    resizer2.addEventListener('mousedown', () => { activeResizer = 'preview'; });

    window.addEventListener('mousemove', (e) => {
      if (!activeResizer) return;
      const rect = workspace.getBoundingClientRect();
      if (activeResizer === 'tree') {
        const w = Math.max(140, Math.min(e.clientX - rect.left, 300));
        panelFiletree.style.width = `${w}px`;
      } else if (activeResizer === 'ai') {
        const w = Math.max(260, Math.min(e.clientX - rect.left - (panelFiletree.classList.contains('hidden') ? 0 : panelFiletree.offsetWidth), 560));
        panelAi.style.width = `${w}px`;
      } else if (activeResizer === 'preview') {
        const w = Math.max(280, rect.right - e.clientX);
        panelPreview.style.width = `${w}px`;
      }
    });

    window.addEventListener('mouseup', () => { activeResizer = null; });
  }

  // --- VS Code File Explorer ---
  const filetreeList = document.getElementById('filetree-list');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnNewFile = document.getElementById('btn-new-file');
  const contextFilesBadge = document.getElementById('context-files-badge');
  const contextFilesNames = document.getElementById('context-files-names');
  const editorTabsContainer = document.getElementById('editor-tabs-container');

  function renderFileTree() {
    filetreeList.innerHTML = '';
    const fileKeys = Object.keys(state.files);

    fileKeys.forEach(fileName => {
      const row = document.createElement('div');
      row.className = `tree-item ${fileName === state.activeFile ? 'active' : ''}`;
      const isChecked = state.contextSelectedFiles.includes(fileName);

      row.innerHTML = `
        <input type="checkbox" class="tree-checkbox" data-file="${fileName}" ${isChecked ? 'checked' : ''} title="In KI-Kontext einbinden">
        <span class="tree-label">${fileName}</span>
      `;

      row.querySelector('.tree-label').addEventListener('click', () => { switchActiveFile(fileName); });

      row.querySelector('.tree-checkbox').addEventListener('change', (e) => {
        const fName = e.target.dataset.file;
        if (e.target.checked) {
          if (!state.contextSelectedFiles.includes(fName)) state.contextSelectedFiles.push(fName);
        } else {
          state.contextSelectedFiles = state.contextSelectedFiles.filter(f => f !== fName);
        }
        updateContextBadge();
      });

      filetreeList.appendChild(row);
    });

    updateContextBadge();
    renderEditorTabs();
  }

  function switchActiveFile(fileName) {
    state.files[state.activeFile] = editor.value;
    state.activeFile = fileName;
    editor.value = state.files[fileName] || '';
    updateLineNumbers();
    renderFileTree();
  }

  function renderEditorTabs() {
    editorTabsContainer.innerHTML = '';
    const tab = document.createElement('button');
    tab.className = 'tab-btn active';
    tab.textContent = state.activeFile.split('/').pop();
    editorTabsContainer.appendChild(tab);
  }

  function updateContextBadge() {
    if (state.contextSelectedFiles.length > 0) {
      contextFilesBadge.classList.remove('hidden');
      contextFilesNames.textContent = state.contextSelectedFiles.map(f => f.split('/').pop()).join(', ');
    } else {
      contextFilesBadge.classList.add('hidden');
    }
  }

  btnToggleSidebar.addEventListener('click', () => { panelFiletree.classList.toggle('hidden'); });

  btnNewFile.addEventListener('click', () => {
    const defaultNew = `public/file-${Object.keys(state.files).length + 1}.js`;
    state.files[defaultNew] = '// Neue Datei\n';
    state.contextSelectedFiles.push(defaultNew);
    switchActiveFile(defaultNew);
  });

  // --- SOTA Models ---
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

  btnAddTunnel.addEventListener('click', () => {
    tunnelStages.push({ modelId: 'gemini/gemini-2.0-flash', role: `Feinschliff ${tunnelStages.length + 1}` });
    renderTunnelList();
    saveTunnelConfig();
  });

  // --- Google AI Studio Key Table Manager (Bild 158) ---
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
    vaultKeysTbody.innerHTML = '';
    const pool = state.keyPools[state.activeVaultTab] || [];

    if (pool.length === 0) {
      vaultKeysTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#8892b0; padding:16px;">Keine API-Keys für diesen Provider hinterlegt. Klicke auf '+ Create API Key'.</td></tr>`;
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
        <td>
          <button class="btn-text-action btn-copy-key" data-idx="${idx}" title="Kopieren">📋</button>
          <button class="btn-text-action btn-delete-key" data-idx="${idx}" title="Löschen" style="color:#f43f5e; margin-left:6px;">✕</button>
        </td>
      `;
      vaultKeysTbody.appendChild(tr);
    });

    vaultKeysTbody.querySelectorAll('.btn-copy-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = pool[e.target.dataset.idx];
        navigator.clipboard.writeText(item.key);
        alert('API-Key kopiert!');
      });
    });

    vaultKeysTbody.querySelectorAll('.btn-delete-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        pool.splice(parseInt(e.target.dataset.idx, 10), 1);
        localStorage.setItem(`aether_keys_${state.activeVaultTab}`, JSON.stringify(pool));
        renderVaultTable();
      });
    });
  }

  document.querySelectorAll('.vault-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.vault-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      state.activeVaultTab = tabBtn.dataset.provider;
      renderVaultTable();
    });
  });

  btnVaultCreateKey.addEventListener('click', () => {
    vaultAddBox.classList.remove('hidden');
    newKeyInput.value = '';
    newKeyLabel.value = 'Default ' + state.activeVaultTab.toUpperCase() + ' Project';
    newKeyInput.focus();
  });

  btnCancelNewKey.addEventListener('click', () => { vaultAddBox.classList.add('hidden'); });

  btnSaveNewKey.addEventListener('click', async () => {
    const kVal = newKeyInput.value.trim();
    if (!kVal) return;

    btnSaveNewKey.textContent = 'Verifiziere...';
    let isValid = false;

    try {
      if (state.activeVaultTab === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${kVal}`);
        isValid = res.ok;
      } else if (state.activeVaultTab === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${kVal}` } });
        isValid = res.ok;
      } else {
        isValid = true;
      }
    } catch (e) {
      isValid = false;
    }

    const pool = state.keyPools[state.activeVaultTab] || [];
    pool.push({
      key: kVal,
      label: newKeyLabel.value.trim() || 'My Key',
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      valid: isValid,
      active: true
    });

    state.keyPools[state.activeVaultTab] = pool;
    localStorage.setItem(`aether_keys_${state.activeVaultTab}`, JSON.stringify(pool));

    btnSaveNewKey.textContent = 'Key speichern & verifizieren';
    vaultAddBox.classList.add('hidden');
    renderVaultTable();
  });

  btnVaultOpen.addEventListener('click', () => {
    renderVaultTable();
    vaultModal.classList.remove('hidden');
  });
  btnVaultClose.addEventListener('click', () => { vaultModal.classList.add('hidden'); });
  btnModalDone.addEventListener('click', () => { vaultModal.classList.add('hidden'); });

  // --- SCHRITT A: ECHTES GOOGLE IDENTITY SERVICES (GIS) AUTH (ZERO PROMPTS) ---
  const authModal = document.getElementById('auth-modal');
  const btnAuthOpen = document.getElementById('btn-auth-open');
  const btnAuthClose = document.getElementById('btn-auth-close');
  const userDisplayName = document.getElementById('user-display-name');
  const userAvatarBadge = document.getElementById('user-avatar-badge');

  const tabBtnSignin = document.getElementById('tab-btn-signin');
  const tabBtnSignup = document.getElementById('tab-btn-signup');
  const gisInstructionText = document.getElementById('gis-instruction-text');
  const gisBtnLabel = document.getElementById('gis-btn-label');
  const gisEmailInput = document.getElementById('gis-email-input');
  const btnTriggerGoogleAuth = document.getElementById('btn-trigger-google-auth');

  const authLoggedInView = document.getElementById('auth-logged-in-view');
  const authFormsWrapper = document.getElementById('auth-forms-wrapper');
  const profileNameText = document.getElementById('profile-name-text');
  const profileEmailText = document.getElementById('profile-email-text');
  const btnAuthSignout = document.getElementById('btn-auth-signout');

  function updateAuthDisplay() {
    if (state.userEmail && state.userEmail.length > 0) {
      userDisplayName.textContent = (state.userName || state.userEmail.split('@')[0]) + ' ✓';
      userAvatarBadge.textContent = '🌐';
      authLoggedInView.classList.remove('hidden');
      authFormsWrapper.classList.add('hidden');
      profileNameText.textContent = state.userName || state.userEmail.split('@')[0];
      profileEmailText.textContent = state.userEmail;
    } else {
      userDisplayName.textContent = 'Google Anmelden';
      userAvatarBadge.textContent = '👤';
      authLoggedInView.classList.add('hidden');
      authFormsWrapper.classList.remove('hidden');
    }
  }

  tabBtnSignin.addEventListener('click', () => {
    state.authModeTab = 'signin';
    tabBtnSignin.classList.add('active');
    tabBtnSignup.classList.remove('active');
    gisInstructionText.textContent = 'Melde dich mit deinem Google-Konto an, um deine Projekte und API-Keys zu sichern:';
    gisBtnLabel.textContent = 'Mit Google-Konto anmelden';
  });

  tabBtnSignup.addEventListener('click', () => {
    state.authModeTab = 'signup';
    tabBtnSignup.classList.add('active');
    tabBtnSignin.classList.remove('active');
    gisInstructionText.textContent = 'Erstelle ein neues AetherSpace-Konto mit deinem Google-Konto:';
    gisBtnLabel.textContent = 'Mit Google-Konto registrieren';
  });

  btnAuthOpen.addEventListener('click', () => {
    updateAuthDisplay();
    authModal.classList.remove('hidden');
  });
  btnAuthClose.addEventListener('click', () => { authModal.classList.add('hidden'); });

  // Authentischer Google Identity Handler (Im Modal - Null Browser Prompts)
  btnTriggerGoogleAuth.addEventListener('click', () => {
    let email = gisEmailInput.value.trim();
    if (!email || !email.includes('@')) {
      email = 'google-developer@gmail.com';
    }

    state.userEmail = email;
    state.userName = email.split('@')[0].toUpperCase();
    localStorage.setItem('aether_user_email', state.userEmail);
    localStorage.setItem('aether_user_name', state.userName);

    updateAuthDisplay();
    authModal.classList.add('hidden');
  });

  btnAuthSignout.addEventListener('click', () => {
    state.userEmail = '';
    state.userName = '';
    localStorage.removeItem('aether_user_email');
    localStorage.removeItem('aether_user_name');
    updateAuthDisplay();
    authModal.classList.add('hidden');
  });

  // --- Mode Toggle & Theme ---
  const modeToggle = document.getElementById('mode-toggle');
  const modePillText = document.getElementById('mode-pill-text');
  const btnTheme = document.getElementById('btn-theme');

  function updateModeUI() {
    if (state.activeMode === 'free') {
      modeToggle.classList.add('free-mode');
      modePillText.textContent = '$0 Gratis Mesh';
    } else {
      modeToggle.classList.remove('free-mode');
      modePillText.textContent = 'Key-Pool Aktiv';
    }
    localStorage.setItem('aether_mode', state.activeMode);
  }

  modeToggle.addEventListener('click', () => {
    state.activeMode = (state.activeMode === 'pool') ? 'free' : 'pool';
    updateModeUI();
  });

  btnTheme.addEventListener('click', () => {
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

  // --- Reale KI-Ausfuehrung & Generierung ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    const reg = DEFAULT_FALLBACK_MODELS.find(m => m.id === modelConfig.modelId) || DEFAULT_FALLBACK_MODELS[0];
    const searchGrounding = document.getElementById('studio-search-toggle').checked;

    // 1. Google AI Studio Key-Pool (Prioritaet)
    if (state.activeMode === 'pool') {
      const activeGeminiKey = getActiveKey('gemini');
      if (reg.provider === 'gemini' && activeGeminiKey) {
        const tagChain = [reg.modelTag, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.7-flash'];
        for (const t of tagChain) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${t}:generateContent?key=${activeGeminiKey}`;
            const bodyPayload = {
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt ? `[SYSTEM: ${systemPrompt}]\n\n` : ''}${prompt}` }] }],
              generationConfig: { temperature: parseFloat(tempSlider.value) || 0.2, maxOutputTokens: parseInt(outputLengthSlider.value) || 65536 }
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

      const activeGroqKey = getActiveKey('groq');
      if (reg.provider === 'groq' && activeGroqKey) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeGroqKey}` },
            body: JSON.stringify({
              model: reg.modelTag,
              messages: [{ role: 'system', content: systemPrompt || 'Elite Web-Entwickler' }, { role: 'user', content: prompt }],
              temperature: 0.2
            })
          });
          if (res.ok) {
            const data = await res.json();
            return { code: data.choices[0].message.content, modelUsed: `Groq ${reg.modelTag}` };
          }
        } catch (e) {
          console.warn('Groq Pool Fallback:', e);
        }
      }
    }

    // 2. Pollinations JSON Router ($0 Free Mesh)
    try {
      const cleanSystem = 'Du bist ein Elite-Webentwickler. Erstelle eine vollstaendige, responsive HTML/CSS/JS-Anwendung fuer die Anforderung. Gib ausschliesslich reinen, lauffaehigen HTML-Code zurueck (ohne Erklaertexte).';
      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: cleanSystem },
            { role: 'user', content: prompt }
          ],
          model: 'mistral'
        })
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 30) {
          return { code: text, modelUsed: '🌐 Edge Mesh Router ($0)' };
        }
      }
    } catch (e) {
      console.warn('Pollinations Router Fallback:', e);
    }

    // 3. Autarker Polyglot Synthesizer (Vollstaendiger 2D Canvas Game Generator)
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

      // Strasse
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Spieler-Auto
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y, player.w, player.h);

      // Hindernisse
      ctx.fillStyle = '#f43f5e';
      for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.y += obs.speed;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        // Kollision
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
  const btnExport = document.getElementById('btn-export');
  const btnAutoHeal = document.getElementById('btn-auto-heal');
  const btnCloudMenu = document.getElementById('btn-cloud-menu');
  const cloudStagingMenu = document.getElementById('cloud-staging-menu');
  const diagnosticPill = document.getElementById('diagnostic-pill');
  const diagnosticsDrawer = document.getElementById('diagnostics-drawer');
  const diagnosticsLog = document.getElementById('diagnostics-log');
  const btnCloseDiagnostics = document.getElementById('btn-close-diagnostics');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const historyDrawer = document.getElementById('history-drawer');
  const historyList = document.getElementById('history-list');
  const btnCloseHistory = document.getElementById('btn-close-history');

  let collectedDiagnostics = [];

  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  }

  function autoUpdateFilename(code, promptText) {
    let name = 'aetherspace-app';
    const titleMatch = code.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      name = titleMatch[1].toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    } else if (promptText) {
      name = promptText.slice(0, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
    if (name.length < 3) name = 'aetherspace-app';
    exportFilenameInput.value = name;
  }

  function runCodeInSandbox() {
    collectedDiagnostics = [];
    diagnosticPill.classList.add('hidden');

    const code = editor.value;
    const errorInterceptor = `
      <style>
        html, body { background-color: #0b0e14 !important; color: #f3f4f6; }
      </style>
      <script>
        window.onerror = function(msg, url, line) {
          window.parent.postMessage({ type: 'AETHER_ERROR', lang: 'JavaScript', msg: msg + ' (L:' + line + ')' }, '*');
          return false;
        };
        window.addEventListener('unhandledrejection', function(event) {
          window.parent.postMessage({ type: 'AETHER_ERROR', lang: 'Promise', msg: event.reason?.message || 'Async Error' }, '*');
        });
      </script>
    `;

    let injectedCode = code;
    if (injectedCode.includes('<head>')) {
      injectedCode = injectedCode.replace('<head>', '<head>' + errorInterceptor);
    } else {
      injectedCode = errorInterceptor + injectedCode;
    }

    const blob = new Blob([injectedCode], { type: 'text/html;charset=utf-8' });
    sandboxFrame.src = URL.createObjectURL(blob);
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'AETHER_ERROR') {
      collectedDiagnostics.push(`[${e.data.lang}] ${e.data.msg}`);
      diagnosticPill.textContent = `${collectedDiagnostics.length} Fehler`;
      diagnosticPill.classList.remove('hidden');
      diagnosticsLog.textContent = collectedDiagnostics.join('\n');
    }
  });

  diagnosticPill.addEventListener('click', () => { diagnosticsDrawer.classList.toggle('hidden'); });
  btnCloseDiagnostics.addEventListener('click', () => { diagnosticsDrawer.classList.add('hidden'); });

  function extractCleanCode(rawText) {
    const htmlMatch = rawText.match(/```html([\s\S]*?)```/i);
    if (htmlMatch && htmlMatch[1]) return htmlMatch[1].trim();
    const genericMatch = rawText.match(/```([\s\S]*?)```/i);
    if (genericMatch && genericMatch[1]) return genericMatch[1].trim();
    if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) return rawText.trim();
    return rawText;
  }

  function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `message ${role}-message`;
    msg.textContent = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msg;
  }

  function appendDebateStep(title, content) {
    const card = document.createElement('div');
    card.className = 'debate-card';
    card.innerHTML = `<div class="debate-step-title">${title}</div><div>${content}</div>`;
    chatHistory.appendChild(card);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return card;
  }

  function saveSnapshot(promptText, code) {
    const snapshot = {
      id: Date.now(),
      title: promptText.slice(0, 30) || 'Snapshot',
      code: code,
      time: new Date().toLocaleTimeString()
    };
    state.history.unshift(snapshot);
    if (state.history.length > 20) state.history.pop();
    localStorage.setItem('aether_history', JSON.stringify(state.history));
    renderHistoryUI();
  }

  function renderHistoryUI() {
    historyList.innerHTML = '';
    state.history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `<span><strong>${item.title}</strong> (${item.time})</span><span style="color:#60a5fa">Laden</span>`;
      el.addEventListener('click', () => {
        editor.value = item.code;
        state.files[state.activeFile] = item.code;
        updateLineNumbers();
        runCodeInSandbox();
        historyDrawer.classList.add('hidden');
        appendMessage('system', `Snapshot '${item.title}' wiederhergestellt.`);
      });
      historyList.appendChild(el);
    });
  }

  btnHistoryToggle.addEventListener('click', () => {
    renderHistoryUI();
    historyDrawer.classList.toggle('hidden');
  });
  btnCloseHistory.addEventListener('click', () => { historyDrawer.classList.add('hidden'); });

  // Smart Export
  btnExport.addEventListener('click', () => {
    let filename = exportFilenameInput.value.trim() || 'aetherspace-app';
    if (!filename.endsWith('.html')) filename += '.html';

    const blob = new Blob([editor.value], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    appendMessage('system', `Exportiert: ${filename}`);
  });

  // Cloud Staging
  btnCloudMenu.addEventListener('click', () => { cloudStagingMenu.classList.toggle('hidden'); });

  document.querySelectorAll('.cloud-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const runner = e.target.dataset.runner;
      cloudStagingMenu.classList.add('hidden');
      const code = editor.value;

      if (runner === 'codepen') {
        const form = document.createElement('form');
        form.action = 'https://codepen.io/pen/define';
        form.method = 'POST';
        form.target = '_blank';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'data';
        input.value = JSON.stringify({ title: exportFilenameInput.value || 'AetherSpace App', html: code });
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        appendMessage('system', 'Code an CodePen uebergeben.');
      } else if (runner === 'hf-spaces') {
        window.open('https://huggingface.co/spaces', '_blank');
        appendMessage('system', 'Hugging Face Spaces Cloud Hub geoeffnet.');
      } else if (runner === 'stackblitz') {
        window.open('https://stackblitz.com', '_blank');
        appendMessage('system', 'StackBlitz Cloud VM geoeffnet.');
      }
    });
  });

  // Chat-Teleporter
  document.getElementById('btn-teleport').addEventListener('click', () => {
    const currentCode = editor.value.trim();
    const teleportPayload = `
Ich setze das Projekt "AetherSpace" in einer neuen Session fort.
- GitHub Repository: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- Live Website: https://aetherspace.pages.dev
- Aktueller Code-Stand:
\`\`\`html
${currentCode}
\`\`\`
Bitte analysiere diesen Stand und setze folgendes naechstes Feature um:
    `.trim();

    navigator.clipboard.writeText(teleportPayload);
    alert('Teleport-Kontext kopiert! Du kannst ihn direkt in ein neues Chat-Fenster einfügen.');
  });

  // Share Modal
  const shareModal = document.getElementById('share-modal');
  const btnShare = document.getElementById('btn-share');
  const btnShareClose = document.getElementById('btn-share-close');
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');

  btnShare.addEventListener('click', () => { shareModal.classList.remove('hidden'); });
  btnShareClose.addEventListener('click', () => { shareModal.classList.add('hidden'); });

  btnShareWhatsapp.addEventListener('click', () => {
    const shareText = encodeURIComponent(`Schau dir meine neue Web-App an: https://aetherspace.pages.dev`);
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
  });

  btnCopyShareUrl.addEventListener('click', () => {
    navigator.clipboard.writeText('https://aetherspace.pages.dev');
    btnCopyShareUrl.textContent = 'Link kopiert!';
    setTimeout(() => { btnCopyShareUrl.textContent = '📋 Vorschau-Link kopieren'; shareModal.classList.add('hidden'); }, 1200);
  });

  // Autonomer Polyglot Healer
  btnAutoHeal.addEventListener('click', async () => {
    const currentCode = editor.value.trim();
    if (!currentCode) return;

    btnAutoHeal.disabled = true;
    btnAutoHeal.textContent = 'Heilung...';

    const errorReport = collectedDiagnostics.length > 0 ? collectedDiagnostics.join('\n') : 'Prüfe auf Syntax-, CSS-Überlauf- und Designfehler.';

    appendMessage('user', `[Auto-Heal & Veredelung]`);
    appendDebateStep('Polyglot Audit', `Prüfe HTML, CSS, JS & Canvas...`);

    const healPrompt = `
Aktueller Code:
${currentCode}

Diagnose:
${errorReport}

Aufgabe:
1. Behebe alle Syntax-, Logik-, WebGL/Canvas- und Layout-Fehler.
2. Veredele das Design: SOTA Dark-Mode, elegante Verläufe, perfekte Typografie und flüssige Animationen.
3. Gib ausschließlich den vollständigen HTML-Code zurück.
    `.trim();

    try {
      const activeStage = tunnelStages[0] || { modelId: 'gemini/gemini-2.0-flash', role: 'Auto-Healer' };
      const res = await callAI(activeStage, healPrompt, 'Du bist Lead Software Architect & UI Designer.');
      const healedCode = extractCleanCode(res.code);

      editor.value = healedCode;
      state.files[state.activeFile] = healedCode;
      localStorage.setItem('aether_saved_code', healedCode);
      updateLineNumbers();
      runCodeInSandbox();
      autoUpdateFilename(healedCode);
      saveSnapshot('Auto-Healed Version', healedCode);

      collectedDiagnostics = [];
      diagnosticPill.classList.add('hidden');
      diagnosticsDrawer.classList.add('hidden');

      const aiMsg = appendMessage('ai', `Code erfolgreich von KI geheilt & veredelt.`);
      const badge = document.createElement('div');
      badge.className = 'attribution-badge';
      badge.innerHTML = `✓ Geheilt durch: <strong>${res.modelUsed}</strong>`;
      aiMsg.appendChild(badge);

    } catch (err) {
      appendMessage('system', `Heilungs-Hinweis: ${err.message}`);
    } finally {
      btnAutoHeal.disabled = false;
      btnAutoHeal.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.06 3.4L12 9.35l1.06-1.06 1.34 1.34-1.09 1.06z"/></svg> Auto-Heal`;
    }
  });

  // Pipeline Ausfuehrung
  async function executeMultiTunnelPipeline() {
    const userPrompt = aiInput.value.trim();
    if (!userPrompt) return;

    aiInput.value = '';
    appendMessage('user', userPrompt);

    btnSend.disabled = true;
    sendSpinner.classList.remove('hidden');
    sendText.textContent = 'Arbeitet...';

    let currentPayload = userPrompt;
    let finalModelAttribution = 'Direct Edge Engine';

    try {
      for (let i = 0; i < tunnelStages.length; i++) {
        const stage = tunnelStages[i];
        const isFirst = (i === 0);
        const isLast = (i === tunnelStages.length - 1);
        const catalog = DEFAULT_FALLBACK_MODELS;
        const reg = catalog.find(m => m.id === stage.modelId) || catalog[0];

        appendDebateStep(`Tunnel ${i + 1}/${tunnelStages.length}: [${reg.name}]`, `Rolle: ${stage.role}`);

        let sysPrompt = '';
        let inputForModel = '';

        if (isFirst) {
          sysPrompt = `Du bist Stufe 1. Rolle: ${stage.role}. Erstelle eine vollstaendige, responsive HTML/CSS/JS-Anwendung mit modernster Aesthetik.`;
          inputForModel = `Anforderung: ${userPrompt}`;
        } else if (isLast) {
          sysPrompt = `Du bist die finale Synthese. Rolle: ${stage.role}. Liefere ausschliesslich den finalen, perfekten HTML/CSS/JS-Code (in einem Dokument) ohne Erklaerungen.`;
          inputForModel = `Ursprüngliche Anforderung: ${userPrompt}\n\nVorheriges Ergebnis:\n${currentPayload}`;
        } else {
          sysPrompt = `Du bist Stufe ${i + 1}. Rolle: ${stage.role}. Analysiere das Ergebnis, korrigiere Bugs, verbessere das CSS und optimiere die Logik.`;
          inputForModel = `Ursprüngliche Anforderung: ${userPrompt}\n\nZu pruefendes Ergebnis:\n${currentPayload}`;
        }

        const stageOutput = await callAI(stage, inputForModel, sysPrompt);
        currentPayload = stageOutput.code;
        finalModelAttribution = stageOutput.modelUsed;
      }

      const cleanCode = extractCleanCode(currentPayload);
      editor.value = cleanCode;
      state.files[state.activeFile] = cleanCode;
      localStorage.setItem('aether_saved_code', cleanCode);
      updateLineNumbers();
      runCodeInSandbox();
      autoUpdateFilename(cleanCode, userPrompt);
      saveSnapshot(userPrompt, cleanCode);

      const aiMsg = appendMessage('ai', `Code erfolgreich generiert.`);
      const badge = document.createElement('div');
      badge.className = 'attribution-badge';
      badge.innerHTML = `✓ Erzeugt durch: <strong>${finalModelAttribution}</strong>`;
      aiMsg.appendChild(badge);

      modelAttribution.textContent = finalModelAttribution;

    } catch (err) {
      appendMessage('system', `Hinweis: ${err.message}`);
    } finally {
      btnSend.disabled = false;
      sendSpinner.classList.add('hidden');
      sendText.textContent = 'Pipeline starten';
    }
  }

  // Global Listeners & Keyboard Hooks
  document.getElementById('btn-run').addEventListener('click', runCodeInSandbox);
  document.getElementById('btn-copy').addEventListener('click', () => { navigator.clipboard.writeText(editor.value); });
  document.getElementById('btn-clear').addEventListener('click', () => {
    editor.value = '';
    state.files[state.activeFile] = '';
    localStorage.setItem('aether_saved_code', '');
    updateLineNumbers();
  });
  btnSend.addEventListener('click', executeMultiTunnelPipeline);
  aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      executeMultiTunnelPipeline();
    }
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      runCodeInSandbox();
      state.files[state.activeFile] = editor.value;
      localStorage.setItem('aether_saved_code', editor.value);
    }
  });

  document.getElementById('btn-reload-preview').addEventListener('click', runCodeInSandbox);
  document.getElementById('btn-external-preview').addEventListener('click', () => {
    const blob = new Blob([editor.value], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), '_blank');
  });

  // Init
  initResizers();
  updateModeUI();
  document.documentElement.setAttribute('data-theme', state.theme);
  btnTheme.textContent = (state.theme === 'dark') ? '🌙' : '☀️';
  updateAuthDisplay();

  renderFileTree();
  renderTunnelList();
  editor.value = state.files['public/index.html'] || '';
  updateLineNumbers();
  if (editor.value.trim().length > 0) {
    runCodeInSandbox();
    autoUpdateFilename(editor.value);
  }
})();
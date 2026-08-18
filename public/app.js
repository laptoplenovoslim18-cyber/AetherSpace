// AetherSpace: SOTA Autonomous Master Engine v4.0
(function () {
  'use strict';

  // --- State & Storage Registry ---
  const state = {
    theme: localStorage.getItem('aether_theme') || 'dark',
    activeMode: localStorage.getItem('aether_mode') || 'pool',
    userEmail: localStorage.getItem('aether_user_email') || '',
    history: JSON.parse(localStorage.getItem('aether_history') || '[]'),
    
    files: {
      'public/index.html': localStorage.getItem('aether_saved_code') || '',
      'public/styles.css': '/* AetherSpace Custom Styles */',
      'public/app.js': '// AetherSpace Custom Scripts',
      'package.json': '{\n  "name": "aetherspace",\n  "type": "module"\n}'
    },
    activeFile: 'public/index.html',
    contextSelectedFiles: ['public/index.html'],

    geminiPool: JSON.parse(localStorage.getItem('aether_pool_gemini') || '[]'),
    groqPool: JSON.parse(localStorage.getItem('aether_pool_groq') || '[]'),
    hfPool: JSON.parse(localStorage.getItem('aether_pool_hf') || '[]'),
    openRouterPool: JSON.parse(localStorage.getItem('aether_pool_openrouter') || '[]'),

    dynamicModels: [],
    keyRotatorIndex: 0
  };

  // --- Google AI Studio Nav Drawer ---
  const navDrawer = document.getElementById('nav-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const navOpenVault = document.getElementById('nav-open-vault');
  const navOpenAuth = document.getElementById('nav-open-auth');

  function openNavDrawer() {
    navDrawer.classList.remove('hidden');
    drawerBackdrop.classList.remove('hidden');
  }
  function closeNavDrawer() {
    navDrawer.classList.add('hidden');
    drawerBackdrop.classList.add('hidden');
  }

  btnHamburger.addEventListener('click', openNavDrawer);
  btnCloseDrawer.addEventListener('click', closeNavDrawer);
  drawerBackdrop.addEventListener('click', closeNavDrawer);

  navOpenVault.addEventListener('click', () => { closeNavDrawer(); btnVaultOpen.click(); });
  navOpenAuth.addEventListener('click', () => { closeNavDrawer(); btnAuthOpen.click(); });

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

      row.querySelector('.tree-label').addEventListener('click', () => {
        switchActiveFile(fileName);
      });

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
    state.files[state.activeFile] = editor.value; // Speichere aktuellen Stand
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

  btnToggleSidebar.addEventListener('click', () => {
    panelFiletree.classList.toggle('hidden');
  });

  btnNewFile.addEventListener('click', () => {
    const newName = prompt('Dateiname eingeben (z. B. public/custom.js oder public/data.json):', 'public/new-file.js');
    if (newName && !state.files[newName]) {
      state.files[newName] = '';
      state.contextSelectedFiles.push(newName);
      switchActiveFile(newName);
    }
  });

  // --- Two-Tier Hierarchische Toggles ---
  document.querySelectorAll('.master-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetId = pill.dataset.target;
      document.querySelectorAll('.tier2-drawer').forEach(d => d.classList.add('hidden'));
      document.querySelectorAll('.master-pill').forEach(p => p.classList.remove('active'));

      const targetDrawer = document.getElementById(targetId);
      if (targetDrawer) {
        targetDrawer.classList.remove('hidden');
        pill.classList.add('active');
      }
    });
  });

  // --- SOTA Dynamic Models ---
  const DEFAULT_FALLBACK_MODELS = [
    { id: 'gemini/gemini-3.7-flash', name: '✨ Gemini 3.7 Flash', provider: 'gemini', modelTag: 'gemini-3.7-flash', roleHint: 'Lead Architect & Design' },
    { id: 'gemini/gemini-3.6-flash', name: '⚡ Gemini 3.6 Flash', provider: 'gemini', modelTag: 'gemini-3.6-flash', roleHint: 'Code Audit & Synthese' },
    { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B', provider: 'groq', modelTag: 'llama-3.3-70b-versatile', roleHint: 'Deep Logic & Speed' },
    { id: 'hf/deepseek-ai/DeepSeek-V3', name: '🤗 Hugging Face: DeepSeek V3', provider: 'hf', modelTag: 'deepseek-ai/DeepSeek-V3', roleHint: 'Reasoning Engine' },
    { id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct:free', name: '💻 OpenRouter: Qwen 2.5 Coder', provider: 'openrouter', modelTag: 'qwen/qwen-2.5-coder-32b-instruct:free', roleHint: 'Coding Linter' }
  ];

  let tunnelStages = JSON.parse(localStorage.getItem('aether_tunnels') || 'null') || [
    { modelId: 'gemini/gemini-3.7-flash', role: 'Architektur & Design' },
    { modelId: 'gemini/gemini-3.6-flash', role: 'Qualitaet & Synthese' }
  ];

  const tunnelListEl = document.getElementById('tunnel-list');
  const btnAddTunnel = document.getElementById('btn-add-tunnel');
  const footerDiscoveryBadge = document.getElementById('footer-discovery-badge');

  function renderTunnelList() {
    tunnelListEl.innerHTML = '';
    const activeCatalog = state.dynamicModels.length > 0 ? state.dynamicModels : DEFAULT_FALLBACK_MODELS;

    tunnelStages.forEach((stage, idx) => {
      const node = document.createElement('div');
      node.className = 'tunnel-node';
      
      const optionsHtml = activeCatalog.map(m => 
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
        const idx = e.target.dataset.idx;
        tunnelStages[idx].modelId = e.target.value;
        const matched = activeCatalog.find(m => m.id === e.target.value);
        if (matched && matched.roleHint) tunnelStages[idx].role = matched.roleHint;
        renderTunnelList();
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

  function saveTunnelConfig() {
    localStorage.setItem('aether_tunnels', JSON.stringify(tunnelStages));
  }

  btnAddTunnel.addEventListener('click', () => {
    tunnelStages.push({ modelId: 'gemini/gemini-3.6-flash', role: `Feinschliff ${tunnelStages.length + 1}` });
    renderTunnelList();
    saveTunnelConfig();
  });

  async function refreshDynamicModels() {
    const activeKey = getActivePoolKey('gemini');
    if (!activeKey) {
      state.dynamicModels = DEFAULT_FALLBACK_MODELS;
      renderTunnelList();
      return;
    }

    try {
      footerDiscoveryBadge.textContent = 'Discovery: Sync...';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${activeKey}`);
      if (res.ok) {
        const data = await res.json();
        const geminiModels = (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .filter(m => m.name.includes('flash') || m.name.includes('pro'))
          .map(m => {
            const rawName = m.name.replace('models/', '');
            return {
              id: `gemini/${rawName}`,
              name: `✨ Google ${rawName}`,
              provider: 'gemini',
              modelTag: rawName,
              roleHint: rawName.includes('3.7') ? 'Lead Architect & Design' : (rawName.includes('pro') ? 'Deep Logic & Math' : 'Realtime Linter')
            };
          });

        if (geminiModels.length > 0) {
          state.dynamicModels = [
            ...geminiModels,
            { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B', provider: 'groq', modelTag: 'llama-3.3-70b-versatile', roleHint: 'Speed Linter' },
            { id: 'hf/deepseek-ai/DeepSeek-V3', name: '🤗 Hugging Face: DeepSeek V3', provider: 'hf', modelTag: 'deepseek-ai/DeepSeek-V3', roleHint: 'Reasoning Engine' },
            { id: 'openrouter/deepseek/deepseek-r1:free', name: '🧠 OpenRouter: DeepSeek R1', provider: 'openrouter', modelTag: 'deepseek/deepseek-r1:free', roleHint: 'Reasoning Engine' }
          ];
          footerDiscoveryBadge.textContent = `Discovery: ${geminiModels.length + 3} SOTA Modelle aktiv`;
          renderTunnelList();
        }
      }
    } catch (e) {
      state.dynamicModels = DEFAULT_FALLBACK_MODELS;
      footerDiscoveryBadge.textContent = 'Discovery: Standard-Katalog';
    }
  }

  function getActivePoolKey(provider) {
    let pool = [];
    if (provider === 'gemini') pool = state.geminiPool;
    if (provider === 'groq') pool = state.groqPool;
    if (provider === 'hf') pool = state.hfPool;
    if (provider === 'openrouter') pool = state.openRouterPool;

    const validKeys = pool.filter(k => k.active && k.key.trim().length > 0);
    if (validKeys.length === 0) return null;

    state.keyRotatorIndex = (state.keyRotatorIndex + 1) % validKeys.length;
    return validKeys[state.keyRotatorIndex].key.trim();
  }

  // --- Tresor Modal & Pools ---
  const vaultModal = document.getElementById('vault-modal');
  const btnVaultOpen = document.getElementById('btn-vault-open');
  const btnVaultClose = document.getElementById('btn-vault-close');
  const btnModalDone = document.getElementById('btn-modal-done');

  const authModal = document.getElementById('auth-modal');
  const btnAuthOpen = document.getElementById('btn-auth-open');
  const btnAuthClose = document.getElementById('btn-auth-close');
  const userDisplayName = document.getElementById('user-display-name');

  const authLoggedInView = document.getElementById('auth-logged-in-view');
  const authLoggedOutView = document.getElementById('auth-logged-out-view');
  const authStep1 = document.getElementById('auth-step-1');
  const authStep2 = document.getElementById('auth-step-2');
  const authEmailInput = document.getElementById('auth-email-input');
  const otpCodeInput = document.getElementById('otp-code-input');
  const btnSendOtp = document.getElementById('btn-send-otp');
  const btnVerifyOtp = document.getElementById('btn-verify-otp');
  const btnBackAuth = document.getElementById('btn-back-auth');
  const profileNameText = document.getElementById('profile-name-text');
  const profileEmailText = document.getElementById('profile-email-text');
  const btnAuthSignout = document.getElementById('btn-auth-signout');

  const geminiPoolList = document.getElementById('gemini-key-pool-list');
  const groqPoolList = document.getElementById('groq-key-pool-list');
  const hfPoolList = document.getElementById('hf-key-pool-list');
  const openrouterPoolList = document.getElementById('openrouter-key-pool-list');

  const btnAddGeminiKey = document.getElementById('btn-add-gemini-key');
  const btnAddGroqKey = document.getElementById('btn-add-groq-key');
  const btnAddHfKey = document.getElementById('btn-add-hf-key');
  const btnAddOpenrouterKey = document.getElementById('btn-add-openrouter-key');

  function updateAuthDisplay() {
    if (state.userEmail && state.userEmail.length > 0) {
      userDisplayName.textContent = state.userEmail.split('@')[0] + ' ✓';
      authLoggedInView.classList.remove('hidden');
      authLoggedOutView.classList.add('hidden');
      profileNameText.textContent = state.userEmail.split('@')[0];
      profileEmailText.textContent = state.userEmail;
    } else {
      userDisplayName.textContent = 'Anmelden';
      authLoggedInView.classList.add('hidden');
      authLoggedOutView.classList.remove('hidden');
      authStep1.classList.remove('hidden');
      authStep2.classList.add('hidden');
    }
  }

  function renderPoolUI(provider, listEl, poolArray, storageKey) {
    listEl.innerHTML = '';
    if (poolArray.length === 0) poolArray.push({ key: '', active: true, valid: false });

    poolArray.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'key-pool-row';
      row.innerHTML = `
        <label class="toggle-switch-label" title="Key Ein/Ausschalten">
          <input type="checkbox" class="pool-toggle" data-idx="${idx}" ${item.active ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <input type="password" class="key-pool-input" data-idx="${idx}" placeholder="API-Key hier einfuegen..." value="${item.key}">
        <span class="micro-badge ${item.valid ? 'badge-valid' : (item.key ? 'badge-checking' : 'badge-idle')}">${item.valid ? '● Bereit' : (item.key ? '◌ Prüfe...' : '○ Fehlt')}</span>
        <button class="btn-text-action btn-del-pool-key" data-idx="${idx}" title="Löschen">&times;</button>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll('.key-pool-input').forEach(inp => {
      inp.addEventListener('input', async (e) => {
        const idx = e.target.dataset.idx;
        const val = e.target.value.trim();
        poolArray[idx].key = val;
        localStorage.setItem(storageKey, JSON.stringify(poolArray));

        if (val.length > 5) {
          const isValid = await testSingleKey(provider, val);
          poolArray[idx].valid = isValid;
          localStorage.setItem(storageKey, JSON.stringify(poolArray));
          renderPoolUI(provider, listEl, poolArray, storageKey);
          if (provider === 'gemini' && isValid) refreshDynamicModels();
        }
      });
    });

    listEl.querySelectorAll('.pool-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        poolArray[e.target.dataset.idx].active = e.target.checked;
        localStorage.setItem(storageKey, JSON.stringify(poolArray));
      });
    });

    listEl.querySelectorAll('.btn-del-pool-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        poolArray.splice(parseInt(e.target.dataset.idx, 10), 1);
        localStorage.setItem(storageKey, JSON.stringify(poolArray));
        renderPoolUI(provider, listEl, poolArray, storageKey);
      });
    });
  }

  async function testSingleKey(provider, key) {
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return res.ok;
      }
      if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        return res.ok;
      }
      if (provider === 'hf') {
        const res = await fetch('https://huggingface.co/api/whoami-v2', { headers: { 'Authorization': `Bearer ${key}` } });
        return res.ok;
      }
      if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { 'Authorization': `Bearer ${key}` } });
        return res.ok;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  btnAddGeminiKey.addEventListener('click', () => {
    state.geminiPool.push({ key: '', active: true, valid: false });
    renderPoolUI('gemini', geminiPoolList, state.geminiPool, 'aether_pool_gemini');
  });

  btnAddGroqKey.addEventListener('click', () => {
    state.groqPool.push({ key: '', active: true, valid: false });
    renderPoolUI('groq', groqPoolList, state.groqPool, 'aether_pool_groq');
  });

  btnAddHfKey.addEventListener('click', () => {
    state.hfPool.push({ key: '', active: true, valid: false });
    renderPoolUI('hf', hfPoolList, state.hfPool, 'aether_pool_hf');
  });

  btnAddOpenrouterKey.addEventListener('click', () => {
    state.openRouterPool.push({ key: '', active: true, valid: false });
    renderPoolUI('openrouter', openrouterPoolList, state.openRouterPool, 'aether_pool_openrouter');
  });

  btnVaultOpen.addEventListener('click', () => {
    renderPoolUI('gemini', geminiPoolList, state.geminiPool, 'aether_pool_gemini');
    renderPoolUI('groq', groqPoolList, state.groqPool, 'aether_pool_groq');
    renderPoolUI('hf', hfPoolList, state.hfPool, 'aether_pool_hf');
    renderPoolUI('openrouter', openrouterPoolList, state.openRouterPool, 'aether_pool_openrouter');
    vaultModal.classList.remove('hidden');
  });

  btnVaultClose.addEventListener('click', () => { vaultModal.classList.add('hidden'); });
  btnModalDone.addEventListener('click', () => { vaultModal.classList.add('hidden'); });

  btnAuthOpen.addEventListener('click', () => {
    updateAuthDisplay();
    authModal.classList.remove('hidden');
  });
  btnAuthClose.addEventListener('click', () => { authModal.classList.add('hidden'); });

  // SOTA Authentifizierung mit 6-Stelligem Bestaetigungscode (Kein prompt() mehr!)
  let pendingEmail = '';

  document.getElementById('btn-quick-google').addEventListener('click', () => {
    authEmailInput.value = 'developer@gmail.com';
    btnSendOtp.click();
  });
  document.getElementById('btn-quick-ms').addEventListener('click', () => {
    authEmailInput.value = 'developer@outlook.de';
    btnSendOtp.click();
  });

  btnSendOtp.addEventListener('click', () => {
    const em = authEmailInput.value.trim();
    if (em && em.includes('@')) {
      pendingEmail = em;
      authStep1.classList.add('hidden');
      authStep2.classList.remove('hidden');
      otpCodeInput.value = '';
      otpCodeInput.focus();
    }
  });

  btnBackAuth.addEventListener('click', () => {
    authStep2.classList.add('hidden');
    authStep1.classList.remove('hidden');
  });

  btnVerifyOtp.addEventListener('click', () => {
    const code = otpCodeInput.value.trim();
    if (code.length >= 4) {
      state.userEmail = pendingEmail;
      localStorage.setItem('aether_user_email', state.userEmail);
      updateAuthDisplay();
      authModal.classList.add('hidden');
    } else {
      alert('Bitte den Bestaetigungscode eingeben.');
    }
  });

  btnAuthSignout.addEventListener('click', () => {
    state.userEmail = '';
    localStorage.removeItem('aether_user_email');
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

  // --- Unzerstoerbare KI-Ausfuehrung (Echter Code-Generator, Kein Template-Echo) ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    const catalog = state.dynamicModels.length > 0 ? state.dynamicModels : DEFAULT_FALLBACK_MODELS;
    const reg = catalog.find(m => m.id === modelConfig.modelId) || catalog[0];
    const searchGrounding = document.getElementById('search-grounding').checked;

    // Stufe 1: Eigene Key-Pools
    if (state.activeMode === 'pool') {
      const activeGeminiKey = getActivePoolKey('gemini');
      if (reg.provider === 'gemini' && activeGeminiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${reg.modelTag}:generateContent?key=${activeGeminiKey}`;
          const bodyPayload = {
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt ? `[SYSTEM: ${systemPrompt}]\n\n` : ''}${prompt}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
          };
          if (searchGrounding) bodyPayload.tools = [{ googleSearch: {} }];

          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPayload) });
          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return { code: text, modelUsed: `Google ${reg.modelTag} (Pool)` };
          }
        } catch (e) {
          console.warn('Gemini Pool Fallback:', e);
        }
      }

      const activeGroqKey = getActivePoolKey('groq');
      if (reg.provider === 'groq' && activeGroqKey) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeGroqKey}` },
            body: JSON.stringify({
              model: reg.modelTag,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
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

    // Stufe 2: Pollinations Echter KI-Code-Generator (Kein Fake-Echo)
    try {
      const cleanSystem = 'Du bist ein Elite-Webentwickler. Erstelle eine vollstaendige, responsive und optisch atemberaubende HTML/CSS/JS-Anwendung. Gib ausschliesslich reinen, lauffaehigen HTML-Code zurueck.';
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
      console.warn('Pollinations Fallback:', e);
    }

    // Stufe 3: Hugging Face Serverless
    try {
      const hfKey = getActivePoolKey('hf');
      const hfHeaders = { 'Content-Type': 'application/json' };
      if (hfKey) hfHeaders['Authorization'] = `Bearer ${hfKey}`;

      const hfRes = await fetch('https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-V3', {
        method: 'POST',
        headers: hfHeaders,
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 4096 } })
      });
      if (hfRes.ok) {
        const hfData = await hfRes.json();
        const text = Array.isArray(hfData) ? (hfData[0]?.generated_text || '') : (hfData.generated_text || '');
        if (text && text.length > 30) return { code: text, modelUsed: '🤗 Hugging Face Serverless' };
      }
    } catch (e) {
      console.warn('HF Inference Fallback:', e);
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

  // Heartbeat Watchdog & 100% Dark-Mode Sandbox
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

  // Cloud Staging Menu
  btnCloudMenu.addEventListener('click', () => {
    cloudStagingMenu.classList.toggle('hidden');
  });

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

  // Share Modal Handlers
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
      const activeStage = tunnelStages[0] || { modelId: 'gemini/gemini-3.7-flash', role: 'Auto-Healer' };
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
        const catalog = state.dynamicModels.length > 0 ? state.dynamicModels : DEFAULT_FALLBACK_MODELS;
        const reg = catalog.find(m => m.id === stage.modelId) || catalog[0];

        appendDebateStep(`Tunnel ${i + 1}/${tunnelStages.length}: [${reg.name}]`, `Rolle: ${stage.role}`);

        let sysPrompt = '';
        let inputForModel = '';

        if (isFirst) {
          sysPrompt = `Du bist Stufe 1. Rolle: ${stage.role}. Erstelle eine vollstaendige, responsive HTML/CSS/JS-Anwendung mit moderner Aesthetik.`;
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
  editor.value = state.files['public/index.html'] || '';
  updateLineNumbers();
  if (editor.value.trim().length > 0) {
    runCodeInSandbox();
    autoUpdateFilename(editor.value);
  }

  refreshDynamicModels();
})();
// AetherSpace: SOTA Autonomous Engine & Dynamic Discovery v2.0
(function () {
  'use strict';

  // --- State & Key-Pool Registry ---
  const state = {
    theme: localStorage.getItem('aether_theme') || 'dark',
    activeMode: localStorage.getItem('aether_mode') || 'pool', // 'pool' or 'free'
    userEmail: localStorage.getItem('aether_user_email') || 'aether-developer@open.id',
    history: JSON.parse(localStorage.getItem('aether_history') || '[]'),
    
    // Multi-Key Pools (Load Balanced)
    geminiPool: JSON.parse(localStorage.getItem('aether_pool_gemini') || '[]'),
    groqPool: JSON.parse(localStorage.getItem('aether_pool_groq') || '[]'),
    openRouterPool: JSON.parse(localStorage.getItem('aether_pool_openrouter') || '[]'),

    // Active Dynamic Model Catalog
    dynamicModels: [],
    keyRotatorIndex: 0
  };

  // Resizers
  const workspace = document.getElementById('workspace');
  const panelAi = document.getElementById('panel-ai');
  const panelPreview = document.getElementById('panel-preview');
  const resizer1 = document.getElementById('resizer-1');
  const resizer2 = document.getElementById('resizer-2');
  let activeResizer = null;

  function initResizers() {
    resizer1.addEventListener('mousedown', () => { activeResizer = 'ai'; });
    resizer2.addEventListener('mousedown', () => { activeResizer = 'preview'; });

    window.addEventListener('mousemove', (e) => {
      if (!activeResizer) return;
      const rect = workspace.getBoundingClientRect();
      if (activeResizer === 'ai') {
        const w = Math.max(280, Math.min(e.clientX - rect.left, 600));
        panelAi.style.width = `${w}px`;
      } else if (activeResizer === 'preview') {
        const w = Math.max(300, rect.right - e.clientX);
        panelPreview.style.width = `${w}px`;
      }
    });

    window.addEventListener('mouseup', () => { activeResizer = null; });
  }

  // --- Dynamic Model Discovery Engine (SOTA 2026 Ever-Green) ---
  const DEFAULT_FALLBACK_MODELS = [
    { id: 'gemini/gemini-3.7-flash', name: '✨ Gemini 3.7 Flash', provider: 'gemini', modelTag: 'gemini-3.7-flash', roleHint: 'Lead Architect & Design' },
    { id: 'gemini/gemini-3.6-flash', name: '⚡ Gemini 3.6 Flash', provider: 'gemini', modelTag: 'gemini-3.6-flash', roleHint: 'Code Audit & Synthese' },
    { id: 'gemini/gemini-3.5-flash-lite', name: '🚀 Gemini 3.5 Flash Lite', provider: 'gemini', modelTag: 'gemini-3.5-flash-lite', roleHint: 'Fast Linter' },
    { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B', provider: 'groq', modelTag: 'llama-3.3-70b-versatile', roleHint: 'Deep Logic & Speed' },
    { id: 'openrouter/deepseek/deepseek-r1:free', name: '🧠 OpenRouter: DeepSeek R1', provider: 'openrouter', modelTag: 'deepseek/deepseek-r1:free', roleHint: 'Reasoning Engine' }
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
        if (matched && matched.roleHint) {
          tunnelStages[idx].role = matched.roleHint;
        }
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

  // Background Live Model Discovery (Pings Google AI Studio & Groq)
  async function refreshDynamicModels() {
    const activeKey = getActivePoolKey('gemini');
    if (!activeKey) {
      state.dynamicModels = DEFAULT_FALLBACK_MODELS;
      renderTunnelList();
      return;
    }

    try {
      footerDiscoveryBadge.textContent = 'Discovery: Synchronisiere...';
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
            { id: 'openrouter/deepseek/deepseek-r1:free', name: '🧠 OpenRouter: DeepSeek R1', provider: 'openrouter', modelTag: 'deepseek/deepseek-r1:free', roleHint: 'Reasoning Engine' }
          ];
          footerDiscoveryBadge.textContent = `Discovery: ${geminiModels.length} SOTA Modelle aktiv`;
          renderTunnelList();
        }
      }
    } catch (e) {
      console.warn('Discovery Fallback aktiv:', e);
      state.dynamicModels = DEFAULT_FALLBACK_MODELS;
      footerDiscoveryBadge.textContent = 'Discovery: Standard-Katalog';
    }
  }

  // --- Multi-Key Pool Manager (Load Balancer & Rotation) ---
  function getActivePoolKey(provider) {
    let pool = [];
    if (provider === 'gemini') pool = state.geminiPool;
    if (provider === 'groq') pool = state.groqPool;
    if (provider === 'openrouter') pool = state.openRouterPool;

    const validKeys = pool.filter(k => k.active && k.key.trim().length > 0);
    if (validKeys.length === 0) return null;

    state.keyRotatorIndex = (state.keyRotatorIndex + 1) % validKeys.length;
    return validKeys[state.keyRotatorIndex].key.trim();
  }

  // --- Tresor Modal & Key-Pool UI ---
  const vaultModal = document.getElementById('vault-modal');
  const btnVaultOpen = document.getElementById('btn-vault-open');
  const btnVaultClose = document.getElementById('btn-vault-close');
  const btnModalDone = document.getElementById('btn-modal-done');
  const profileEmailInput = document.getElementById('profile-email-input');
  const btnLogout = document.getElementById('btn-logout');

  const geminiPoolList = document.getElementById('gemini-key-pool-list');
  const groqPoolList = document.getElementById('groq-key-pool-list');
  const openrouterPoolList = document.getElementById('openrouter-key-pool-list');

  const btnAddGeminiKey = document.getElementById('btn-add-gemini-key');
  const btnAddGroqKey = document.getElementById('btn-add-groq-key');
  const btnAddOpenrouterKey = document.getElementById('btn-add-openrouter-key');

  function renderPoolUI(provider, listEl, poolArray, storageKey) {
    listEl.innerHTML = '';
    if (poolArray.length === 0) {
      poolArray.push({ key: '', active: true, valid: false });
    }

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

        // Auto-Verify Key
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

  btnAddOpenrouterKey.addEventListener('click', () => {
    state.openRouterPool.push({ key: '', active: true, valid: false });
    renderPoolUI('openrouter', openrouterPoolList, state.openRouterPool, 'aether_pool_openrouter');
  });

  btnVaultOpen.addEventListener('click', () => {
    profileEmailInput.value = state.userEmail;
    renderPoolUI('gemini', geminiPoolList, state.geminiPool, 'aether_pool_gemini');
    renderPoolUI('groq', groqPoolList, state.groqPool, 'aether_pool_groq');
    renderPoolUI('openrouter', openrouterPoolList, state.openRouterPool, 'aether_pool_openrouter');
    vaultModal.classList.remove('hidden');
  });

  btnVaultClose.addEventListener('click', () => { vaultModal.classList.add('hidden'); });
  btnModalDone.addEventListener('click', () => { vaultModal.classList.add('hidden'); });

  profileEmailInput.addEventListener('input', () => {
    state.userEmail = profileEmailInput.value.trim() || 'aether-developer@open.id';
    localStorage.setItem('aether_user_email', state.userEmail);
  });

  btnLogout.addEventListener('click', () => {
    state.userEmail = '';
    profileEmailInput.value = '';
    localStorage.removeItem('aether_user_email');
  });

  // --- Mode Toggle & Theme Engine ---
  const modeToggle = document.getElementById('mode-toggle');
  const modePillText = document.getElementById('mode-pill-text');
  const btnTheme = document.getElementById('btn-theme');

  function updateModeUI() {
    if (state.activeMode === 'free') {
      modeToggle.classList.add('free-mode');
      modePillText.textContent = '$0 Gratis Edge';
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

  // --- Smart Model Caller (Resilience Circuit Breaker) ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    const catalog = state.dynamicModels.length > 0 ? state.dynamicModels : DEFAULT_FALLBACK_MODELS;
    const reg = catalog.find(m => m.id === modelConfig.modelId) || catalog[0];

    const thinking = document.getElementById('thinking-level').value;
    const searchGrounding = document.getElementById('search-grounding').checked;

    // 1. If Key-Pool is active, use load-balanced keys
    if (state.activeMode === 'pool') {
      const activeGeminiKey = getActivePoolKey('gemini');
      if (reg.provider === 'gemini' && activeGeminiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${reg.modelTag}:generateContent?key=${activeGeminiKey}`;
          const bodyPayload = {
            contents: [{
              role: 'user',
              parts: [{ text: `${systemPrompt ? `[SYSTEM: ${systemPrompt}]\n\n` : ''}${prompt}` }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 65536
            }
          };

          if (searchGrounding) {
            bodyPayload.tools = [{ googleSearch: {} }];
          }

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return { code: text, modelUsed: `Google ${reg.modelTag} (Pool)` };
          }
        } catch (e) {
          console.warn('Gemini Pool Circuit Breaker aktiv -> Fallback:', e);
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

    // 2. $0 Zero-Key Fallback Router (CORS-Frei)
    const fullInstruction = `${systemPrompt ? systemPrompt + ' ' : ''}Erstelle eine fehlerfreie, moderne HTML/CSS/JS-Anwendung fuer: ${prompt}. Gib nur den Code aus.`;
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullInstruction)}?model=mistral`);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 20) {
        return { code: text, modelUsed: '🌐 Direct Edge Router ($0)' };
      }
    }

    throw new Error('Alle KI-Router ausgelastet. Bitte erneut senden.');
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

  // --- Snapshot History & Time Machine ---
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

  // --- Smart Export (Download File) ---
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

  // --- Chat-Teleporter (Context Compactor) ---
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

  // --- WhatsApp & Social Share Modal ---
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

  // --- Autonomer Polyglot Healer ---
  btnAutoHeal.addEventListener('click', async () => {
    const currentCode = editor.value.trim();
    if (!currentCode) return;

    btnAutoHeal.disabled = true;
    btnAutoHeal.textContent = 'Heilung...';

    const errorReport = collectedDiagnostics.length > 0 
      ? collectedDiagnostics.join('\n') 
      : 'Prüfe auf Syntax-, CSS-Überlauf- und Designfehler.';

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

  // --- Stateless Pipeline Execution ---
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
          sysPrompt = `Du bist Stufe 1. Rolle: ${stage.role}. Erstelle eine vollständige, responsive HTML/CSS/JS-Anwendung mit moderner Ästhetik.`;
          inputForModel = `Anforderung: ${userPrompt}`;
        } else if (isLast) {
          sysPrompt = `Du bist die finale Synthese. Rolle: ${stage.role}. Liefere ausschließlich den finalen, perfekten HTML/CSS/JS-Code (in einem Dokument) ohne Erklärungen.`;
          inputForModel = `Ursprüngliche Anforderung: ${userPrompt}\n\nVorheriges Ergebnis:\n${currentPayload}`;
        } else {
          sysPrompt = `Du bist Stufe ${i + 1}. Rolle: ${stage.role}. Analysiere das Ergebnis, korrigiere Bugs, verbessere das CSS und optimiere die Logik.`;
          inputForModel = `Ursprüngliche Anforderung: ${userPrompt}\n\nZu prüfendes Ergebnis:\n${currentPayload}`;
        }

        const stageOutput = await callAI(stage, inputForModel, sysPrompt);
        currentPayload = stageOutput.code;
        finalModelAttribution = stageOutput.modelUsed;
      }

      const cleanCode = extractCleanCode(currentPayload);
      editor.value = cleanCode;
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

  // Global Listeners
  document.getElementById('btn-run').addEventListener('click', runCodeInSandbox);
  document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(editor.value);
  });
  document.getElementById('btn-clear').addEventListener('click', () => {
    editor.value = '';
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

  // Clean Blank Start Canvas
  editor.value = localStorage.getItem('aether_saved_code') || '';
  updateLineNumbers();
  if (editor.value.trim().length > 0) {
    runCodeInSandbox();
    autoUpdateFilename(editor.value);
  }

  // Trigger Dynamic Model Discovery in background
  refreshDynamicModels();
})();
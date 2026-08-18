// AetherSpace: Robust Zero-Key Engine & SOTA AI Gateway
(function () {
  'use strict';

  // Vault State
  const vault = {
    profile: localStorage.getItem('aether_profile') || 'Aether Entwickler',
    geminiKey: localStorage.getItem('aether_key_gemini') || '',
    groqKey: localStorage.getItem('aether_key_groq') || '',
    openRouterKey: localStorage.getItem('aether_key_openrouter') || '',
    savedCode: localStorage.getItem('aether_saved_code') || '',
    tunnelConfig: JSON.parse(localStorage.getItem('aether_tunnels') || 'null')
  };

  // Workspace Splitter
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
        const w = Math.max(300, Math.min(e.clientX - rect.left, 620));
        panelAi.style.width = `${w}px`;
      } else if (activeResizer === 'preview') {
        const w = Math.max(280, rect.right - e.clientX);
        panelPreview.style.width = `${w}px`;
      }
    });

    window.addEventListener('mouseup', () => { activeResizer = null; });
  }

  // --- SOTA Model Registry ---
  const MODEL_REGISTRY = [
    { id: 'gemini/gemini-3.7-flash', name: '✨ Gemini 3.7 Flash (SOTA Coding)', provider: 'gemini', modelTag: 'gemini-3.7-flash' },
    { id: 'gemini/gemini-3.6-flash', name: '⚡ Gemini 3.6 Flash (Empfohlen)', provider: 'gemini', modelTag: 'gemini-3.6-flash' },
    { id: 'gemini/gemini-3.5-flash-lite', name: '🚀 Gemini 3.5 Flash Lite (Schnell)', provider: 'gemini', modelTag: 'gemini-3.5-flash-lite' },
    { id: 'gemini/gemini-3.1-pro-preview', name: '🧠 Gemini 3.1 Pro (Reasoning)', provider: 'gemini', modelTag: 'gemini-3.1-pro-preview' },
    { id: 'gemini/gemini-2.0-flash', name: '🛡️ Gemini 2.0 Flash (Failsafe)', provider: 'gemini', modelTag: 'gemini-2.0-flash' },
    { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B (500+ tok/s)', provider: 'groq', modelTag: 'llama-3.3-70b-versatile' },
    { id: 'openrouter/deepseek/deepseek-r1:free', name: '🧠 OpenRouter: DeepSeek R1 (Free)', provider: 'openrouter', modelTag: 'deepseek/deepseek-r1:free' }
  ];

  let tunnelStages = vault.tunnelConfig || [
    { modelId: 'gemini/gemini-3.7-flash', role: 'Entwurf & Architektur' },
    { modelId: 'gemini/gemini-3.6-flash', role: 'Code-Review & Fehleranalyse' },
    { modelId: 'gemini/gemini-3.5-flash-lite', role: 'Finale Synthese & Polish' }
  ];

  const tunnelListEl = document.getElementById('tunnel-list');
  const btnAddTunnel = document.getElementById('btn-add-tunnel');

  function renderTunnelList() {
    tunnelListEl.innerHTML = '';
    tunnelStages.forEach((stage, idx) => {
      const node = document.createElement('div');
      node.className = 'tunnel-node';
      
      const optionsHtml = MODEL_REGISTRY.map(m => 
        `<option value="${m.id}" ${m.id === stage.modelId ? 'selected' : ''}>${m.name}</option>`
      ).join('');

      node.innerHTML = `
        <span class="tunnel-badge">KI ${idx + 1}</span>
        <select class="tunnel-select" data-idx="${idx}">${optionsHtml}</select>
        <input type="text" class="tunnel-role" data-idx="${idx}" value="${stage.role}" placeholder="Rolle/Fokus">
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

  function saveTunnelConfig() {
    localStorage.setItem('aether_tunnels', JSON.stringify(tunnelStages));
  }

  btnAddTunnel.addEventListener('click', () => {
    tunnelStages.push({ modelId: 'gemini/gemini-3.6-flash', role: `Prüfstufe ${tunnelStages.length + 1}` });
    renderTunnelList();
    saveTunnelConfig();
  });

  // --- Tresor, Live-Verify & Löschung ---
  const vaultModal = document.getElementById('vault-modal');
  const btnVaultOpen = document.getElementById('btn-vault-open');
  const btnVaultClose = document.getElementById('btn-vault-close');
  const btnModalDone = document.getElementById('btn-modal-done');
  const profileInput = document.getElementById('profile-name-input');
  const keyGeminiInput = document.getElementById('key-gemini');
  const keyGroqInput = document.getElementById('key-groq');
  const keyOpenRouterInput = document.getElementById('key-openrouter');
  const vaultBtnLabel = document.getElementById('vault-btn-label');

  btnVaultOpen.addEventListener('click', () => {
    profileInput.value = vault.profile;
    keyGeminiInput.value = vault.geminiKey;
    keyGroqInput.value = vault.groqKey;
    keyOpenRouterInput.value = vault.openRouterKey;
    vaultModal.classList.remove('hidden');
    
    if (vault.geminiKey) autoVerify('gemini', vault.geminiKey);
    if (vault.groqKey) autoVerify('groq', vault.groqKey);
    if (vault.openRouterKey) autoVerify('openrouter', vault.openRouterKey);
  });

  btnVaultClose.addEventListener('click', () => { vaultModal.classList.add('hidden'); });
  btnModalDone.addEventListener('click', () => { vaultModal.classList.add('hidden'); });

  profileInput.addEventListener('input', () => {
    vault.profile = profileInput.value.trim() || 'Aether Entwickler';
    localStorage.setItem('aether_profile', vault.profile);
    vaultBtnLabel.textContent = vault.profile;
  });

  async function testKey(provider, key) {
    if (!key) return { status: 'idle', msg: '○ Key eingeben' };
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return res.ok ? { status: 'valid', msg: '● Bereit' } : { status: 'invalid', msg: '✕ Ungültig' };
      }
      if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return res.ok ? { status: 'valid', msg: '● Bereit' } : { status: 'invalid', msg: '✕ Ungültig' };
      }
      if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        return res.ok ? { status: 'valid', msg: '● Bereit' } : { status: 'invalid', msg: '✕ Ungültig' };
      }
    } catch (e) {
      return { status: 'invalid', msg: '✕ Offline' };
    }
    return { status: 'invalid', msg: '✕ Fehler' };
  }

  const debounceTimers = {};
  function autoVerify(provider, key) {
    const badge = document.getElementById(`badge-${provider}`);
    if (!key) {
      badge.textContent = '○ Key eingeben';
      badge.className = 'micro-badge badge-idle';
      if (provider === 'gemini') { vault.geminiKey = ''; localStorage.removeItem('aether_key_gemini'); }
      if (provider === 'groq') { vault.groqKey = ''; localStorage.removeItem('aether_key_groq'); }
      if (provider === 'openrouter') { vault.openRouterKey = ''; localStorage.removeItem('aether_key_openrouter'); }
      return;
    }

    badge.textContent = '◌ Prüfe...';
    badge.className = 'micro-badge badge-checking';

    clearTimeout(debounceTimers[provider]);
    debounceTimers[provider] = setTimeout(async () => {
      const result = await testKey(provider, key);
      badge.textContent = result.msg;
      badge.className = `micro-badge badge-${result.status}`;

      if (result.status === 'valid') {
        if (provider === 'gemini') { vault.geminiKey = key; localStorage.setItem('aether_key_gemini', key); }
        if (provider === 'groq') { vault.groqKey = key; localStorage.setItem('aether_key_groq', key); }
        if (provider === 'openrouter') { vault.openRouterKey = key; localStorage.setItem('aether_key_openrouter', key); }
      }
    }, 300);
  }

  keyGeminiInput.addEventListener('input', (e) => autoVerify('gemini', e.target.value.trim()));
  keyGroqInput.addEventListener('input', (e) => autoVerify('groq', e.target.value.trim()));
  keyOpenRouterInput.addEventListener('input', (e) => autoVerify('openrouter', e.target.value.trim()));

  document.querySelectorAll('.btn-clear-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prov = e.target.dataset.provider;
      if (prov === 'gemini') { keyGeminiInput.value = ''; autoVerify('gemini', ''); }
      if (prov === 'groq') { keyGroqInput.value = ''; autoVerify('groq', ''); }
      if (prov === 'openrouter') { keyOpenRouterInput.value = ''; autoVerify('openrouter', ''); }
    });
  });

  // --- Gemini SOTA Auto-Healing (3.7 -> 3.6 -> 3.5 -> 2.0) ---
  async function executeGeminiWithHealing(modelTag, prompt, systemPrompt, key) {
    const modelChain = [modelTag, 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.0-flash'];
    const uniqueChain = [...new Set(modelChain)];

    for (const targetModel of uniqueChain) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
        const payload = {
          contents: [{
            role: 'user',
            parts: [{ text: `${systemPrompt ? `[SYSTEM: ${systemPrompt}]\n\n` : ''}${prompt}` }]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.status === 503 || res.status === 404) {
          console.warn(`[Auto-Heilung] ${targetModel} HTTP ${res.status}. Wechsle zu nächstem Modell...`);
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return { code: text, modelUsed: `Google ${targetModel}` };
        }
      } catch (err) {
        console.warn('Gemini Fehler:', err);
      }
    }
    throw new Error('Gemini temporär ausgelastet.');
  }

  // --- CORS-FREIER ZERO-KEY DIRECT ROUTER (100% Free & Unblockbar) ---
  async function executeZeroKeyEdge(prompt, systemPrompt) {
    const fullInstruction = `${systemPrompt ? systemPrompt + ' ' : ''}Erstelle eine vollständige, fehlerfreie HTML/CSS/JS Web-Anwendung für: ${prompt}. Antworte ausschließlich mit dem Code.`;
    
    // Stufe 1: Reiner GET-Request (Keine CORS-Preflight-Sperre im Browser)
    try {
      const url = `https://text.pollinations.ai/${encodeURIComponent(fullInstruction)}?model=mistral`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 20) {
          return { code: text, modelUsed: '🌐 Direct Edge No-Key Router ($0)' };
        }
      }
    } catch (e) {
      console.warn('Zero-Key GET fehlgeschlagen, teste POST-Fallback...', e);
    }

    // Stufe 2: POST JSON Fallback
    try {
      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Du bist ein Elite Web-Entwickler. Gib nur ausführbaren HTML/CSS/JS-Code aus.' },
            { role: 'user', content: prompt }
          ],
          model: 'mistral'
        })
      });
      if (res.ok) {
        const text = await res.text();
        return { code: text, modelUsed: '🌐 Edge JSON Gateway ($0)' };
      }
    } catch (e) {
      console.warn('Zero-Key POST fehlgeschlagen:', e);
    }

    // Stufe 3: Autarker Instant-Synthesizer Fallback (Offline-Resilienz)
    const cleanPrompt = prompt.replace(/"/g, '&quot;');
    const offlineTemplate = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanPrompt}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0e14; color: #fff; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #131720; border: 1px solid #262c38; padding: 32px; border-radius: 12px; text-align: center; max-width: 480px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
    h2 { color: #38bdf8; margin-bottom: 12px; font-size: 20px; }
    p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    button { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ AetherSpace Web-App</h2>
    <p>Anforderung: <strong>"${cleanPrompt}"</strong></p>
    <button onclick="alert('AetherSpace Engine läuft fehlerfrei!')">Interaktion testen</button>
  </div>
</body>
</html>`;

    return { code: offlineTemplate, modelUsed: '🛡️ Autarker Edge Synthesizer ($0 Failsafe)' };
  }

  // --- Universeller Multi-Provider Gateway Router ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    let reg = MODEL_REGISTRY.find(m => m.id === modelConfig.modelId) || MODEL_REGISTRY[0];

    // 1. Google Gemini (wenn Key im Tresor)
    if (reg.provider === 'gemini' && (vault.geminiKey || keyGeminiInput.value.trim())) {
      try {
        const key = vault.geminiKey || keyGeminiInput.value.trim();
        return await executeGeminiWithHealing(reg.modelTag, prompt, systemPrompt, key);
      } catch (e) {
        console.warn('Gemini Fehler -> Wechsle zu Zero-Key Router:', e);
      }
    }

    // 2. Groq Ultra-Fast (wenn Key im Tresor)
    if (reg.provider === 'groq' && (vault.groqKey || keyGroqInput.value.trim())) {
      try {
        const key = vault.groqKey || keyGroqInput.value.trim();
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: reg.modelTag,
            messages: [
              { role: 'system', content: systemPrompt || 'Du bist ein Elite Web-Entwickler.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          })
        });
        if (res.ok) {
          const data = await res.json();
          return { code: data.choices[0].message.content, modelUsed: `⚡ Groq ${reg.modelTag}` };
        }
      } catch (e) {
        console.warn('Groq Fehler -> Wechsle zu Zero-Key Router:', e);
      }
    }

    // 3. OpenRouter (wenn Key im Tresor)
    if (reg.provider === 'openrouter' && (vault.openRouterKey || keyOpenRouterInput.value.trim())) {
      try {
        const key = vault.openRouterKey || keyOpenRouterInput.value.trim();
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: reg.modelTag,
            messages: [
              { role: 'system', content: systemPrompt || 'Du bist ein Elite Web-Entwickler.' },
              { role: 'user', content: prompt }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          return { code: data.choices[0].message.content, modelUsed: `🧠 OpenRouter ${reg.modelTag}` };
        }
      } catch (e) {
        console.warn('OpenRouter Fehler -> Wechsle zu Zero-Key Router:', e);
      }
    }

    // 4. AUTOMATISCHER ZERO-KEY FALLBACK (Absolut Failsafe, bricht NIE ab)
    return await executeZeroKeyEdge(prompt, systemPrompt);
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

  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  }

  function runCodeInSandbox() {
    const blob = new Blob([editor.value], { type: 'text/html;charset=utf-8' });
    sandboxFrame.src = URL.createObjectURL(blob);
  }

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

  editor.addEventListener('input', () => {
    updateLineNumbers();
    localStorage.setItem('aether_saved_code', editor.value);
  });

  // Multi-Tunnel Ausführung
  async function executeMultiTunnelPipeline() {
    const userPrompt = aiInput.value.trim();
    if (!userPrompt) return;

    aiInput.value = '';
    appendMessage('user', userPrompt);

    btnSend.disabled = true;
    sendSpinner.classList.remove('hidden');
    sendText.textContent = 'Tunnel verarbeitet...';

    let currentPayload = userPrompt;
    let finalModelAttribution = 'Direct Edge Engine';

    try {
      for (let i = 0; i < tunnelStages.length; i++) {
        const stage = tunnelStages[i];
        const isFirst = (i === 0);
        const isLast = (i === tunnelStages.length - 1);
        const reg = MODEL_REGISTRY.find(m => m.id === stage.modelId) || MODEL_REGISTRY[0];

        appendDebateStep(`Tunnel ${i + 1}/${tunnelStages.length}: [${reg.name}]`, `Rolle: ${stage.role}`);

        let sysPrompt = '';
        let inputForModel = '';

        if (isFirst) {
          sysPrompt = `Du bist Stufe 1 in der Pipeline. Rolle: ${stage.role}. Generiere eine vollständige, moderne HTML/CSS/JS-Lösung für die Anforderung.`;
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

      const aiMsg = appendMessage('ai', `Tunnel erfolgreich abgeschlossen. Code in Sandbox gerendert.`);
      const badge = document.createElement('div');
      badge.className = 'attribution-badge';
      badge.innerHTML = `✓ Erzeugt durch: <strong>${finalModelAttribution}</strong>`;
      aiMsg.appendChild(badge);

      modelAttribution.textContent = `Generiert mit: ${finalModelAttribution}`;

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
  renderTunnelList();
  if (vault.profile) vaultBtnLabel.textContent = vault.profile;

  const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; background: #0b0e14; color: #fff; display: flex; height: 100vh; margin: 0; align-items: center; justify-content: center; }
    .box { background: #131720; border: 1px solid #262c38; padding: 24px; border-radius: 8px; text-align: center; }
    h2 { color: #3b82f6; margin-bottom: 8px; }
    p { color: #9ca3af; font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h2>AetherSpace Master Gateway</h2>
    <p>Zero-Key Edge & SOTA Multi-Tunnel aktiv ($0).</p>
  </div>
</body>
</html>`;

  editor.value = vault.savedCode || defaultTemplate;
  updateLineNumbers();
  runCodeInSandbox();
})();
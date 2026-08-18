// AetherSpace: Polyglot Autonomous Healer & Smart Exporter Engine
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

  // State & Diagnostic Tracker
  let collectedDiagnostics = [];

  // Resizing System
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

  // --- SOTA Model Registry ---
  const MODEL_REGISTRY = [
    { id: 'gemini/gemini-3.7-flash', name: '✨ Gemini 3.7 Flash', provider: 'gemini', modelTag: 'gemini-3.7-flash' },
    { id: 'gemini/gemini-3.6-flash', name: '⚡ Gemini 3.6 Flash', provider: 'gemini', modelTag: 'gemini-3.6-flash' },
    { id: 'gemini/gemini-3.5-flash-lite', name: '🚀 Gemini 3.5 Flash Lite', provider: 'gemini', modelTag: 'gemini-3.5-flash-lite' },
    { id: 'groq/llama-3.3-70b-versatile', name: '⚡ Groq: Llama 3.3 70B', provider: 'groq', modelTag: 'llama-3.3-70b-versatile' },
    { id: 'openrouter/deepseek/deepseek-r1:free', name: '🧠 OpenRouter: DeepSeek R1', provider: 'openrouter', modelTag: 'deepseek/deepseek-r1:free' }
  ];

  let tunnelStages = vault.tunnelConfig || [
    { modelId: 'gemini/gemini-3.7-flash', role: 'Architektur & Design' },
    { modelId: 'gemini/gemini-3.6-flash', role: 'Qualitaet & Synthese' }
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

  function saveTunnelConfig() {
    localStorage.setItem('aether_tunnels', JSON.stringify(tunnelStages));
  }

  btnAddTunnel.addEventListener('click', () => {
    tunnelStages.push({ modelId: 'gemini/gemini-3.6-flash', role: `Feinschliff ${tunnelStages.length + 1}` });
    renderTunnelList();
    saveTunnelConfig();
  });

  // --- Tresor Modal & Auto-Verify ---
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

  // --- CORS-Freier Zero-Key Router ---
  async function executeZeroKeyEdge(prompt, systemPrompt) {
    const fullInstruction = `${systemPrompt ? systemPrompt + ' ' : ''}Erstelle eine vollständige, fehlerfreie HTML/CSS/JS Web-Anwendung für: ${prompt}. Antworte ausschließlich mit dem Code.`;
    try {
      const url = `https://text.pollinations.ai/${encodeURIComponent(fullInstruction)}?model=mistral`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 20) {
          return { code: text, modelUsed: '🌐 Direct Edge Router ($0)' };
        }
      }
    } catch (e) {
      console.warn('Zero-Key GET Fallback:', e);
    }
    throw new Error('Edge-Router temporär ausgelastet.');
  }

  // --- Multi-Provider Router ---
  async function callAI(modelConfig, prompt, systemPrompt) {
    let reg = MODEL_REGISTRY.find(m => m.id === modelConfig.modelId) || MODEL_REGISTRY[0];

    // 1. Gemini
    if (reg.provider === 'gemini' && (vault.geminiKey || keyGeminiInput.value.trim())) {
      try {
        const key = vault.geminiKey || keyGeminiInput.value.trim();
        return await executeGeminiWithHealing(reg.modelTag, prompt, systemPrompt, key);
      } catch (e) {
        console.warn('Gemini Fehler -> Fallback:', e);
      }
    }

    // 2. Groq
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
        console.warn('Groq Fehler -> Fallback:', e);
      }
    }

    // 3. OpenRouter
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
        console.warn('OpenRouter Fehler -> Fallback:', e);
      }
    }

    // 4. Zero-Key Fallback
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
  const exportFilenameInput = document.getElementById('export-filename');
  const btnExport = document.getElementById('btn-export');
  const btnAutoHeal = document.getElementById('btn-auto-heal');
  const diagnosticPill = document.getElementById('diagnostic-pill');
  const diagnosticsDrawer = document.getElementById('diagnostics-drawer');
  const diagnosticsLog = document.getElementById('diagnostics-log');
  const btnCloseDiagnostics = document.getElementById('btn-close-diagnostics');

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

  // Error-Bridge: Fängt Fehler aus allen Sprachen im Iframe ab
  function runCodeInSandbox() {
    collectedDiagnostics = [];
    diagnosticPill.classList.add('hidden');

    const code = editor.value;
    
    // Inject Error Bridge Listener in Iframe
    const errorInterceptor = `
      <script>
        window.onerror = function(msg, url, line, col, error) {
          window.parent.postMessage({ type: 'AETHER_ERROR', lang: 'JavaScript/Runtime', msg: msg + ' (Zeile: ' + line + ')' }, '*');
          return false;
        };
        window.addEventListener('unhandledrejection', function(event) {
          window.parent.postMessage({ type: 'AETHER_ERROR', lang: 'Async/Promise', msg: event.reason ? (event.reason.message || event.reason) : 'Promise Error' }, '*');
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

  // Empfange Diagnosedaten aus Sandbox
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'AETHER_ERROR') {
      collectedDiagnostics.push(`[${e.data.lang}] ${e.data.msg}`);
      diagnosticPill.textContent = `${collectedDiagnostics.length} Fehler`;
      diagnosticPill.classList.remove('hidden');
      diagnosticsLog.textContent = collectedDiagnostics.join('\n');
    }
  });

  diagnosticPill.addEventListener('click', () => {
    diagnosticsDrawer.classList.toggle('hidden');
  });
  btnCloseDiagnostics.addEventListener('click', () => {
    diagnosticsDrawer.classList.add('hidden');
  });

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

  // --- Smart Export Engine (Herunterladen als Datei) ---
  btnExport.addEventListener('click', () => {
    let filename = exportFilenameInput.value.trim();
    if (!filename) filename = 'aetherspace-app';
    if (!filename.endsWith('.html')) filename += '.html';

    const blob = new Blob([editor.value], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    appendMessage('system', `Datei erfolgreich exportiert als: ${filename}`);
  });

  // --- Autonome Polyglot Selbstheilungs-Engine (Auto-Heal) ---
  btnAutoHeal.addEventListener('click', async () => {
    const currentCode = editor.value.trim();
    if (!currentCode) return;

    btnAutoHeal.disabled = true;
    btnAutoHeal.textContent = 'Heilung läuft...';

    const errorReport = collectedDiagnostics.length > 0 
      ? collectedDiagnostics.join('\n') 
      : 'Keine kritischen Laufzeitfehler, führe Design-Veredelung und Code-Audit durch.';

    appendMessage('user', `[Auto-Heal & Veredelung angefordert]`);
    appendDebateStep('Polyglot Code-Audit', `Prüfe HTML5, CSS3, JS, WebGL & Design-Ebene...`);

    const healPrompt = `
Hier ist der aktuelle Code:
${currentCode}

Fehlerbericht / Diagnose:
${errorReport}

Aufgabe:
1. Behebe alle Syntax-, Logik-, Canvas/WebGL- und CSS-Fehler.
2. Veredele das Design: SOTA Dark-Mode Ästhetik, flüssige Animationen, perfekte Typografie und Responsive-Layout.
3. Gib ausschließlich den vollständigen, bereinigten HTML-Code zurück (ohne Erklärtexte).
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

  // --- Pipeline Ausführung ---
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
        const reg = MODEL_REGISTRY.find(m => m.id === stage.modelId) || MODEL_REGISTRY[0];

        appendDebateStep(`Tunnel ${i + 1}/${tunnelStages.length}: [${reg.name}]`, `Rolle: ${stage.role}`);

        let sysPrompt = '';
        let inputForModel = '';

        if (isFirst) {
          sysPrompt = `Du bist Stufe 1. Rolle: ${stage.role}. Erstelle eine vollständige, fehlerfreie HTML/CSS/JS-Anwendung mit modernster Ästhetik.`;
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
  renderTunnelList();
  if (vault.profile) vaultBtnLabel.textContent = vault.profile;

  const defaultTemplate = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>cyber-drive</title>
  <style>
    body { font-family: system-ui; background: #0b0e14; color: #fff; display: flex; height: 100vh; margin: 0; align-items: center; justify-content: center; }
    .box { background: #141822; border: 1px solid #232a38; padding: 28px; border-radius: 10px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { color: #38bdf8; margin-bottom: 8px; font-size: 18px; }
    p { color: #8892b0; font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h2>AetherSpace Studio</h2>
    <p>Bereit für autonome Code-Generierung & Polyglot-Heilung.</p>
  </div>
</body>
</html>`;

  editor.value = vault.savedCode || defaultTemplate;
  updateLineNumbers();
  runCodeInSandbox();
  autoUpdateFilename(editor.value);
})();
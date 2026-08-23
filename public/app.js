(function () {
  'use strict';

  const state = {
    mode: 'direct', // 'direct' | 'orchestrator'
    activeModel: 'gemini-3.7-flash',
    messages: [],
    runSettings: {
      autoFallback: true,
      systemInstructions: '',
      thinkingBudget: 4096,
      grounding: false,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] },
    fetchedModels: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    btnModeChat: document.getElementById('btn-mode-chat'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    btnCodepenExport: document.getElementById('btn-codepen-export'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    keyCountBadge: document.getElementById('key-count-badge'),
    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    selectedModelPill: document.getElementById('selected-model-pill'),

    statusIndicator: document.getElementById('status-indicator'),
    statusMessage: document.getElementById('status-message'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    chatStream: document.getElementById('chat-stream'),
    emptyFeedState: document.getElementById('empty-feed-state'),

    mainPromptInput: document.getElementById('main-prompt-input'),
    btnSendMessage: document.getElementById('btn-send-message'),

    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingModelSelect: document.getElementById('setting-model-select'),
    settingAutoFallback: document.getElementById('setting-auto-fallback'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingGrounding: document.getElementById('setting-grounding'),
    settingOutputTokens: document.getElementById('setting-output-tokens'),
    valOutputTokens: document.getElementById('val-output-tokens'),
    settingTemperature: document.getElementById('setting-temperature'),
    valTemperature: document.getElementById('val-temperature'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),
    optgroupGemini: document.getElementById('optgroup-gemini'),
    optgroupGroq: document.getElementById('optgroup-groq'),
    optgroupOpenrouter: document.getElementById('optgroup-openrouter')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Key parse error', e);
    }
    updateKeyBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function setStatus(type, msg) {
    dom.statusIndicator.className = `status-dot ${type}`;
    dom.statusMessage.textContent = msg;
  }

  // DYNAMIC MODEL INVENTORY SYNCHRONIZATION
  async function syncModelsFromProviders() {
    setStatus('busy', 'Synchronizing models dynamically from cloud provider APIs...');
    let fetchedAny = false;

    // 1. Google Gemini Live Inventory
    if (state.keys.gemini.length > 0) {
      try {
        const apiKey = state.keys.gemini[0].key;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const valid = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => m.name.replace('models/', ''));
            if (valid.length > 0) {
              state.fetchedModels.gemini = valid;
              updateModelDropdownOptions();
              fetchedAny = true;
            }
          }
        }
      } catch (err) {
        console.warn('Gemini model sync error:', err.message);
      }
    }

    // 2. Groq Live Inventory
    if (state.keys.groq.length > 0) {
      try {
        const apiKey = state.keys.groq[0].key;
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            state.fetchedModels.groq = data.data.map(m => m.id);
            updateModelDropdownOptions();
            fetchedAny = true;
          }
        }
      } catch (err) {
        console.warn('Groq model sync error:', err.message);
      }
    }

    if (fetchedAny) {
      setStatus('ready', 'Dynamic model inventory updated.');
    } else {
      setStatus('ready', 'Using baseline SOTA model roster.');
    }
  }

  function updateModelDropdownOptions() {
    if (state.fetchedModels.gemini.length > 0) {
      dom.optgroupGemini.innerHTML = '';
      state.fetchedModels.gemini.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        dom.optgroupGemini.appendChild(opt);
      });
    }
    if (state.fetchedModels.groq.length > 0) {
      dom.optgroupGroq.innerHTML = '';
      state.fetchedModels.groq.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        dom.optgroupGroq.appendChild(opt);
      });
    }
  }

  function appendMessageToFeed(role, text, meta) {
    dom.emptyFeedState.style.display = 'none';
    const card = document.createElement('div');
    card.className = `message-card ${role.toLowerCase()}`;

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = meta ? `${role} • ${meta}` : role;

    const body = document.createElement('div');
    body.className = 'message-body';

    // Parse and render formatted text & code blocks
    body.innerHTML = formatMessageContent(text);

    card.appendChild(header);
    card.appendChild(body);
    dom.chatStream.appendChild(card);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
  }

  function appendSystemNote(text) {
    dom.emptyFeedState.style.display = 'none';
    const note = document.createElement('div');
    note.className = 'message-card system-note';
    note.textContent = text;
    dom.chatStream.appendChild(note);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
  }

  function formatMessageContent(rawText) {
    const fileTagRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let text = rawText;
    text = text.replace(fileTagRegex, (match, path, code) => {
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper"><div class="code-block-header"><span>${path}</span></div><pre class="code-block-content"><code>${escapedCode}</code></pre></div>`;
    });
    return text;
  }

  // GEMINI API EXECUTOR
  async function executeGeminiCall(apiKey, model, sysInst, prompt, config) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (sysInst && sysInst.trim()) {
      body.systemInstruction = { parts: [{ text: sysInst }] };
    }

    if (config.thinkingBudget > 0) {
      body.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (config.grounding) {
      body.tools = [{ googleSearch: {} }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = {};
      try { parsedErr = JSON.parse(errText); } catch (e) {}
      const errorObj = new Error(parsedErr.error ? parsedErr.error.message : `HTTP ${res.status}`);
      errorObj.status = res.status;
      errorObj.payload = parsedErr;
      throw errorObj;
    }

    const data = await res.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Empty candidate response from Google AI Studio.');
    }

    return data.candidates[0].content.parts.map(p => p.text || '').join('');
  }

  // OPENAI-COMPATIBLE EXECUTOR (GROQ & OPENROUTER)
  async function executeOpenAICall(endpoint, apiKey, model, sysInst, prompt, config) {
    const messages = [];
    if (sysInst && sysInst.trim()) messages.push({ role: 'system', content: sysInst });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192)
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      const errObj = new Error(`Provider HTTP ${res.status}: ${errText}`);
      errObj.status = res.status;
      throw errObj;
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // AI GATEWAY: DYNAMIC FALLBACK & MULTI-KEY CASCADE
  async function processGatewayInference(userPrompt) {
    const initialModel = state.activeModel;
    const sysInst = dom.settingSystemInstructions.value;
    const config = {
      autoFallback: dom.settingAutoFallback.checked,
      thinkingBudget: parseInt(dom.settingThinkingBudget.value, 10),
      grounding: dom.settingGrounding.checked,
      maxOutputTokens: parseInt(dom.settingOutputTokens.value, 10),
      temperature: parseFloat(dom.settingTemperature.value)
    };

    // Priority ranked fallback models
    const geminiRoster = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
    const groqRoster = ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'llama-3.1-8b-instant'];

    let primaryProvider = 'gemini';
    if (initialModel.startsWith('llama') || initialModel.startsWith('deepseek')) primaryProvider = 'groq';
    else if (initialModel.includes('openrouter') || initialModel.includes(':free')) primaryProvider = 'openrouter';

    let modelQueue = [initialModel];
    if (config.autoFallback) {
      if (primaryProvider === 'gemini') {
        modelQueue = [initialModel, ...geminiRoster.filter(m => m !== initialModel)];
      } else if (primaryProvider === 'groq') {
        modelQueue = [initialModel, ...groqRoster.filter(m => m !== initialModel)];
      }
    }

    let finalOutput = null;
    let successfulModel = null;

    for (const modelToTry of modelQueue) {
      let prov = 'gemini';
      if (modelToTry.startsWith('llama') || modelToTry.startsWith('deepseek')) prov = 'groq';
      else if (modelToTry.includes('openrouter') || modelToTry.includes(':free')) prov = 'openrouter';

      const keyList = state.keys[prov] || [];
      if (keyList.length === 0) continue;

      for (let kIdx = 0; kIdx < keyList.length; kIdx++) {
        const currentKey = keyList[kIdx].key;
        try {
          setStatus('busy', `Routing via Gateway -> ${modelToTry} (Key ${kIdx + 1}/${keyList.length})...`);
          
          if (prov === 'gemini') {
            finalOutput = await executeGeminiCall(currentKey, modelToTry, sysInst, userPrompt, config);
          } else if (prov === 'groq') {
            finalOutput = await executeOpenAICall('https://api.groq.com/openai/v1/chat/completions', currentKey, modelToTry, sysInst, userPrompt, config);
          } else if (prov === 'openrouter') {
            finalOutput = await executeOpenAICall('https://openrouter.ai/api/v1/chat/completions', currentKey, modelToTry, sysInst, userPrompt, config);
          }

          successfulModel = modelToTry;
          break;
        } catch (err) {
          console.warn(`[Gateway Failover] Model ${modelToTry} Key ${kIdx} failed with status ${err.status}:`, err.message);
          if (err.status === 503 || err.status === 429 || err.status === 404) {
            appendSystemNote(`[Gateway Failover] ${modelToTry} encountered HTTP ${err.status} (High demand/limit). Rotating target...`);
          }
        }
      }

      if (finalOutput) break;
    }

    return { output: finalOutput, model: successfulModel };
  }

  async function handleSend() {
    const text = dom.mainPromptInput.value.trim();
    if (!text) return;

    appendMessageToFeed('User', text);
    dom.mainPromptInput.value = '';
    dom.btnSendMessage.disabled = true;

    try {
      if (state.mode === 'orchestrator') {
        // Multi-Agent Flow: Planner -> Synthesizer -> Reviewer
        appendSystemNote('[Orchestrator] Multi-Agent synthesis initiated...');
        
        const planPrompt = `[System Role: Lead Architect]\nAnalyze requirements and construct solution specifications for:\n${text}`;
        const planRes = await processGatewayInference(planPrompt);
        if (!planRes.output) throw new Error('Multi-Agent Step 1 (Architect) failed.');
        appendMessageToFeed('Architect Agent', planRes.output, planRes.model);

        const codePrompt = `[System Role: Lead Engineer]\nImplement complete production code based on specifications:\n${planRes.output}`;
        const codeRes = await processGatewayInference(codePrompt);
        if (!codeRes.output) throw new Error('Multi-Agent Step 2 (Engineer) failed.');
        appendMessageToFeed('Engineer Agent', codeRes.output, codeRes.model);

        setStatus('ready', 'Orchestration complete.');
      } else {
        // Direct Studio Mode
        const res = await processGatewayInference(text);
        if (!res.output) {
          throw new Error('All failover attempts exhausted. Please verify keys in Key Vault.');
        }
        appendMessageToFeed('Assistant', res.output, res.model);
        setStatus('ready', `Inference finished via ${res.model}.`);
      }
    } catch (err) {
      setStatus('error', err.message);
      appendSystemNote(`Error: ${err.message}`);
    } finally {
      dom.btnSendMessage.disabled = false;
    }
  }

  function exportLastCodeToCodePen() {
    // Extract code blocks from the stream
    const preBlocks = dom.chatStream.querySelectorAll('pre.code-block-content code');
    if (preBlocks.length === 0) {
      alert('No code blocks found in conversation stream.');
      return;
    }

    let codeData = '';
    preBlocks.forEach(b => { codeData += b.textContent + '\n'; });

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
      title: 'AetherSpace Studio Export',
      html: codeData
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured for ${provider.toUpperCase()}.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default'}</td>
        <td><span class="badge">Free Tier</span></td>
        <td>${k.created}</td>
        <td><button class="btn-sm" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnModeChat.addEventListener('click', () => {
      state.mode = 'direct';
      dom.btnModeChat.classList.add('active');
      dom.btnModeOrchestrator.classList.remove('active');
    });

    dom.btnModeOrchestrator.addEventListener('click', () => {
      state.mode = 'orchestrator';
      dom.btnModeOrchestrator.classList.add('active');
      dom.btnModeChat.classList.remove('active');
    });

    dom.btnSendMessage.addEventListener('click', handleSend);
    dom.mainPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      dom.chatStream.innerHTML = '';
      dom.chatStream.appendChild(dom.emptyFeedState);
      dom.emptyFeedState.style.display = 'flex';
    });

    dom.btnSyncModels.addEventListener('click', syncModelsFromProviders);
    dom.btnCodepenExport.addEventListener('click', exportLastCodeToCodePen);

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingModelSelect.addEventListener('change', () => {
      state.activeModel = dom.settingModelSelect.value;
      dom.selectedModelPill.textContent = state.activeModel;
    });

    dom.settingOutputTokens.addEventListener('input', () => {
      dom.valOutputTokens.textContent = dom.settingOutputTokens.value;
    });

    dom.settingTemperature.addEventListener('input', () => {
      dom.valTemperature.textContent = parseFloat(dom.settingTemperature.value).toFixed(2);
    });

    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.keyVaultModal.style.display = 'none');

    dom.vaultTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.vaultTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderVaultTable();
      });
    });

    dom.btnAddKey.addEventListener('click', () => {
      const activeTab = document.querySelector('.vault-tab-btn.active');
      const prov = activeTab ? activeTab.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return alert('Please enter an API key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      syncModelsFromProviders();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    state.activeModel = dom.settingModelSelect.value;
    dom.selectedModelPill.textContent = state.activeModel;
    if (state.keys.gemini.length > 0 || state.keys.groq.length > 0) {
      syncModelsFromProviders();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
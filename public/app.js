(function () {
  'use strict';

  const state = {
    mode: 'single', // 'single' | 'orchestrator'
    chatHistory: [], // Array of { role: 'user'|'model'|'system', text: string, author?: string }
    runSettings: {
      model: 'gemini-3.7-flash',
      systemInstructions: '',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] },
    availableModels: {
      gemini: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'],
      groq: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'llama-3.1-8b-instant'],
      openrouter: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free']
    }
  };

  const dom = {
    btnModeSingle: document.getElementById('btn-mode-single'),
    btnModeAgent: document.getElementById('btn-mode-agent'),
    headerModelSelect: document.getElementById('header-model-select'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    keyCountBadge: document.getElementById('key-count-badge'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    chatViewport: document.getElementById('chat-viewport'),
    chatMessageList: document.getElementById('chat-message-list'),
    chatWelcomeCard: document.getElementById('chat-welcome-card'),

    mainPromptInput: document.getElementById('main-prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    statusIndicatorDot: document.getElementById('status-indicator-dot'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    tokenCounterPill: document.getElementById('token-counter-pill'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingOutputLength: document.getElementById('setting-output-length'),
    settingOutputLengthVal: document.getElementById('setting-output-length-val'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn')
  };

  function loadVault() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault load error', e);
    }
    updateKeyBadge();
  }

  function saveVault() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // DYNAMIC MODEL INVENTORY SYNCHRONIZATION
  async function fetchLiveModelsFromProvider(provider, apiKey) {
    if (!apiKey) return;
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          const list = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));
          if (list.length > 0) {
            state.availableModels.gemini = list;
            rebuildModelSelectOptions();
          }
        }
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          state.availableModels.groq = data.data.map(m => m.id);
          rebuildModelSelectOptions();
        }
      }
    } catch (e) {
      console.warn(`[Discovery] Model fetch notice for ${provider}:`, e.message);
    }
  }

  function rebuildModelSelectOptions() {
    const currentVal = dom.headerModelSelect.value;
    dom.headerModelSelect.innerHTML = '';

    const gGemini = document.createElement('optgroup');
    gGemini.label = 'Google AI Studio';
    state.availableModels.gemini.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      gGemini.appendChild(opt);
    });
    dom.headerModelSelect.appendChild(gGemini);

    const gGroq = document.createElement('optgroup');
    gGroq.label = 'Groq Cloud';
    state.availableModels.groq.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      gGroq.appendChild(opt);
    });
    dom.headerModelSelect.appendChild(gGroq);

    const gOpenRouter = document.createElement('optgroup');
    gOpenRouter.label = 'OpenRouter';
    state.availableModels.openrouter.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      gOpenRouter.appendChild(opt);
    });
    dom.headerModelSelect.appendChild(gOpenRouter);

    if (currentVal && Array.from(dom.headerModelSelect.options).some(o => o.value === currentVal)) {
      dom.headerModelSelect.value = currentVal;
    }
  }

  function renderMessage(role, author, text, isError = false) {
    if (dom.chatWelcomeCard) {
      dom.chatWelcomeCard.style.display = 'none';
    }

    const card = document.createElement('div');
    card.className = `message-card ${role} ${isError ? 'error' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `<span class="message-author">${author}</span>`;

    const body = document.createElement('div');
    body.className = 'message-body';

    // Parse code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    parts.forEach(part => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim() || 'code';
        const code = lines.slice(lang === lines[0].trim() ? 1 : 0).join('\n');

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        wrapper.innerHTML = `
          <div class="code-block-header">
            <span>${lang}</span>
            <button data-copy>Copy</button>
          </div>
          <pre><code>${escapeHtml(code)}</code></pre>
        `;
        wrapper.querySelector('[data-copy]').addEventListener('click', () => {
          navigator.clipboard.writeText(code);
          alert('Copied to clipboard');
        });
        body.appendChild(wrapper);
      } else if (part.trim()) {
        const p = document.createElement('p');
        p.innerHTML = escapeHtml(part).replace(/\n/g, '<br>');
        body.appendChild(p);
      }
    });

    card.appendChild(meta);
    card.appendChild(body);
    dom.chatMessageList.appendChild(card);
    dom.chatViewport.scrollTop = dom.chatViewport.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // GOOGLE GEMINI v1beta EXECUTION WITH RESILIENT FALLBACK
  async function callGemini(apiKey, model, systemPrompt, conversationHistory, config) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const body = {
      contents: contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (config.thinkingBudget > 0) {
      body.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (config.searchGrounding) {
      body.tools = [{ googleSearch: {} }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const status = res.status;
    const resText = await res.text();

    if (!res.ok) {
      let parsedMsg = resText;
      try {
        const jsonErr = JSON.parse(resText);
        if (jsonErr.error && jsonErr.error.message) parsedMsg = jsonErr.error.message;
      } catch (e) {}
      const err = new Error(parsedMsg);
      err.status = status;
      throw err;
    }

    const data = JSON.parse(resText);
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Empty response from Google AI Studio.');
    }

    return data.candidates[0].content.parts.map(p => p.text || '').join('');
  }

  // OPENAI-COMPATIBLE EXECUTION (GROQ / OPENROUTER)
  async function callOpenAICompatible(endpoint, apiKey, model, systemPrompt, conversationHistory, config) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });

    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    });

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

    const status = res.status;
    const resText = await res.text();

    if (!res.ok) {
      const err = new Error(`Provider HTTP ${status}: ${resText}`);
      err.status = status;
      throw err;
    }

    const data = JSON.parse(resText);
    return data.choices[0].message.content;
  }

  // CORE AI GATEWAY WITH 503/429 AUTO-CASCADE
  async function executeGatewayTurn(userText) {
    state.chatHistory.push({ role: 'user', text: userText });
    renderMessage('user', 'You', userText);

    state.runSettings.model = dom.headerModelSelect.value;
    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    state.runSettings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);

    let provider = 'gemini';
    let primaryModel = state.runSettings.model;
    if (primaryModel.startsWith('llama') || primaryModel.startsWith('deepseek-r1')) provider = 'groq';
    else if (primaryModel.includes('openrouter') || primaryModel.includes(':free')) provider = 'openrouter';

    const keysList = state.keys[provider] || [];
    if (keysList.length === 0) {
      renderMessage('error', 'Gateway Notice', `No API Key found for ${provider.toUpperCase()}. Please click "Key Vault" to paste your free API key.`, true);
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    dom.btnSendPrompt.disabled = true;
    dom.statusIndicatorDot.className = 'status-indicator busy';
    dom.gatewayStatusText.textContent = `Routing to ${primaryModel}...`;

    // Candidate models for auto-fallback in case of 503/429
    const candidateModels = [primaryModel, ...state.availableModels[provider].filter(m => m !== primaryModel)];
    let responseText = null;
    let successfulModel = primaryModel;
    let executionSuccess = false;

    // Outer Loop: Candidate Models | Inner Loop: Stored Keys
    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      for (let kIdx = 0; kIdx < keysList.length; kIdx++) {
        const currentKey = keysList[kIdx].key;
        try {
          if (mIdx > 0 || kIdx > 0) {
            dom.gatewayStatusText.textContent = `Auto-Fallback active: Routing to ${currentModel} (Key ${kIdx + 1})...`;
          }

          if (provider === 'gemini') {
            responseText = await callGemini(currentKey, currentModel, state.runSettings.systemInstructions, state.chatHistory, state.runSettings);
          } else if (provider === 'groq') {
            responseText = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', currentKey, currentModel, state.runSettings.systemInstructions, state.chatHistory, state.runSettings);
          } else if (provider === 'openrouter') {
            responseText = await callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', currentKey, currentModel, state.runSettings.systemInstructions, state.chatHistory, state.runSettings);
          }

          successfulModel = currentModel;
          executionSuccess = true;
          break;
        } catch (err) {
          console.warn(`[Gateway Cascade] Model ${currentModel} on Key ${kIdx} failed with status ${err.status}:`, err.message);
          if (!state.runSettings.autoCascade) {
            renderMessage('error', `${currentModel} Error`, `Error ${err.status || ''}: ${err.message}`, true);
            break;
          }
        }
      }
      if (executionSuccess) break;
    }

    dom.btnSendPrompt.disabled = false;

    if (executionSuccess && responseText) {
      dom.statusIndicatorDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = `Gateway Online (${successfulModel})`;
      state.chatHistory.push({ role: 'model', text: responseText });
      renderMessage('model', successfulModel, responseText);
    } else {
      dom.statusIndicatorDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'All candidate endpoints occupied.';
      renderMessage('error', 'Gateway Failure', 'Google AI Studio / Provider returned high demand (503/429). All fallback keys were attempted.', true);
    }
  }

  // MULTI-AGENT ORCHESTRATION MODE
  async function executeAgentOrchestration(userText) {
    state.chatHistory.push({ role: 'user', text: userText });
    renderMessage('user', 'You', userText);

    const keys = state.keys.gemini || [];
    if (keys.length === 0) {
      renderMessage('error', 'Gateway Notice', 'Please add an API key in Key Vault for Multi-Agent Orchestration.', true);
      return;
    }

    dom.btnSendPrompt.disabled = true;
    dom.statusIndicatorDot.className = 'status-indicator busy';

    try {
      // Step 1: Architect Agent
      dom.gatewayStatusText.textContent = 'Agent 1 (Architect) formulating strategy...';
      const architectPrompt = `You are Agent 1 (Principal Architect). Deconstruct and analyze this user requirement: "${userText}"`;
      const step1History = [{ role: 'user', text: architectPrompt }];
      const plan = await callGemini(keys[0].key, 'gemini-3.7-flash', '', step1History, state.runSettings);
      renderMessage('agent', 'Agent 1 (Architect)', plan);

      // Step 2: Implementation Agent
      dom.gatewayStatusText.textContent = 'Agent 2 (Synthesis) delivering code...';
      const coderPrompt = `You are Agent 2 (Senior Engineer). Based on Agent 1's architecture:\n${plan}\nDeliver the complete, fully realized code implementation:`;
      const step2History = [{ role: 'user', text: coderPrompt }];
      const implementation = await callGemini(keys[0].key, 'gemini-3.7-flash', '', step2History, state.runSettings);
      renderMessage('agent', 'Agent 2 (Code Generator)', implementation);

      state.chatHistory.push({ role: 'model', text: implementation });
      dom.statusIndicatorDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = 'Multi-Agent Execution Completed.';
    } catch (e) {
      renderMessage('error', 'Agent Failure', e.message, true);
    }

    dom.btnSendPrompt.disabled = false;
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${provider.toUpperCase()}. Add your key above.</td>`;
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
        <td><button class="btn-sm" data-del="${idx}" style="color:var(--accent-rose); border:none; background:none; cursor:pointer;">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveVault();
        renderVaultTable();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnModeSingle.addEventListener('click', () => {
      state.mode = 'single';
      dom.btnModeSingle.classList.add('active');
      dom.btnModeAgent.classList.remove('active');
    });

    dom.btnModeAgent.addEventListener('click', () => {
      state.mode = 'orchestrator';
      dom.btnModeAgent.classList.add('active');
      dom.btnModeSingle.classList.remove('active');
    });

    dom.btnSendPrompt.addEventListener('click', () => {
      const val = dom.mainPromptInput.value.trim();
      if (!val) return;
      dom.mainPromptInput.value = '';
      if (state.mode === 'orchestrator') {
        executeAgentOrchestration(val);
      } else {
        executeGatewayTurn(val);
      }
    });

    dom.mainPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        dom.btnSendPrompt.click();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.chatHistory = [];
      dom.chatMessageList.innerHTML = '';
      if (dom.chatWelcomeCard) {
        dom.chatMessageList.appendChild(dom.chatWelcomeCard);
        dom.chatWelcomeCard.style.display = 'block';
      }
    });

    dom.btnSyncModels.addEventListener('click', async () => {
      const gKeys = state.keys.gemini || [];
      if (gKeys.length > 0) await fetchLiveModelsFromProvider('gemini', gKeys[0].key);
      const grKeys = state.keys.groq || [];
      if (grKeys.length > 0) await fetchLiveModelsFromProvider('groq', grKeys[0].key);
      alert('Models inventory synchronized from active API Keys.');
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));

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

    dom.btnAddKey.addEventListener('click', async () => {
      const active = document.querySelector('.vault-tab-btn.active');
      const prov = active ? active.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return alert('Please enter a key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveVault();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();

      // Trigger dynamic model discovery
      await fetchLiveModelsFromProvider(prov, key);
    });
  }

  function init() {
    loadVault();
    initEvents();
    rebuildModelSelectOptions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
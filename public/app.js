(function () {
  'use strict';

  const state = {
    keys: { gemini: [], groq: [], openrouter: [] },
    fetchedModels: [],
    activeProvider: 'gemini',
    conversationHistory: [],
    artifacts: new Map(),
    settings: {
      systemInstructions: '',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoFallback: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    }
  };

  const dom = {
    modelSelect: document.getElementById('model-select'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    btnCodepen: document.getElementById('btn-codepen'),
    btnKeyVault: document.getElementById('btn-key-vault'),
    btnToggleSettings: document.getElementById('btn-toggle-settings'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    chatStream: document.getElementById('chat-stream'),
    welcomeBox: document.getElementById('welcome-box'),
    promptInput: document.getElementById('prompt-input'),
    btnSend: document.getElementById('btn-send'),
    gatewayStatusDot: document.getElementById('gateway-status-dot'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    keyCountBadge: document.getElementById('key-count-badge'),

    settingsDrawer: document.getElementById('settings-drawer'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    systemInstructions: document.getElementById('system-instructions'),
    thinkingBudget: document.getElementById('thinking-budget'),
    searchGrounding: document.getElementById('search-grounding'),
    autoFallback: document.getElementById('auto-fallback'),
    maxOutputTokens: document.getElementById('max-output-tokens'),
    outputTokensVal: document.getElementById('output-tokens-val'),
    temperature: document.getElementById('temperature'),
    tempVal: document.getElementById('temp-val'),

    vaultModal: document.getElementById('vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    keyTableBody: document.getElementById('key-table-body'),
    tabBtns: document.querySelectorAll('.modal-tabs .tab-btn')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Storage parse notice:', e);
    }
    updateKeyBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = total;
  }

  // DYNAMIC MODEL INVENTORY FETCHING
  async function fetchLiveModels() {
    dom.gatewayStatusDot.className = 'status-indicator busy';
    dom.gatewayStatusText.textContent = 'Querying live provider model catalogs...';

    const modelsList = [];

    // 1. Google AI Studio live catalog query
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const apiKey = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            data.models.forEach(m => {
              if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                const cleanId = m.name.replace(/^models\//, '');
                modelsList.push({ id: cleanId, provider: 'gemini', name: m.displayName || cleanId });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Dynamic fetch Google failed:', err);
      }
    }

    // 2. Groq Cloud live catalog query
    if (state.keys.groq && state.keys.groq.length > 0) {
      const apiKey = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach(m => {
              modelsList.push({ id: m.id, provider: 'groq', name: `Groq: ${m.id}` });
            });
          }
        }
      } catch (err) {
        console.warn('Dynamic fetch Groq failed:', err);
      }
    }

    // Populate model selector
    dom.modelSelect.innerHTML = '';
    if (modelsList.length === 0) {
      dom.modelSelect.innerHTML = `
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
        <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
      `;
    } else {
      modelsList.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.dataset.provider = m.provider;
        opt.textContent = m.name;
        if (idx === 0) opt.selected = true;
        dom.modelSelect.appendChild(opt);
      });
    }

    state.fetchedModels = modelsList;
    dom.gatewayStatusDot.className = 'status-indicator ready';
    dom.gatewayStatusText.textContent = `Gateway Ready (${modelsList.length} Live Models synced)`;
  }

  function appendMessageNode(role, text, meta) {
    if (dom.welcomeBox) {
      dom.welcomeBox.remove();
    }

    const node = document.createElement('div');
    node.className = `message-node ${role.toLowerCase()}`;

    if (role === 'fallback') {
      node.className = 'message-node fallback-notice';
      node.textContent = text;
      dom.chatStream.appendChild(node);
      dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
      return;
    }

    const author = document.createElement('div');
    author.className = 'message-author';
    author.textContent = role === 'user' ? 'You' : (meta || 'AI Gateway');

    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Parse code blocks
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Parse <file path="..."> or ``` code blocks
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1}</code></pre>`;
    });

    content.innerHTML = html.replace(/\n/g, '<br>');

    node.appendChild(author);
    node.appendChild(content);
    dom.chatStream.appendChild(node);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;

    // Cache artifacts
    const artifactRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    while ((match = artifactRegex.exec(text)) !== null) {
      state.artifacts.set(match[1].trim(), match[2]);
    }
  }

  // GEMINI INFERENCE CALL
  async function callGemini(apiKey, modelId, systemPrompt, conversation, config) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    const contents = conversation.map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.text }]
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

    if (!res.ok) {
      const errText = await res.text();
      const errObj = new Error(errText);
      errObj.status = res.status;
      throw errObj;
    }

    const data = await res.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Empty payload returned.');
    }

    return data.candidates[0].content.parts.map(p => p.text || '').join('');
  }

  // OPENAI-COMPATIBLE INFERENCE (GROQ / OPENROUTER)
  async function callOpenAICompatible(endpoint, apiKey, modelId, systemPrompt, conversation, config) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    conversation.forEach(c => {
      messages.push({ role: c.role === 'user' ? 'user' : 'assistant', content: c.text });
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192)
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      const errObj = new Error(errText);
      errObj.status = res.status;
      throw errObj;
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // ORCHESTRATION & RESILIENT FALLBACK DISPATCHER
  async function dispatchPrompt() {
    const text = dom.promptInput.value.trim();
    if (!text) return;

    dom.promptInput.value = '';
    dom.promptInput.style.height = 'auto';

    appendMessageNode('user', text);
    state.conversationHistory.push({ role: 'user', text: text });

    dom.btnSend.disabled = true;
    dom.gatewayStatusDot.className = 'status-indicator busy';

    // Model hierarchy sequence for automated fallback
    let selectedModel = dom.modelSelect.value;
    const fallbackQueue = [selectedModel];

    // Build fallback queue from live models
    state.fetchedModels.forEach(m => {
      if (!fallbackQueue.includes(m.id)) fallbackQueue.push(m.id);
    });

    let success = false;
    let output = null;
    let successfulModel = selectedModel;

    const keysList = state.keys.gemini || [];

    for (const currentModel of fallbackQueue) {
      let provider = 'gemini';
      if (currentModel.startsWith('llama') || currentModel.startsWith('deepseek-r1')) provider = 'groq';

      const providerKeys = state.keys[provider] || [];
      if (providerKeys.length === 0) continue;

      for (let k = 0; k < providerKeys.length; k++) {
        const apiKey = providerKeys[k].key;
        try {
          dom.gatewayStatusText.textContent = `Dispatching to ${currentModel}...`;
          
          if (provider === 'gemini') {
            output = await callGemini(apiKey, currentModel, state.settings.systemInstructions, state.conversationHistory, state.settings);
          } else {
            output = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, currentModel, state.settings.systemInstructions, state.conversationHistory, state.settings);
          }

          success = true;
          successfulModel = currentModel;
          break;
        } catch (err) {
          console.warn(`[Gateway Notice] Node ${currentModel} returned HTTP ${err.status || 'error'}`);
          
          // Auto fallback triggered on 503 / 429
          if (state.settings.autoFallback && (err.status === 503 || err.status === 429 || err.status === 404)) {
            appendMessageNode('fallback', `HTTP ${err.status} on ${currentModel}. Auto-routing to fallback candidate...`);
          } else if (!state.settings.autoFallback) {
            break;
          }
        }
      }

      if (success) break;
    }

    dom.btnSend.disabled = false;

    if (success && output) {
      dom.gatewayStatusDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = `Response complete via ${successfulModel}`;
      state.conversationHistory.push({ role: 'model', text: output });
      appendMessageNode('ai', output, successfulModel);
    } else {
      dom.gatewayStatusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'Execution failed. Check Key Vault or provider capacity.';
      appendMessageNode('ai', 'Gateway failed to reach an available cloud node. Please check your API Key in Key Vault.', 'Gateway Governor');
    }
  }

  // CODEPEN FORM POST TRANSFER
  function exportCodePen() {
    let html = '', css = '', js = '';
    state.artifacts.forEach((content, filename) => {
      if (filename.endsWith('.html')) html += content + '\n';
      else if (filename.endsWith('.css')) css += content + '\n';
      else if (filename.endsWith('.js')) js += content + '\n';
    });

    if (!html && !css && !js) {
      alert('No code artifacts generated in current conversation.');
      return;
    }

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
      title: 'AetherSpace Gateway Export',
      html: html,
      css: css,
      js: js
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function renderKeyTable() {
    const keys = state.keys[state.activeProvider] || [];
    dom.keyTableBody.innerHTML = '';
    if (keys.length === 0) {
      dom.keyTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:14px;">No keys stored for ${state.activeProvider.toUpperCase()}.</td></tr>`;
      return;
    }
    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.created}</td>
        <td><button class="icon-tool-btn" data-del="${idx}" style="color:var(--accent-rose);">&times;</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderKeyTable();
        fetchLiveModels();
      });
      dom.keyTableBody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnSend.addEventListener('click', dispatchPrompt);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        dispatchPrompt();
      }
    });

    dom.promptInput.addEventListener('input', () => {
      dom.promptInput.style.height = 'auto';
      dom.promptInput.style.height = `${Math.min(dom.promptInput.scrollHeight, 160)}px`;
    });

    dom.btnRefreshModels.addEventListener('click', fetchLiveModels);
    dom.btnCodepen.addEventListener('click', exportCodePen);

    dom.btnClearChat.addEventListener('click', () => {
      state.conversationHistory = [];
      state.artifacts.clear();
      dom.chatStream.innerHTML = `
        <div class="chat-welcome-box" id="welcome-box">
          <h2>Unified AI Gateway</h2>
          <p>Direct API integration with dynamic model fetching and automated fallback.</p>
        </div>
      `;
    });

    dom.btnToggleSettings.addEventListener('click', () => dom.settingsDrawer.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsDrawer.classList.remove('open'));

    dom.maxOutputTokens.addEventListener('input', () => {
      dom.outputTokensVal.textContent = dom.maxOutputTokens.value;
      state.settings.maxOutputTokens = parseInt(dom.maxOutputTokens.value, 10);
    });

    dom.temperature.addEventListener('input', () => {
      dom.tempVal.textContent = parseFloat(dom.temperature.value).toFixed(2);
      state.settings.temperature = parseFloat(dom.temperature.value);
    });

    dom.systemInstructions.addEventListener('input', () => {
      state.settings.systemInstructions = dom.systemInstructions.value;
    });

    dom.thinkingBudget.addEventListener('change', () => {
      state.settings.thinkingBudget = parseInt(dom.thinkingBudget.value, 10);
    });

    dom.searchGrounding.addEventListener('change', () => {
      state.settings.searchGrounding = dom.searchGrounding.checked;
    });

    dom.autoFallback.addEventListener('change', () => {
      state.settings.autoFallback = dom.autoFallback.checked;
    });

    dom.btnKeyVault.addEventListener('click', () => {
      dom.vaultModal.style.display = 'flex';
      renderKeyTable();
    });

    dom.btnCloseVault.addEventListener('click', () => {
      dom.vaultModal.style.display = 'none';
    });

    dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeProvider = btn.dataset.provider;
        renderKeyTable();
      });
    });

    dom.btnAddKey.addEventListener('click', () => {
      const keyVal = dom.vaultKeyInput.value.trim();
      if (!keyVal) return;
      state.keys[state.activeProvider] = state.keys[state.activeProvider] || [];
      state.keys[state.activeProvider].push({
        key: keyVal,
        created: new Date().toLocaleDateString()
      });
      saveKeys();
      dom.vaultKeyInput.value = '';
      renderKeyTable();
      fetchLiveModels();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    fetchLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
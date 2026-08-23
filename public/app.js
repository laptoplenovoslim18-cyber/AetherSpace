(function () {
  'use strict';

  const state = {
    activeProvider: 'gemini',
    activeModel: '',
    modelsByProvider: { gemini: [], groq: [], openrouter: [] },
    keys: { gemini: [], groq: [], openrouter: [] },
    settings: {
      systemInstructions: '',
      thinkingBudget: 0,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    conversation: []
  };

  const dom = {
    modelSelect: document.getElementById('model-select'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    chatStream: document.getElementById('chat-stream'),
    chatEmptyView: document.getElementById('chat-empty-view'),
    promptInput: document.getElementById('prompt-input'),
    btnSend: document.getElementById('btn-send'),
    statusText: document.getElementById('status-text'),
    keyCountBadge: document.getElementById('key-count-badge'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),

    toggleSettingsBtn: document.getElementById('toggle-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val'),
    settingOutputLength: document.getElementById('setting-output-length'),
    settingOutputLengthVal: document.getElementById('setting-output-length-val')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {}
    updateKeyBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const count = Object.values(state.keys).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = count;
  }

  // DYNAMIC MODEL FETCHING DIRECTLY FROM PROVIDER APIs
  async function fetchLiveModels(provider) {
    const keys = state.keys[provider] || [];
    if (keys.length === 0) return [];

    const apiKey = keys[0].key;
    dom.statusText.textContent = `Fetching live models for ${provider.toUpperCase()}...`;

    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .sort((a, b) => b.localeCompare(a));
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.data || []).map(m => m.id).sort();
      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return (data.data || []).map(m => m.id).sort();
      }
    } catch (err) {
      console.warn(`Could not fetch models dynamically for ${provider}:`, err.message);
      return [];
    }
    return [];
  }

  async function populateModelCatalog() {
    dom.modelSelect.innerHTML = '';
    let totalModels = 0;

    for (const provider of ['gemini', 'groq', 'openrouter']) {
      const models = await fetchLiveModels(provider);
      state.modelsByProvider[provider] = models;

      if (models.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = provider.toUpperCase();

        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = `${provider}:${m}`;
          opt.textContent = m;
          optgroup.appendChild(opt);
          totalModels++;
        });

        dom.modelSelect.appendChild(optgroup);
      }
    }

    if (totalModels === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = 'No active models (Add key in Vault)';
      dom.modelSelect.appendChild(opt);
      state.activeModel = '';
    } else {
      state.activeModel = dom.modelSelect.value;
      dom.statusText.textContent = 'Ready';
    }
  }

  function appendChatBubble(role, author, content) {
    if (dom.chatEmptyView) dom.chatEmptyView.style.display = 'none';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = author;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';
    body.innerHTML = renderMarkdown(content);

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.chatStream.appendChild(bubble);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
    return body;
  }

  function renderMarkdown(txt) {
    return txt
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  }

  // SSE STREAMING FOR GEMINI
  async function* streamGemini(apiKey, model, messages, config) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (config.systemInstructions && config.systemInstructions.trim()) {
      body.systemInstruction = { parts: [{ text: config.systemInstructions }] };
    }

    if (config.thinkingBudget > 0) {
      body.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunkText = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
            if (chunkText) yield chunkText;
          } catch (e) {}
        }
      }
    }
  }

  // OPENAI-COMPATIBLE STREAM (GROQ / OPENROUTER)
  async function* streamOpenAI(endpoint, apiKey, model, messages, config) {
    const payloadMsgs = [];
    if (config.systemInstructions && config.systemInstructions.trim()) {
      payloadMsgs.push({ role: 'system', content: config.systemInstructions });
    }
    messages.forEach(m => payloadMsgs.push(m));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: payloadMsgs,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.choices?.[0]?.delta?.content || '';
            if (chunk) yield chunk;
          } catch (e) {}
        }
      }
    }
  }

  // DISPATCHER WITH AUTOMATIC RETRY & CASCADE FALLBACK
  async function handleSend() {
    const text = dom.promptInput.value.trim();
    if (!text) return;

    if (!dom.modelSelect.value) {
      alert('Please configure an API Key in the Vault first.');
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    const [provider, modelName] = dom.modelSelect.value.split(':');
    const keys = state.keys[provider] || [];

    if (keys.length === 0) {
      alert(`No active keys found for ${provider.toUpperCase()}.`);
      return;
    }

    state.conversation.push({ role: 'user', content: text });
    appendChatBubble('user', 'You', text);
    dom.promptInput.value = '';

    dom.btnSend.disabled = true;
    dom.statusText.textContent = `Streaming from ${modelName}...`;

    const aiBubbleBody = appendChatBubble('ai', modelName, '');
    let accumulatedResponse = '';
    let success = false;

    // Retry + Model Cascade Loop
    const modelsToAttempt = [modelName, ...(state.modelsByProvider[provider] || []).filter(m => m !== modelName)];

    outerLoop:
    for (const currentModel of modelsToAttempt) {
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const apiKey = keys[kIdx].key;

        // Try up to 2 attempts for 503 spikes
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) {
              dom.statusText.textContent = `Demand spike retry (${attempt}/2) on ${currentModel}...`;
              await new Promise(r => setTimeout(r, 1200));
            }

            accumulatedResponse = '';
            aiBubbleBody.innerHTML = '';

            let streamGenerator = null;
            if (provider === 'gemini') {
              streamGenerator = streamGemini(apiKey, currentModel, state.conversation, state.settings);
            } else if (provider === 'groq') {
              streamGenerator = streamOpenAI('https://api.groq.com/openai/v1/chat/completions', apiKey, currentModel, state.conversation, state.settings);
            } else if (provider === 'openrouter') {
              streamGenerator = streamOpenAI('https://openrouter.ai/api/v1/chat/completions', apiKey, currentModel, state.conversation, state.settings);
            }

            for await (const chunk of streamGenerator) {
              accumulatedResponse += chunk;
              aiBubbleBody.innerHTML = renderMarkdown(accumulatedResponse);
              dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
            }

            success = true;
            break outerLoop;
          } catch (err) {
            console.warn(`[Inference] ${currentModel} (Key ${kIdx + 1}, Attempt ${attempt}) failed:`, err);
            if (err.status !== 503 && err.status !== 429) {
              break; // Unrecoverable client error, switch key or model
            }
          }
        }
      }
    }

    dom.btnSend.disabled = false;

    if (success) {
      state.conversation.push({ role: 'assistant', content: accumulatedResponse });
      dom.statusText.textContent = 'Ready';
    } else {
      aiBubbleBody.innerHTML = '<em>All provider models are currently unavailable. Please verify your keys in the Vault.</em>';
      dom.statusText.textContent = 'Error';
    }
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" style="text-align:center; color:var(--text-muted); padding:12px;">No keys stored.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default'}</td>
        <td><button class="icon-tool-btn" data-del="${idx}" style="color:var(--accent-rose);">&times;</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
        populateModelCatalog();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnSend.addEventListener('click', handleSend);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnRefreshModels.addEventListener('click', () => populateModelCatalog());

    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'none';
      populateModelCatalog();
    });

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

      if (!key) return;
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      populateModelCatalog();
    });

    dom.toggleSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingSystemInstructions.addEventListener('input', () => {
      state.settings.systemInstructions = dom.settingSystemInstructions.value;
    });
    dom.settingThinkingLevel.addEventListener('change', () => {
      state.settings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    });
    dom.settingTemp.addEventListener('input', () => {
      dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2);
      state.settings.temperature = parseFloat(dom.settingTemp.value);
    });
    dom.settingOutputLength.addEventListener('input', () => {
      dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value;
      state.settings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    });
  }

  function init() {
    loadKeys();
    initEvents();
    populateModelCatalog();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
(function () {
  'use strict';

  const state = {
    mode: 'direct', // direct | multiagent | orchestration
    activeProvider: 'gemini',
    activeModel: '',
    availableModels: {
      gemini: [],
      groq: [],
      openrouter: []
    },
    runSettings: {
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: false,
      autoCascade: true,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    keys: {
      gemini: [],
      groq: [],
      openrouter: []
    },
    history: []
  };

  const dom = {
    messageFeed: document.getElementById('message-feed'),
    chatInput: document.getElementById('chat-input'),
    btnSendMessage: document.getElementById('btn-send-message'),
    btnClearFeed: document.getElementById('btn-clear-feed'),
    headerModelSelect: document.getElementById('header-model-select'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    keyCountBadge: document.getElementById('key-count-badge'),
    modeBtns: document.querySelectorAll('.mode-btn'),

    settingsDrawer: document.getElementById('settings-drawer'),
    btnToggleSettings: document.getElementById('btn-toggle-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingTemperature: document.getElementById('setting-temperature'),
    valTemperature: document.getElementById('val-temperature'),
    settingMaxTokens: document.getElementById('setting-max-tokens'),
    valMaxTokens: document.getElementById('val-max-tokens'),

    vaultModal: document.getElementById('vault-modal'),
    btnOpenVault: document.getElementById('btn-open-vault'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnSaveKey: document.getElementById('btn-save-key'),
    vaultTableBody: document.getElementById('vault-table-body'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn')
  };

  function loadPersistedData() {
    try {
      const keysRaw = localStorage.getItem('aetherspace_keys');
      if (keysRaw) state.keys = Object.assign(state.keys, JSON.parse(keysRaw));
    } catch (e) {
      console.warn('Could not parse persisted keys', e);
    }
    updateKeyBadge();
  }

  function savePersistedKeys() {
    localStorage.setItem('aetherspace_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // DYNAMIC LIVE MODEL DISCOVERY FROM PROVIDER APIS
  async function fetchLiveModels(provider, apiKey) {
    if (!apiKey) return [];
    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          return data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .sort((a, b) => b.localeCompare(a));
        }
      } else if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map(m => m.id).filter(id => id.includes('llama') || id.includes('deepseek') || id.includes('mixtral'));
        }
      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.filter(m => m.id.includes(':free')).map(m => m.id);
        }
      }
    } catch (err) {
      console.warn(`[Model Discovery] Provider ${provider} notice:`, err.message);
    }
    return [];
  }

  async function refreshAllModels() {
    let populated = 0;
    for (const prov of ['gemini', 'groq', 'openrouter']) {
      const keys = state.keys[prov] || [];
      if (keys.length > 0) {
        const models = await fetchLiveModels(prov, keys[0].key);
        if (models.length > 0) {
          state.availableModels[prov] = models;
          populated++;
        }
      }
    }

    renderModelDropdown();
  }

  function renderModelDropdown() {
    dom.headerModelSelect.innerHTML = '';
    let totalModels = 0;

    for (const [prov, models] of Object.entries(state.availableModels)) {
      if (models.length > 0) {
        const group = document.createElement('optgroup');
        group.label = prov.toUpperCase();
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = `${prov}:${m}`;
          opt.textContent = `${m} (${prov})`;
          group.appendChild(opt);
          totalModels++;
        });
        dom.headerModelSelect.appendChild(group);
      }
    }

    if (totalModels === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No models loaded (Add API Key)';
      dom.headerModelSelect.appendChild(opt);
      state.activeModel = '';
    } else {
      if (!state.activeModel || !dom.headerModelSelect.querySelector(`option[value="${state.activeModel}"]`)) {
        state.activeModel = dom.headerModelSelect.options[0].value;
      }
      dom.headerModelSelect.value = state.activeModel;
    }
  }

  function renderMessage(role, content, modelTag = '') {
    const card = document.createElement('div');
    card.className = `message-card ${role}`;

    const meta = document.createElement('div');
    meta.className = `message-meta ${role}`;
    meta.textContent = role === 'user' ? 'YOU' : (modelTag ? modelTag.toUpperCase() : 'ASSISTANT');

    const body = document.createElement('div');
    body.className = 'message-body';
    body.innerHTML = formatMarkdown(content);

    card.appendChild(meta);
    card.appendChild(body);
    dom.messageFeed.appendChild(card);
    dom.messageFeed.scrollTop = dom.messageFeed.scrollHeight;
    return body;
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  }

  // REAL-TIME SSE STREAMING / FETCH LOGIC
  async function streamGeminiContent(apiKey, model, systemPrompt, userMessage, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: state.runSettings.temperature,
        maxOutputTokens: state.runSettings.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (state.runSettings.thinkingBudget > 0) {
      payload.generationConfig.thinkingConfig = { thinkingBudget: state.runSettings.thinkingBudget };
    }

    if (state.runSettings.searchGrounding) {
      payload.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API HTTP ${response.status}: ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
              const text = data.candidates[0].content.parts[0].text;
              accumulated += text;
              onChunk(accumulated);
            }
          } catch (e) {}
        }
      }
    }

    return accumulated;
  }

  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, userMessage, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: state.runSettings.temperature,
        max_tokens: Math.min(state.runSettings.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Provider HTTP ${response.status}: ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.substring(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            accumulated += delta;
            onChunk(accumulated);
          } catch (e) {}
        }
      }
    }

    return accumulated;
  }

  async function handleSend() {
    const text = dom.chatInput.value.trim();
    if (!text) return;

    if (!state.activeModel) {
      renderMessage('system', 'Please configure an API Key in the Key Vault first.');
      dom.vaultModal.style.display = 'flex';
      return;
    }

    const [provider, modelName] = state.activeModel.split(':');
    const keys = state.keys[provider] || [];

    if (keys.length === 0) {
      renderMessage('system', `No API key available for ${provider.toUpperCase()}.`);
      return;
    }

    renderMessage('user', text);
    dom.chatInput.value = '';
    dom.btnSendMessage.disabled = true;

    // TARGET RESPONSE BUBBLE FOR LIVE STREAMING
    const responseBodyEl = renderMessage('assistant', '...', modelName);

    let success = false;
    let fallbackIndex = 0;
    const modelPool = state.availableModels[provider] || [modelName];

    for (let m = 0; m < modelPool.length; m++) {
      const currentModel = modelPool[m];
      for (let k = 0; k < keys.length; k++) {
        try {
          if (provider === 'gemini') {
            await streamGeminiContent(
              keys[k].key,
              currentModel,
              state.runSettings.systemInstructions,
              text,
              (streamedText) => {
                responseBodyEl.innerHTML = formatMarkdown(streamedText);
                dom.messageFeed.scrollTop = dom.messageFeed.scrollHeight;
              }
            );
          } else if (provider === 'groq') {
            await streamOpenAICompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              keys[k].key,
              currentModel,
              state.runSettings.systemInstructions,
              text,
              (streamedText) => {
                responseBodyEl.innerHTML = formatMarkdown(streamedText);
                dom.messageFeed.scrollTop = dom.messageFeed.scrollHeight;
              }
            );
          } else if (provider === 'openrouter') {
            await streamOpenAICompatible(
              'https://openrouter.ai/api/v1/chat/completions',
              keys[k].key,
              currentModel,
              state.runSettings.systemInstructions,
              text,
              (streamedText) => {
                responseBodyEl.innerHTML = formatMarkdown(streamedText);
                dom.messageFeed.scrollTop = dom.messageFeed.scrollHeight;
              }
            );
          }

          success = true;
          break;
        } catch (err) {
          console.warn(`[Failover] Model ${currentModel} (Key ${k + 1}) returned:`, err.message);
          if (!state.runSettings.autoCascade) {
            responseBodyEl.innerHTML = formatMarkdown(`Error: ${err.message}`);
            break;
          }
        }
      }
      if (success) break;
    }

    if (!success) {
      responseBodyEl.innerHTML = formatMarkdown('All available keys and model endpoints were unavailable or rate-limited. Please verify keys in Key Vault.');
    }

    dom.btnSendMessage.disabled = false;
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const prov = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[prov] || [];

    dom.vaultTableBody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${prov.toUpperCase()}.</td>`;
      dom.vaultTableBody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default'}</td>
        <td><span class="badge">Active</span></td>
        <td><button class="btn-delete" data-del="${idx}">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        savePersistedKeys();
        renderVaultTable();
        refreshAllModels();
      });
      dom.vaultTableBody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnSendMessage.addEventListener('click', handleSend);
    dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnClearFeed.addEventListener('click', () => {
      dom.messageFeed.innerHTML = '';
    });

    dom.headerModelSelect.addEventListener('change', () => {
      state.activeModel = dom.headerModelSelect.value;
    });

    dom.btnRefreshModels.addEventListener('click', refreshAllModels);

    dom.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        renderMessage('system', `Switched mode to: ${state.mode.toUpperCase()}`);
      });
    });

    dom.btnToggleSettings.addEventListener('click', () => dom.settingsDrawer.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsDrawer.classList.remove('open'));

    dom.settingTemperature.addEventListener('input', () => {
      state.runSettings.temperature = parseFloat(dom.settingTemperature.value);
      dom.valTemperature.textContent = state.runSettings.temperature.toFixed(2);
    });

    dom.settingMaxTokens.addEventListener('input', () => {
      state.runSettings.maxOutputTokens = parseInt(dom.settingMaxTokens.value, 10);
      dom.valMaxTokens.textContent = state.runSettings.maxOutputTokens;
    });

    dom.settingThinkingBudget.addEventListener('change', () => {
      state.runSettings.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10);
    });

    dom.settingSearchGrounding.addEventListener('change', () => {
      state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    });

    dom.settingAutoCascade.addEventListener('change', () => {
      state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    });

    dom.settingSystemInstructions.addEventListener('input', () => {
      state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    });

    dom.btnOpenVault.addEventListener('click', () => {
      dom.vaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.vaultModal.style.display = 'none');

    dom.vaultTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.vaultTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderVaultTable();
      });
    });

    dom.btnSaveKey.addEventListener('click', async () => {
      const activeTab = document.querySelector('.vault-tab-btn.active');
      const prov = activeTab ? activeTab.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return;

      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label });
      savePersistedKeys();

      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();

      await refreshAllModels();
    });
  }

  function init() {
    loadPersistedData();
    initEvents();
    refreshAllModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
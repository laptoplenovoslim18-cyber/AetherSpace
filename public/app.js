(function () {
  'use strict';

  const state = {
    activeProvider: 'gemini',
    activeModel: '',
    models: {
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b'],
      openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free']
    },
    attachedFiles: [],
    settings: {
      systemInstructions: '',
      thinkingBudget: 4096,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    modelSelect: document.getElementById('model-select'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnOpenVault: document.getElementById('btn-open-vault'),
    keyCountBadge: document.getElementById('key-count-badge'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    chatStream: document.getElementById('chat-stream'),
    chatEmptyHero: document.getElementById('chat-empty-hero'),

    contextPreviewBar: document.getElementById('context-preview-bar'),
    contextFileCount: document.getElementById('context-file-count'),
    btnClearContext: document.getElementById('btn-clear-context'),
    btnAttachFiles: document.getElementById('btn-attach-files'),
    fileUploader: document.getElementById('file-uploader'),
    userPromptInput: document.getElementById('user-prompt-input'),
    btnSubmitPrompt: document.getElementById('btn-submit-prompt'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultTabs: document.querySelectorAll('.vault-tab'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddVaultKey: document.getElementById('btn-add-vault-key'),
    vaultKeysTableBody: document.getElementById('vault-keys-table-body'),

    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingSysInstructions: document.getElementById('setting-sys-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingThinkingVal: document.getElementById('setting-thinking-val'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault key load note:', e);
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

  // DYNAMIC MODEL INVENTORY FETCHING
  async function syncLiveModels() {
    const prov = state.activeProvider;
    const keys = state.keys[prov] || [];

    if (keys.length === 0) {
      dom.statusText.textContent = `No API key for ${prov.toUpperCase()}. Using verified defaults.`;
      populateModelDropdown();
      return;
    }

    const apiKey = keys[0].key;
    dom.statusText.textContent = `Fetching live active models from ${prov.toUpperCase()} API...`;
    dom.statusIndicator.className = 'status-dot busy';

    try {
      if (prov === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          const valid = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(name => !name.includes('embedding') && !name.includes('aqa'));
          if (valid.length > 0) state.models.gemini = valid;
        }
      } else if (prov === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          state.models.groq = data.data.map(m => m.id).filter(id => !id.includes('whisper'));
        }
      } else if (prov === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          state.models.openrouter = data.data.filter(m => m.id.includes(':free')).map(m => m.id);
        }
      }

      dom.statusIndicator.className = 'status-dot';
      dom.statusText.textContent = `Active models synchronized for ${prov.toUpperCase()}.`;
    } catch (err) {
      console.warn('Model fetch notice:', err.message);
      dom.statusIndicator.className = 'status-dot';
      dom.statusText.textContent = `Live sync notice: ${err.message}. Using verified model pool.`;
    }

    populateModelDropdown();
  }

  function populateModelDropdown() {
    dom.modelSelect.innerHTML = '';
    ['gemini', 'groq', 'openrouter'].forEach(prov => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = prov === 'gemini' ? 'Google AI Studio' : (prov === 'groq' ? 'Groq Cloud' : 'OpenRouter');

      (state.models[prov] || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = `${prov}::${m}`;
        opt.textContent = m;
        if (!state.activeModel && prov === 'gemini') {
          state.activeModel = m;
          opt.selected = true;
        }
        optgroup.appendChild(opt);
      });
      dom.modelSelect.appendChild(optgroup);
    });

    if (state.activeModel) {
      const targetVal = `${state.activeProvider}::${state.activeModel}`;
      if (dom.modelSelect.querySelector(`option[value="${targetVal}"]`)) {
        dom.modelSelect.value = targetVal;
      }
    }
  }

  function appendMessageBubble(author, initialText = '') {
    if (dom.chatEmptyHero) {
      dom.chatEmptyHero.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = `message-row ${author.toLowerCase()}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = author === 'User' ? 'You' : `${state.activeModel}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = renderFormattedContent(initialText);

    row.appendChild(meta);
    row.appendChild(bubble);
    dom.chatStream.appendChild(row);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;

    return {
      row,
      bubble,
      update: (text) => {
        bubble.innerHTML = renderFormattedContent(text);
        dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
      }
    };
  }

  function renderFormattedContent(raw) {
    if (!raw) return '';
    let escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Format Markdown codeblocks
    escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent)">Copy</button><code>${code}</code></pre>`;
    });

    // Format single line breaks
    return escaped.replace(/\n/g, '<br>');
  }

  // GEMINI LIVE STREAMING CALL VIA SSE
  async function streamGeminiContent(apiKey, model, systemPrompt, userPrompt, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: 8192
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (config.thinkingBudget > 0) {
      payload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (textChunk) onChunk(textChunk);
            } catch (e) {}
          }
        }
      }
    }
  }

  // OPENAI-COMPATIBLE STREAM (GROQ / OPENROUTER)
  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, userPrompt, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

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
        stream: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const textChunk = parsed.choices?.[0]?.delta?.content || '';
            if (textChunk) onChunk(textChunk);
          } catch (e) {}
        }
      }
    }
  }

  // EXECUTE INFERENCE WITH SEAMLESS AUTOMATED CASCADE
  async function executePrompt() {
    const prompt = dom.userPromptInput.value.trim();
    if (!prompt) return;

    dom.userPromptInput.value = '';
    appendMessageBubble('User', prompt);

    let fullPrompt = prompt;
    if (state.attachedFiles.length > 0) {
      let fileContext = '';
      state.attachedFiles.forEach(f => {
        fileContext += `\n[FILE: ${f.name}]\n${f.content}\n`;
      });
      fullPrompt = `CONTEXT FILES:\n${fileContext}\n\nUSER PROMPT:\n${prompt}`;
    }

    const [provider, model] = dom.modelSelect.value.split('::');
    state.activeProvider = provider;
    state.activeModel = model;

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      appendMessageBubble('Assistant', `No API Key stored for ${provider.toUpperCase()}. Please open Key Vault to add your free key.`);
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    dom.btnSubmitPrompt.disabled = true;
    dom.statusIndicator.className = 'status-dot busy';
    dom.statusText.textContent = `Streaming from ${model}...`;

    const assistantMsg = appendMessageBubble('Assistant', '');
    let accumulatedText = '';
    let completed = false;

    // KASKADE: Iteriere durch Schlüssel & Modelle bei 503 / 429
    const candidateModels = [model, ...(state.models[provider] || []).filter(m => m !== model)];

    outerLoop:
    for (const currentModel of candidateModels) {
      for (let k = 0; k < keys.length; k++) {
        const apiKey = keys[k].key;
        try {
          dom.statusText.textContent = `Routing to ${currentModel} (Key ${k + 1}/${keys.length})...`;
          accumulatedText = '';

          const onChunk = (chunk) => {
            accumulatedText += chunk;
            assistantMsg.update(accumulatedText);
          };

          if (provider === 'gemini') {
            await streamGeminiContent(apiKey, currentModel, state.settings.systemInstructions, fullPrompt, state.settings, onChunk);
          } else if (provider === 'groq') {
            await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, currentModel, state.settings.systemInstructions, fullPrompt, state.settings, onChunk);
          } else if (provider === 'openrouter') {
            await streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', apiKey, currentModel, state.settings.systemInstructions, fullPrompt, state.settings, onChunk);
          }

          completed = true;
          state.activeModel = currentModel;
          break outerLoop;
        } catch (err) {
          console.warn(`[Cascade Alert] Model ${currentModel} on Key ${k} returned status ${err.status || 'Error'}:`, err.message);
          // Bei 503 (Overloaded) oder 429 (Rate Limit) -> Nächster Schlüssel / Modell
          dom.statusText.textContent = `${currentModel} busy (${err.status || 'Error'}). Cascading...`;
        }
      }
    }

    dom.btnSubmitPrompt.disabled = false;

    if (completed) {
      dom.statusIndicator.className = 'status-dot';
      dom.statusText.textContent = `Stream finished. 100% Cloud-Executed ($0 Local Load).`;
    } else {
      dom.statusIndicator.className = 'status-dot error';
      dom.statusText.textContent = `All providers in cascade pool were busy. Try again in a few seconds.`;
      assistantMsg.update(`**Inference Notice:** All keys and fallback models for ${provider.toUpperCase()} encountered high demand (HTTP 503/429). Please retry shortly.`);
    }
  }

  // DIRECT CODEPEN EXPORT
  function exportToCodePen() {
    const bubbles = document.querySelectorAll('.message-row.assistant .message-bubble');
    if (bubbles.length === 0) {
      alert('No generated code available in dialogue to export.');
      return;
    }

    let allText = '';
    bubbles.forEach(b => allText += b.textContent + '\n');

    let html = '', css = '', js = '';
    const htmlMatch = allText.match(/```html\n([\s\S]*?)```/);
    const cssMatch = allText.match(/```css\n([\s\S]*?)```/);
    const jsMatch = allText.match(/```(?:js|javascript)\n([\s\S]*?)```/);

    if (htmlMatch) html = htmlMatch[1];
    if (cssMatch) css = cssMatch[1];
    if (jsMatch) js = jsMatch[1];

    if (!html && !css && !js) html = allText;

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({ title: 'AetherSpace CodePen Export', html, css, js });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab.active');
    const prov = activeTab ? activeTab.dataset.provider : 'gemini';
    const list = state.keys[prov] || [];

    dom.vaultKeysTableBody.innerHTML = '';
    if (list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${prov.toUpperCase()}.</td>`;
      dom.vaultKeysTableBody.appendChild(tr);
      return;
    }

    list.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default Key'}</td>
        <td><span style="color:var(--accent-emerald);">Active</span></td>
        <td><button class="link-btn-danger" data-del="${idx}">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        list.splice(idx, 1);
        saveKeys();
        renderVaultTable();
      });
      dom.vaultKeysTableBody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.userPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executePrompt();
      }
    });

    dom.btnSubmitPrompt.addEventListener('click', executePrompt);
    dom.btnCodepenExport.addEventListener('click', exportToCodePen);
    dom.btnSyncModels.addEventListener('click', syncLiveModels);

    dom.btnOpenVault.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.keyVaultModal.style.display = 'none');

    dom.vaultTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.vaultTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeProvider = tab.dataset.provider;
        renderVaultTable();
      });
    });

    dom.btnAddVaultKey.addEventListener('click', () => {
      const activeTab = document.querySelector('.vault-tab.active');
      const prov = activeTab ? activeTab.dataset.provider : 'gemini';
      const keyVal = dom.vaultKeyInput.value.trim();
      const labelVal = dom.vaultLabelInput.value.trim() || 'Free Tier Key';

      if (!keyVal) return;
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key: keyVal, label: labelVal });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      syncLiveModels();
    });

    dom.btnOpenSettings.addEventListener('click', () => dom.settingsModal.style.display = 'flex');
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsModal.style.display = 'none');

    dom.settingSysInstructions.addEventListener('input', () => {
      state.settings.systemInstructions = dom.settingSysInstructions.value;
    });

    dom.settingThinkingBudget.addEventListener('change', () => {
      state.settings.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10);
      dom.settingThinkingVal.textContent = dom.settingThinkingBudget.value;
    });

    dom.settingTemp.addEventListener('input', () => {
      state.settings.temperature = parseFloat(dom.settingTemp.value);
      dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2);
    });

    dom.btnAttachFiles.addEventListener('click', () => dom.fileUploader.click());
    dom.fileUploader.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.attachedFiles.push({ name: f.name, content: ev.target.result });
          dom.contextPreviewBar.style.display = 'flex';
          dom.contextFileCount.textContent = `${state.attachedFiles.length} File(s) in context`;
        };
        reader.readAsText(f);
      });
      dom.fileUploader.value = '';
    });

    dom.btnClearContext.addEventListener('click', () => {
      state.attachedFiles = [];
      dom.contextPreviewBar.style.display = 'none';
    });
  }

  function init() {
    loadKeys();
    initEvents();
    populateModelDropdown();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
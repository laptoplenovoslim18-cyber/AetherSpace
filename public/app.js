(function () {
  'use strict';

  // 1. STATE MANAGEMENT
  const state = {
    files: new Map(),
    activeFile: null,
    models: [],
    selectedModel: 'auto',
    chatHistory: [],
    runSettings: {
      systemInstructions: 'You are AetherSpace Principal AI Engineer. Synthesize clean, working code without stubs or placeholders.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [], hf: [] }
  };

  // 2. DOM REFERENCES
  const dom = {
    gatewayModelSelect: document.getElementById('gateway-model-select'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    statusDot: document.getElementById('status-dot'),

    fileTreeEmptyState: document.getElementById('file-tree-empty-state'),
    fileListItems: document.getElementById('file-list-items'),
    btnNewFile: document.getElementById('btn-new-file'),
    btnEmptyCreate: document.getElementById('btn-empty-create'),
    btnUploadFiles: document.getElementById('btn-upload-files'),
    btnClearWorkspace: document.getElementById('btn-clear-workspace'),
    btnSelectAllContext: document.getElementById('btn-select-all-context'),
    btnDeselectAllContext: document.getElementById('btn-deselect-all-context'),
    hiddenFileInput: document.getElementById('hidden-file-input'),

    editorTabs: document.getElementById('editor-tabs'),
    codeEditor: document.getElementById('code-editor'),
    lineGutter: document.getElementById('line-gutter'),
    cursorPos: document.getElementById('cursor-pos'),

    dialogueStream: document.getElementById('dialogue-stream'),
    promptInput: document.getElementById('prompt-input'),
    btnExecutePrompt: document.getElementById('btn-execute-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    btnResetSysInst: document.getElementById('btn-reset-sys-inst'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingOutputLength: document.getElementById('setting-output-length'),
    settingOutputLengthVal: document.getElementById('setting-output-length-val'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    keyCountBadge: document.getElementById('key-count-badge'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    detectedProviderName: document.getElementById('detected-provider-name'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn')
  };

  // 3. KEY STORAGE & SMART AUTO-DETECTION
  function detectProvider(key) {
    const k = key.trim();
    if (k.startsWith('AIzaSy')) return 'gemini';
    if (k.startsWith('gsk_')) return 'groq';
    if (k.startsWith('sk-or-')) return 'openrouter';
    if (k.startsWith('hf_')) return 'hf';
    return 'gemini';
  }

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [], hf: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Key storage load error', e);
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

  // 4. DYNAMIC SOTA MODEL FETCHING & LIFECYCLE SYNC
  async function fetchLiveModelCatalog() {
    dom.btnRefreshModels.classList.add('spinning');
    dom.gatewayStatusText.textContent = 'Syncing SOTA models...';

    const discovered = [];

    // Check Gemini
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const key = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .forEach(m => {
                const id = m.name.replace(/^models\//, '');
                discovered.push({ id, provider: 'gemini', name: m.displayName || id });
              });
          }
        }
      } catch (e) {
        console.warn('Gemini dynamic catalog error', e.message);
      }
    }

    // Check Groq
    if (state.keys.groq && state.keys.groq.length > 0) {
      const key = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach(m => {
              discovered.push({ id: m.id, provider: 'groq', name: `Groq ${m.id}` });
            });
          }
        }
      } catch (e) {
        console.warn('Groq dynamic catalog error', e.message);
      }
    }

    // OpenRouter Free Catalog (No auth required for catalog inspection)
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          data.data
            .filter(m => m.id.endsWith(':free') || m.pricing && m.pricing.prompt === '0')
            .slice(0, 5)
            .forEach(m => {
              discovered.push({ id: m.id, provider: 'openrouter', name: m.name || m.id });
            });
        }
      }
    } catch (e) {
      console.warn('OpenRouter catalog error', e.message);
    }

    // Fallback static defaults if no keys or network offline
    if (discovered.length === 0) {
      discovered.push(
        { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash' },
        { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B Versatile' },
        { id: 'deepseek-r1-distill-llama-70b', provider: 'groq', name: 'DeepSeek R1 Distill 70B' },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', name: 'Llama 3.3 70B (Free Router)' }
      );
    }

    state.models = discovered;
    populateModelSelect();
    dom.btnRefreshModels.classList.remove('spinning');
    dom.gatewayStatusText.textContent = 'AI Gateway Online';
  }

  function populateModelSelect() {
    const select = dom.gatewayModelSelect;
    const currentVal = select.value;
    select.innerHTML = '<option value="auto">⚡ Auto-Routing Gateway (Failover Mesh)</option>';

    const groups = {
      gemini: document.createElement('optgroup'),
      groq: document.createElement('optgroup'),
      openrouter: document.createElement('optgroup'),
      hf: document.createElement('optgroup')
    };

    groups.gemini.label = 'Google AI Studio';
    groups.groq.label = 'Groq Cloud';
    groups.openrouter.label = 'OpenRouter';
    groups.hf.label = 'Hugging Face';

    state.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = `${m.provider}::${m.id}`;
      opt.textContent = m.name;
      if (groups[m.provider]) groups[m.provider].appendChild(opt);
    });

    Object.values(groups).forEach(g => {
      if (g.children.length > 0) select.appendChild(g);
    });

    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
      select.value = currentVal;
    }
  }

  // 5. WORKSPACE EXPLORER & EDITOR
  function renderFiles() {
    if (state.files.size === 0) {
      dom.fileTreeEmptyState.style.display = 'flex';
      dom.fileListItems.style.display = 'none';
      dom.fileListItems.innerHTML = '';
      renderTabs();
      updateGutter();
      return;
    }

    dom.fileTreeEmptyState.style.display = 'none';
    dom.fileListItems.style.display = 'block';
    dom.fileListItems.innerHTML = '';

    state.files.forEach((fileObj, filename) => {
      const li = document.createElement('li');
      li.className = `file-item ${filename === state.activeFile ? 'active' : ''}`;

      const left = document.createElement('div');
      left.className = 'file-item-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'file-checkbox';
      checkbox.checked = Boolean(fileObj.inContext);
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        fileObj.inContext = checkbox.checked;
      });

      const span = document.createElement('span');
      span.textContent = filename;

      left.appendChild(checkbox);
      left.appendChild(span);

      const del = document.createElement('button');
      del.className = 'icon-tool-btn';
      del.innerHTML = '&times;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });

      li.appendChild(left);
      li.appendChild(del);
      li.addEventListener('click', () => selectFile(filename));
      dom.fileListItems.appendChild(li);
    });

    renderTabs();
  }

  function renderTabs() {
    dom.editorTabs.innerHTML = '';
    state.files.forEach((_, filename) => {
      const tab = document.createElement('div');
      tab.className = `editor-tab ${filename === state.activeFile ? 'active' : ''}`;

      const title = document.createElement('span');
      title.textContent = filename;

      const close = document.createElement('button');
      close.className = 'tab-close-btn';
      close.innerHTML = '&times;';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });

      tab.appendChild(title);
      tab.appendChild(close);
      tab.addEventListener('click', () => selectFile(filename));
      dom.editorTabs.appendChild(tab);
    });
  }

  function selectFile(filename) {
    if (!state.files.has(filename)) return;
    state.activeFile = filename;
    dom.codeEditor.value = state.files.get(filename).content;
    renderFiles();
    updateGutter();
    updateCursorPos();
  }

  function addOrUpdateFile(filename, content = '', inContext = true) {
    state.files.set(filename, { content, inContext });
    if (!state.activeFile) state.activeFile = filename;
    renderFiles();
    if (state.activeFile === filename) {
      dom.codeEditor.value = content;
      updateGutter();
    }
  }

  function removeFile(filename) {
    state.files.delete(filename);
    if (state.activeFile === filename) {
      const keys = Array.from(state.files.keys());
      state.activeFile = keys.length > 0 ? keys[keys.length - 1] : null;
      dom.codeEditor.value = state.activeFile ? state.files.get(state.activeFile).content : '';
    }
    renderFiles();
    updateGutter();
  }

  function updateGutter() {
    const lines = dom.codeEditor.value.split('\n').length;
    let str = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) str += i + '\n';
    dom.lineGutter.textContent = str;
  }

  function updateCursorPos() {
    const sel = dom.codeEditor.selectionStart;
    const lines = dom.codeEditor.value.substring(0, sel).split('\n');
    dom.cursorPos.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  }

  // 6. CHAT STREAMING & PROTOCOL ADAPTERS
  function appendChatBubble(author, initialText = '') {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${author.toLowerCase()}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = author;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';
    body.textContent = initialText;

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.dialogueStream.appendChild(bubble);
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;

    return {
      element: bubble,
      update(text) {
        body.innerHTML = text
          .replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, '<pre><code>[$1]\n$2</code></pre>')
          .replace(/\n/g, '<br>');
        dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
      }
    };
  }

  function buildPromptContext(userInput) {
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return contextStr ? `WORKSPACE FILES CONTEXT:\n${contextStr}\nUSER REQUEST:\n${userInput}` : userInput;
  }

  // GEMINI REST GENERATE WITH AUTO-RETRY ON 503
  async function callGeminiStream(apiKey, modelId, systemPrompt, fullPrompt, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (config.thinkingBudget > 0) {
      payload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (config.searchGrounding) {
      payload.tools = [{ googleSearch: {} }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google AI Studio HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No candidate content returned from model.');
    }

    const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
    onChunk(text);
    return text;
  }

  // OPENAI-COMPATIBLE CALL (GROQ / OPENROUTER)
  async function callOpenAICompatibleStream(endpoint, apiKey, modelId, systemPrompt, fullPrompt, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: fullPrompt });

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
      throw new Error(`Provider HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.choices[0].message.content;
    onChunk(text);
    return text;
  }

  // 7. AI GATEWAY ORCHESTRATOR & ADAPTIVE FAILOVER
  async function executeGatewayInference() {
    const input = dom.promptInput.value.trim();
    if (!input) return;

    appendChatBubble('User', input);
    dom.promptInput.value = '';

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';
    dom.gatewayStatusText.textContent = 'Gateway routing...';

    const aiBubble = appendChatBubble('AI', 'Connecting to cloud provider...');

    // Extract candidates
    const rawChoice = dom.gatewayModelSelect.value;
    const candidates = [];

    if (rawChoice !== 'auto') {
      const [prov, mId] = rawChoice.split('::');
      candidates.push({ provider: prov, modelId: mId });
    }

    // Add fallback mesh
    if (state.keys.gemini.length > 0) {
      candidates.push(
        { provider: 'gemini', modelId: 'gemini-2.5-flash' },
        { provider: 'gemini', modelId: 'gemini-2.0-flash' }
      );
    }
    if (state.keys.groq.length > 0) {
      candidates.push(
        { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
        { provider: 'groq', modelId: 'deepseek-r1-distill-llama-70b' }
      );
    }
    if (state.keys.openrouter.length > 0) {
      candidates.push({ provider: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct:free' });
    }

    // Deduplicate
    const queue = [];
    const seen = new Set();
    for (const c of candidates) {
      const key = `${c.provider}::${c.modelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(c);
      }
    }

    if (queue.length === 0) {
      aiBubble.update('No API keys configured. Please open Key Vault and enter a key for Google AI Studio, Groq, or OpenRouter.');
      dom.btnExecutePrompt.disabled = false;
      dom.statusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'Missing API Keys';
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    const fullPrompt = buildPromptContext(input);
    let successText = null;
    let finalError = null;

    for (let i = 0; i < queue.length; i++) {
      const { provider, modelId } = queue[i];
      const keyPool = state.keys[provider] || [];
      if (keyPool.length === 0) continue;

      for (let k = 0; k < keyPool.length; k++) {
        const apiKey = keyPool[k].key;
        try {
          dom.gatewayStatusText.textContent = `Active: ${modelId} (${provider})...`;
          aiBubble.update(`⚡ Routing via ${modelId}...`);

          if (provider === 'gemini') {
            successText = await callGeminiStream(
              apiKey,
              modelId,
              state.runSettings.systemInstructions,
              fullPrompt,
              state.runSettings,
              (chunk) => aiBubble.update(chunk)
            );
          } else if (provider === 'groq') {
            successText = await callOpenAICompatibleStream(
              'https://api.groq.com/openai/v1/chat/completions',
              apiKey,
              modelId,
              state.runSettings.systemInstructions,
              fullPrompt,
              state.runSettings,
              (chunk) => aiBubble.update(chunk)
            );
          } else if (provider === 'openrouter') {
            successText = await callOpenAICompatibleStream(
              'https://openrouter.ai/api/v1/chat/completions',
              apiKey,
              modelId,
              state.runSettings.systemInstructions,
              fullPrompt,
              state.runSettings,
              (chunk) => aiBubble.update(chunk)
            );
          }

          if (successText) break;
        } catch (err) {
          console.warn(`[Gateway Failover] ${modelId} (${provider}) failed:`, err.message);
          finalError = err.message;
          // Continue to next model/key in cascade
        }
      }
      if (successText) break;
    }

    dom.btnExecutePrompt.disabled = false;

    if (successText) {
      dom.statusDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = 'Ready (0 MB Local Load)';
      aiBubble.update(successText);
      applyMultiFileOutput(successText);
    } else {
      dom.statusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'Inference Error';
      aiBubble.update(`Inference failed on all configured providers: ${finalError || 'Unknown network error'}`);
    }
  }

  function applyMultiFileOutput(text) {
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let found = 0;

    while ((match = fileRegex.exec(text)) !== null) {
      addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
      found++;
    }

    if (found > 0) {
      renderFiles();
    } else if (state.activeFile) {
      addOrUpdateFile(state.activeFile, text, true);
    }
  }

  // 8. CODEPEN EXPORT
  function exportToCodePen() {
    if (state.files.size === 0) return alert('Workspace empty.');

    let html = '', css = '', js = '';
    state.files.forEach((f, name) => {
      if (name.endsWith('.html')) html += f.content + '\n';
      else if (name.endsWith('.css')) css += f.content + '\n';
      else if (name.endsWith('.js')) js += f.content + '\n';
    });

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
      title: 'AetherSpace Studio Export',
      html: html,
      css: css,
      js: js
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // 9. VAULT TABLE RENDERING
  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:14px;">No keys stored for ${provider.toUpperCase()}.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td>${provider.toUpperCase()}</td>
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default Key'}</td>
        <td>${k.created}</td>
        <td><button class="btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
        fetchLiveModelCatalog();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  // 10. EVENT ATTACHMENTS
  function initEvents() {
    dom.codeEditor.addEventListener('input', () => {
      if (state.activeFile) state.files.get(state.activeFile).content = dom.codeEditor.value;
      updateGutter();
      updateCursorPos();
    });

    dom.codeEditor.addEventListener('keyup', updateCursorPos);
    dom.codeEditor.addEventListener('click', updateCursorPos);

    dom.codeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = dom.codeEditor.selectionStart;
        const end = dom.codeEditor.selectionEnd;
        dom.codeEditor.value = dom.codeEditor.value.substring(0, start) + '  ' + dom.codeEditor.value.substring(end);
        dom.codeEditor.selectionStart = dom.codeEditor.selectionEnd = start + 2;
        updateGutter();
      }
    });

    dom.btnNewFile.addEventListener('click', () => {
      const name = prompt('File name (e.g. index.html, styles.css, app.js):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
      }
    });

    dom.btnEmptyCreate.addEventListener('click', () => dom.btnNewFile.click());

    dom.btnClearWorkspace.addEventListener('click', () => {
      if (state.files.size > 0 && confirm('Clear workspace?')) {
        state.files.clear();
        state.activeFile = null;
        dom.codeEditor.value = '';
        renderFiles();
      }
    });

    dom.btnSelectAllContext.addEventListener('click', () => {
      state.files.forEach(f => f.inContext = true);
      renderFiles();
    });

    dom.btnDeselectAllContext.addEventListener('click', () => {
      state.files.forEach(f => f.inContext = false);
      renderFiles();
    });

    dom.btnUploadFiles.addEventListener('click', () => dom.hiddenFileInput.click());
    dom.hiddenFileInput.addEventListener('change', (e) => {
      Array.from(e.target.files || []).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => addOrUpdateFile(file.name, ev.target.result, true);
        reader.readAsText(file);
      });
      dom.hiddenFileInput.value = '';
    });

    dom.btnExecutePrompt.addEventListener('click', executeGatewayInference);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeGatewayInference();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      dom.dialogueStream.innerHTML = '';
    });

    dom.btnRefreshModels.addEventListener('click', fetchLiveModelCatalog);
    dom.btnCodepenExport.addEventListener('click', exportToCodePen);

    dom.btnExportBundle.addEventListener('click', () => {
      if (state.files.size === 0) return alert('Workspace empty.');
      let bundle = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n';
      state.files.forEach((f, name) => {
        if (name.endsWith('.css')) bundle += `<style>/* ${name} */\n${f.content}\n</style>\n`;
      });
      bundle += '</head>\n<body>\n';
      state.files.forEach((f, name) => {
        if (name.endsWith('.html')) bundle += `<!-- ${name} -->\n${f.content}\n`;
      });
      state.files.forEach((f, name) => {
        if (name.endsWith('.js')) bundle += `<script>/* ${name} */\n${f.content}\n<\/script>\n`;
      });
      bundle += '</body>\n</html>';

      const blob = new Blob([bundle], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aetherspace-bundle.html';
      a.click();
    });

    dom.btnExportZip.addEventListener('click', () => {
      if (state.files.size === 0) return alert('Workspace empty.');
      let manifest = 'PROJECT MANIFEST\n================\n';
      state.files.forEach((f, name) => manifest += `\n[FILE: ${name}]\n${f.content}\n`);
      const blob = new Blob([manifest], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aetherspace-manifest.txt';
      a.click();
    });

    dom.btnSaveServer.addEventListener('click', async () => {
      if (!state.activeFile) return alert('No file active.');
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: state.activeFile, content: dom.codeEditor.value })
        });
        if (!res.ok) throw new Error('Save failed');
        alert(`Saved ${state.activeFile} to disk. Git sync scheduled.`);
      } catch (err) {
        alert('Preserved in browser memory.');
      }
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));
    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = 'You are AetherSpace Principal AI Engineer. Synthesize clean, working code without stubs or placeholders.';
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

    dom.vaultKeyInput.addEventListener('input', () => {
      const prov = detectProvider(dom.vaultKeyInput.value);
      const names = { gemini: 'Google AI Studio', groq: 'Groq Cloud', openrouter: 'OpenRouter', hf: 'Hugging Face' };
      dom.detectedProviderName.textContent = names[prov] || prov;
    });

    dom.btnAddKey.addEventListener('click', () => {
      const rawKey = dom.vaultKeyInput.value.trim();
      if (!rawKey) return alert('Enter API key.');

      const prov = detectProvider(rawKey);
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key: rawKey, label, created: new Date().toLocaleDateString() });
      saveKeys();

      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      fetchLiveModelCatalog();
    });
  }

  // 11. BOOTSTRAP
  function init() {
    loadKeys();
    initEvents();
    renderFiles();
    dom.settingSystemInstructions.value = state.runSettings.systemInstructions;
    fetchLiveModelCatalog();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
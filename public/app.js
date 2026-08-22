(function () {
  'use strict';

  // SOTA Top-3 Default Models (Live fallback list)
  const DEFAULT_MODELS = {
    gemini: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (SOTA Agentic)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Fast)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Stable LTS)' }
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' }
    ],
    openrouter: [
      { id: 'openrouter/free', name: 'OpenRouter Free Mesh' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)' }
    ]
  };

  const state = {
    files: new Map(),
    activeFile: null,
    messages: [], // Multi-turn chat history [{role: 'user'|'model'|'assistant', content: string}]
    models: JSON.parse(JSON.stringify(DEFAULT_MODELS)),
    runSettings: {
      model: 'gemini-3.7-flash',
      systemInstructions: '',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
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
    activeModelDisplay: document.getElementById('active-model-display'),
    activeModelNav: document.getElementById('active-model-nav'),
    promptInput: document.getElementById('prompt-input'),
    btnExecutePrompt: document.getElementById('btn-execute-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    activeContextCount: document.getElementById('active-context-count'),
    statusDot: document.getElementById('status-dot'),
    keyCountBadge: document.getElementById('key-count-badge'),
    modelCountLabel: document.getElementById('model-count-label'),
    btnRefreshInventory: document.getElementById('btn-refresh-inventory'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingModel: document.getElementById('setting-model'),
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
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn')
  };

  // 1. KEY STORAGE & INVENTORY
  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault key parse error', e);
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

  // 2. DYNAMIC MODEL FETCHING & LIFECYCLE MANAGEMENT (TOP 3 PER PROVIDER)
  async function fetchDynamicInventory() {
    dom.modelCountLabel.textContent = 'Syncing...';
    
    // A. Gemini Dynamic Fetch
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const key = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const valid = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name.replace('models/', '') }))
              .filter(m => m.id.includes('gemini'));
            
            // Prioritize SOTA 3.7, 3.5, 2.5
            const priority = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
            const top = [];
            priority.forEach(p => {
              const f = valid.find(v => v.id === p);
              if (f && top.length < 3) top.push(f);
            });
            valid.forEach(v => {
              if (!top.find(t => t.id === v.id) && top.length < 3) top.push(v);
            });
            if (top.length > 0) state.models.gemini = top;
          }
        }
      } catch (e) { console.warn('Gemini inventory fetch note:', e.message); }
    }

    // B. Groq Dynamic Fetch
    if (state.keys.groq && state.keys.groq.length > 0) {
      const key = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            const valid = data.data
              .filter(m => m.active !== false && !m.id.includes('whisper'))
              .map(m => ({ id: m.id, name: m.id }));
            if (valid.length > 0) state.models.groq = valid.slice(0, 3);
          }
        }
      } catch (e) { console.warn('Groq inventory fetch note:', e.message); }
    }

    renderModelDropdown();
    dom.modelCountLabel.textContent = 'Models Synced';
  }

  function renderModelDropdown() {
    const prev = state.runSettings.model;
    dom.settingModel.innerHTML = '';

    const createGroup = (label, list) => {
      const grp = document.createElement('optgroup');
      grp.label = label;
      list.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        grp.appendChild(opt);
      });
      dom.settingModel.appendChild(grp);
    };

    createGroup('Google AI Studio (Top 3 Live)', state.models.gemini);
    createGroup('Groq Cloud (Top 3 Ultra-Speed)', state.models.groq);
    createGroup('OpenRouter Free Mesh (Top 3)', state.models.openrouter);

    // Restore or select first
    const exists = Array.from(dom.settingModel.options).some(o => o.value === prev);
    if (exists) {
      dom.settingModel.value = prev;
    } else if (dom.settingModel.options.length > 0) {
      dom.settingModel.selectedIndex = 0;
      state.runSettings.model = dom.settingModel.value;
    }
    updateModelHeader();
  }

  function updateModelHeader() {
    const text = dom.settingModel.options[dom.settingModel.selectedIndex]?.text || state.runSettings.model;
    dom.activeModelDisplay.textContent = text.split(' (')[0];
    dom.activeModelNav.textContent = text.split(' (')[0];
  }

  // 3. WORKSPACE FILES
  function renderFiles() {
    if (state.files.size === 0) {
      dom.fileTreeEmptyState.style.display = 'flex';
      dom.fileListItems.style.display = 'none';
      dom.fileListItems.innerHTML = '';
      renderTabs();
      updateGutter();
      updateContextCounter();
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
        updateContextCounter();
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
    updateContextCounter();
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

  function updateContextCounter() {
    let count = 0, chars = 0;
    state.files.forEach(f => {
      if (f.inContext) { count++; chars += f.content.length; }
    });
    dom.activeContextCount.textContent = `${count} files attached (${chars.toLocaleString()} chars)`;
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

  // 4. CHAT BUBBLES & REAL-TIME STREAMING
  function createChatBubble(author, role = 'ai') {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = author;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body streaming-cursor';

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.dialogueStream.appendChild(bubble);
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
    return body;
  }

  function renderBubbleContent(container, rawText) {
    container.classList.remove('streaming-cursor');
    // Sanitize and replace code blocks
    let formatted = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Parse `<file path="...">` blocks
    formatted = formatted.replace(/&lt;file path="([^"]+)"&gt;([\s\S]*?)&lt;\/file&gt;/g, '<pre><code>[$1]\n$2</code></pre>');
    formatted = formatted.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    formatted = formatted.replace(/\n/g, '<br>');
    container.innerHTML = formatted;
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
  }

  function buildContextPayload() {
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return contextStr;
  }

  // 5. RESILIENT LIVE STREAMING ENGINES (WITH RETRY ON 503 & 429)
  async function streamGeminiWithRetry(apiKey, model, systemPrompt, contents, config, onChunk, retries = 2) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
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

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${response.status}`;
          if ((response.status === 503 || response.status === 429) && attempt < retries) {
            await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
            continue; // Retry
          }
          throw new Error(`Google AI Studio (${response.status}): ${errMsg}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep remainder

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr && jsonStr !== '[DONE]') {
                try {
                  const chunk = JSON.parse(jsonStr);
                  const candidate = chunk.candidates?.[0];
                  if (candidate?.content?.parts) {
                    const text = candidate.content.parts.map(p => p.text || '').join('');
                    if (text) {
                      fullText += text;
                      onChunk(fullText);
                    }
                  }
                } catch (e) {}
              }
            }
          }
        }
        return fullText;
      } catch (err) {
        if (attempt === retries) throw err;
      }
    }
  }

  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, messages, config, onChunk) {
    const reqMessages = [];
    if (systemPrompt && systemPrompt.trim()) reqMessages.push({ role: 'system', content: systemPrompt });
    messages.forEach(m => reqMessages.push(m));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: reqMessages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Provider (${response.status}): ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  // 6. SYNTHESIS & LIVE CHAT ROUTER
  async function executePrompt() {
    const userPrompt = dom.promptInput.value.trim();
    if (!userPrompt) return;

    dom.promptInput.value = '';

    // Append User Message to Chat
    const userBubble = createChatBubble('You', 'user');
    renderBubbleContent(userBubble, userPrompt);

    // Sync Run Settings
    state.runSettings.model = dom.settingModel.value;
    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    state.runSettings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);

    let provider = 'gemini';
    const model = state.runSettings.model;
    if (model.startsWith('llama') || model.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (model.includes('openrouter') || model.includes(':free')) provider = 'openrouter';

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      const errBubble = createChatBubble('AI Gateway', 'error');
      renderBubbleContent(errBubble, `No API key configured for provider [${provider.toUpperCase()}]. Please open Key Vault to store a valid key.`);
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    // Build context-injected prompt
    const contextPrefix = buildContextPayload();
    const finalPrompt = contextPrefix ? `CURRENT WORKSPACE FILES:\n${contextPrefix}\nUSER INSTRUCTION:\n${userPrompt}` : userPrompt;

    // Prepare multi-turn messages
    state.messages.push({ role: 'user', content: finalPrompt });

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';

    const aiBubble = createChatBubble(model, 'ai');
    let fullOutput = '';
    let success = false;

    // Prepare Gemini payload structure
    const geminiContents = state.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Prepared OpenAI-compatible messages structure
    const openAIMessages = state.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    for (let i = 0; i < keys.length; i++) {
      try {
        if (provider === 'gemini') {
          fullOutput = await streamGeminiWithRetry(
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            geminiContents,
            state.runSettings,
            (chunk) => {
              aiBubble.textContent = chunk;
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            }
          );
        } else if (provider === 'groq') {
          fullOutput = await streamOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            openAIMessages,
            state.runSettings,
            (chunk) => {
              aiBubble.textContent = chunk;
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            }
          );
        } else if (provider === 'openrouter') {
          fullOutput = await streamOpenAICompatible(
            'https://openrouter.ai/api/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            openAIMessages,
            state.runSettings,
            (chunk) => {
              aiBubble.textContent = chunk;
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            }
          );
        }

        success = true;
        break;
      } catch (err) {
        console.warn(`[Failover] Key index ${i} failed:`, err.message);
        if (!state.runSettings.autoCascade || i === keys.length - 1) {
          renderBubbleContent(aiBubble, `Inference Error: ${err.message}`);
          aiBubble.parentElement.classList.add('error');
          break;
        }
      }
    }

    dom.btnExecutePrompt.disabled = false;

    if (success && fullOutput) {
      dom.statusDot.className = 'status-indicator ready';
      renderBubbleContent(aiBubble, fullOutput);
      state.messages.push({ role: 'assistant', content: fullOutput });
      applyGeneratedFiles(fullOutput);
    } else {
      dom.statusDot.className = 'status-indicator error';
    }
  }

  function applyGeneratedFiles(text) {
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let found = 0;

    while ((match = fileRegex.exec(text)) !== null) {
      addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
      found++;
    }

    if (found > 0) renderFiles();
  }

  // 7. CODEPEN ONE-CLICK EXPORT
  function exportToCodePen() {
    if (state.files.size === 0) {
      alert('Workspace is empty. Create HTML/CSS/JS files first.');
      return;
    }

    let htmlCode = '', cssCode = '', jsCode = '';
    state.files.forEach((f, name) => {
      if (name.endsWith('.html')) htmlCode += f.content + '\n';
      else if (name.endsWith('.css')) cssCode += f.content + '\n';
      else if (name.endsWith('.js')) jsCode += f.content + '\n';
    });

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
      title: 'AetherSpace Export',
      html: htmlCode,
      css: cssCode,
      js: jsCode
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // 8. KEY VAULT MODAL
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
        <td>${k.label || 'Key'}</td>
        <td><span class="badge">Free Tier</span></td>
        <td>${k.created}</td>
        <td><button class="btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
        fetchDynamicInventory();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.codeEditor.addEventListener('input', () => {
      if (state.activeFile) state.files.get(state.activeFile).content = dom.codeEditor.value;
      updateGutter();
      updateCursorPos();
      updateContextCounter();
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
      const name = prompt('Enter file path (e.g. index.html, styles.css):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
      }
    });

    dom.btnEmptyCreate.addEventListener('click', () => dom.btnNewFile.click());

    dom.btnClearWorkspace.addEventListener('click', () => {
      if (state.files.size > 0 && confirm('Clear all files in workspace?')) {
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

    dom.btnExecutePrompt.addEventListener('click', executePrompt);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executePrompt();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.messages = [];
      dom.dialogueStream.innerHTML = `
        <div class="dialogue-welcome">
          <p><strong>AetherSpace Live AI Assistant</strong></p>
          <p>Chat history cleared. Send prompt or code instruction below.</p>
        </div>`;
    });

    dom.btnRefreshInventory.addEventListener('click', fetchDynamicInventory);
    dom.btnCodepenExport.addEventListener('click', exportToCodePen);

    dom.btnExportBundle.addEventListener('click', () => {
      if (state.files.size === 0) return alert('Workspace is empty.');
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
      if (state.files.size === 0) return alert('Workspace is empty.');
      let manifest = 'PROJECT MANIFEST\n================\n';
      state.files.forEach((f, name) => manifest += `\n[FILE: ${name}]\n${f.content}\n`);
      const blob = new Blob([manifest], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aetherspace-project.txt';
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
        if (!res.ok) throw new Error('Save error');
        alert(`Saved ${state.activeFile} to disk. Git sync scheduled.`);
      } catch (err) {
        alert('Preserved in browser memory.');
      }
    });

    dom.settingModel.addEventListener('change', () => {
      state.runSettings.model = dom.settingModel.value;
      updateModelHeader();
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));
    dom.btnResetSysInst.addEventListener('click', () => { dom.settingSystemInstructions.value = ''; });

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
      const active = document.querySelector('.vault-tab-btn.active');
      const prov = active ? active.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return alert('Please enter a key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      fetchDynamicInventory();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    renderFiles();
    renderModelDropdown();
    fetchDynamicInventory();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
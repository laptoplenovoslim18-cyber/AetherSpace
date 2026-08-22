(function () {
  'use strict';

  // 1. STATE & ROUTER CONFIG
  const state = {
    files: new Map(),
    activeFile: null,
    canvasMode: 'split', // 'split', 'chat', 'editor'
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] },
    fallbackLadder: [
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'gemini', model: 'gemini-3.7-flash' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'groq', model: 'deepseek-r1-distill-llama-70b' },
      { provider: 'openrouter', model: 'openrouter/free' }
    ]
  };

  // 2. DOM REFS
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

    mergedCanvas: document.getElementById('merged-canvas'),
    btnViewSplit: document.getElementById('btn-view-split'),
    btnViewChat: document.getElementById('btn-view-chat'),
    btnViewEditor: document.getElementById('btn-view-editor'),

    editorTabs: document.getElementById('editor-tabs'),
    codeEditor: document.getElementById('code-editor'),
    lineGutter: document.getElementById('line-gutter'),
    cursorPos: document.getElementById('cursor-pos'),

    dialogueStream: document.getElementById('dialogue-stream'),
    activeModelDisplay: document.getElementById('active-model-display'),
    activeModelNav: document.getElementById('active-model-nav'),
    promptInput: document.getElementById('prompt-input'),
    btnExecutePrompt: document.getElementById('btn-execute-prompt'),
    activeContextCount: document.getElementById('active-context-count'),
    statusDot: document.getElementById('status-dot'),
    keyCountBadge: document.getElementById('key-count-badge'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingModel: document.getElementById('setting-model'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    optgroupGemini: document.getElementById('optgroup-gemini'),
    optgroupGroq: document.getElementById('optgroup-groq'),
    optgroupOpenrouter: document.getElementById('optgroup-openrouter'),

    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    btnResetSysInst: document.getElementById('btn-reset-sys-inst'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingThinkingVal: document.getElementById('setting-thinking-val'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
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

  // 3. PERSISTENCE & INVENTORY
  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault load notice', e);
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

  // 4. DYNAMIC MODEL FETCHING & TOP-3 PRUNING
  async function fetchLiveModels() {
    // 1. Google AI Studio live fetching
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const geminiKey = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        if (res.ok) {
          const data = await res.json();
          const valid = (data.models || [])
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(m => !m.includes('vision') && !m.includes('embedding'));
          
          if (valid.length > 0) {
            dom.optgroupGemini.innerHTML = '';
            valid.slice(0, 4).forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = `${m} (Live)`;
              if (m.includes('2.5-flash') || m.includes('flash')) opt.selected = true;
              dom.optgroupGemini.appendChild(opt);
            });
          }
        }
      } catch (e) {
        console.warn('Live Gemini model fetch notice', e);
      }
    }

    // 2. Groq Cloud live fetching
    if (state.keys.groq && state.keys.groq.length > 0) {
      const groqKey = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          const topGroq = (data.data || [])
            .map(m => m.id)
            .filter(id => id.includes('llama-3.3') || id.includes('deepseek') || id.includes('llama-3.1'))
            .slice(0, 3);
          
          if (topGroq.length > 0) {
            dom.optgroupGroq.innerHTML = '';
            topGroq.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = `${m} (Live)`;
              dom.optgroupGroq.appendChild(opt);
            });
          }
        }
      } catch (e) {
        console.warn('Live Groq model fetch notice', e);
      }
    }

    updateActiveModelLabels();
  }

  function updateActiveModelLabels() {
    const selText = dom.settingModel.options[dom.settingModel.selectedIndex]?.text.split(' (')[0] || dom.settingModel.value;
    dom.activeModelDisplay.textContent = selText;
    dom.activeModelNav.textContent = selText;
  }

  // 5. WORKSPACE & FILE MANAGEMENT
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
    dom.activeContextCount.textContent = `${count} files context (${chars.toLocaleString()} chars)`;
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

  function appendChatBubble(author, initialText = '') {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${author.toLowerCase()}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = author;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';
    body.innerHTML = initialText;

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.dialogueStream.appendChild(bubble);
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
    return body;
  }

  function renderFormattedText(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;file path="([^"]+)"&gt;([\s\S]*?)&lt;\/file&gt;/g, '<pre><code>[$1]\n$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function buildPromptPayload(instruction) {
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return contextStr ? `CURRENT PROJECT FILES:\n${contextStr}\nTASK:\n${instruction}` : instruction;
  }

  // 6. CODEPEN ONE-CLICK EXPORT
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
      title: 'AetherSpace Gateway Export',
      html: htmlCode,
      css: cssCode,
      js: jsCode
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // 7. MULTI-PROVIDER AI GATEWAY & SSE STREAMING
  async function streamGemini(apiKey, model, systemPrompt, userPrompt, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
      const err = await res.text();
      const status = res.status;
      throw { status, message: `Google AI Studio HTTP ${status}: ${err}` };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const textChunk = decoder.decode(value, { stream: true });
      const lines = textChunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              const partText = data.candidates[0].content.parts.map(p => p.text || '').join('');
              accumulated += partText;
              onChunk(accumulated);
            }
          } catch (e) {}
        }
      }
    }
    return accumulated;
  }

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
        max_tokens: Math.min(config.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw { status: res.status, message: `Provider HTTP ${res.status}: ${err}` };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const textChunk = decoder.decode(value, { stream: true });
      const lines = textChunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              accumulated += data.choices[0].delta.content;
              onChunk(accumulated);
            }
          } catch (e) {}
        }
      }
    }
    return accumulated;
  }

  async function executeGateway() {
    const prompt = dom.promptInput.value.trim();
    if (!prompt) return;

    appendChatBubble('User', renderFormattedText(prompt));
    dom.promptInput.value = '';

    state.runSettings.model = dom.settingModel.value;
    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';

    const aiBubbleBody = appendChatBubble('AI', '<em>Connecting to AI Gateway...</em>');
    const fullPrompt = buildPromptPayload(prompt);

    // Build Execution Plan (Primary model + Fallback Ladder)
    let plan = [];
    let initialProvider = 'gemini';
    const activeModel = state.runSettings.model;

    if (activeModel.startsWith('llama') || activeModel.startsWith('deepseek-r1-distill')) initialProvider = 'groq';
    else if (activeModel.includes('openrouter') || activeModel.includes(':free')) initialProvider = 'openrouter';

    plan.push({ provider: initialProvider, model: activeModel });

    if (state.runSettings.autoCascade) {
      state.fallbackLadder.forEach(f => {
        if (f.model !== activeModel) plan.push(f);
      });
    }

    let success = false;
    let finalOutput = '';

    for (let step = 0; step < plan.length; step++) {
      const { provider, model } = plan[step];
      const keysList = state.keys[provider] || [];

      if (keysList.length === 0) continue;

      for (let k = 0; k < keysList.length; k++) {
        const apiKey = keysList[k].key;
        try {
          aiBubbleBody.innerHTML = `<em>Streaming from ${model} via ${provider.toUpperCase()} (Key ${k + 1})...</em>`;
          
          if (provider === 'gemini') {
            finalOutput = await streamGemini(apiKey, model, state.runSettings.systemInstructions, fullPrompt, state.runSettings, (chunk) => {
              aiBubbleBody.innerHTML = renderFormattedText(chunk);
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            });
          } else if (provider === 'groq') {
            finalOutput = await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, fullPrompt, state.runSettings, (chunk) => {
              aiBubbleBody.innerHTML = renderFormattedText(chunk);
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            });
          } else if (provider === 'openrouter') {
            finalOutput = await streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, fullPrompt, state.runSettings, (chunk) => {
              aiBubbleBody.innerHTML = renderFormattedText(chunk);
              dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
            });
          }

          success = true;
          break;
        } catch (err) {
          console.warn(`[Gateway Failover] ${provider} (${model}) failed with code ${err.status}:`, err.message);
          aiBubbleBody.innerHTML = `<em>Auto-Failover: ${model} busy (${err.status || '503'}). Rerouting to backup SOTA model...</em>`;
        }
      }

      if (success) break;
    }

    dom.btnExecutePrompt.disabled = false;

    if (success && finalOutput) {
      dom.statusDot.className = 'status-indicator ready';
      aiBubbleBody.innerHTML = renderFormattedText(finalOutput);
      applyOutput(finalOutput);
    } else {
      dom.statusDot.className = 'status-indicator error';
      aiBubbleBody.innerHTML = '<span style="color:var(--accent-rose);">Execution halted: All keys and fallback models exhausted or missing API keys. Please verify your keys in Key Vault.</span>';
    }
  }

  function applyOutput(text) {
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

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:14px;">No keys stored for ${provider.toUpperCase()}. Add your free API key above.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default Key'}</td>
        <td><span class="badge">Active</span></td>
        <td>${k.created}</td>
        <td><button class="btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  // 8. EVENTS
  function initEvents() {
    // Canvas Mode Switcher
    dom.btnViewSplit.addEventListener('click', () => {
      dom.mergedCanvas.className = 'merged-canvas';
      dom.btnViewSplit.classList.add('active');
      dom.btnViewChat.classList.remove('active');
      dom.btnViewEditor.classList.remove('active');
    });

    dom.btnViewChat.addEventListener('click', () => {
      dom.mergedCanvas.className = 'merged-canvas view-chat';
      dom.btnViewChat.classList.add('active');
      dom.btnViewSplit.classList.remove('active');
      dom.btnViewEditor.classList.remove('active');
    });

    dom.btnViewEditor.addEventListener('click', () => {
      dom.mergedCanvas.className = 'merged-canvas view-editor';
      dom.btnViewEditor.classList.add('active');
      dom.btnViewSplit.classList.remove('active');
      dom.btnViewChat.classList.remove('active');
    });

    // Editor & Tab sync
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

    // File Management
    dom.btnNewFile.addEventListener('click', () => {
      const name = prompt('Enter filename (e.g. index.html, styles.css, app.js):');
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

    // Gateway Execution
    dom.btnExecutePrompt.addEventListener('click', executeGateway);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeGateway();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      dom.dialogueStream.innerHTML = '<div class="dialogue-welcome"><p>Chat cleared. Ready for next prompt.</p></div>';
    });

    // Exports
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
      if (!state.activeFile) return alert('No active file.');
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: state.activeFile, content: dom.codeEditor.value })
        });
        if (!res.ok) throw new Error('Save error');
        alert(`Saved ${state.activeFile} to disk. Git sync scheduled.`);
      } catch (err) {
        alert('File preserved in browser memory.');
      }
    });

    // Settings
    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingModel.addEventListener('change', updateActiveModelLabels);
    dom.btnRefreshModels.addEventListener('click', fetchLiveModels);

    dom.settingThinkingLevel.addEventListener('input', () => {
      dom.settingThinkingVal.textContent = dom.settingThinkingLevel.value;
    });

    dom.settingTemp.addEventListener('input', () => {
      dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2);
    });

    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = '';
    });

    // Key Vault
    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'none';
      fetchLiveModels();
    });

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

      if (!key) return alert('Please paste an API key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      fetchLiveModels();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    renderFiles();
    fetchLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
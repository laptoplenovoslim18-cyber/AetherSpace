(function () {
  'use strict';

  const state = {
    files: new Map(),
    activeFile: null,
    chatHistory: [], // Dynamic conversational memory
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
    promptInput: document.getElementById('prompt-input'),
    btnExecutePrompt: document.getElementById('btn-execute-prompt'),
    activeContextCount: document.getElementById('active-context-count'),
    statusDot: document.getElementById('status-dot'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    globalStatusDot: document.getElementById('global-status-dot'),
    globalStatusLabel: document.getElementById('global-status-label'),
    headerModelLabel: document.getElementById('header-model-label'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnFetchLiveModels: document.getElementById('btn-fetch-live-models'),

    settingModel: document.getElementById('setting-model'),
    optgroupGemini: document.getElementById('optgroup-gemini'),
    optgroupGroq: document.getElementById('optgroup-groq'),
    optgroupOpenrouter: document.getElementById('optgroup-openrouter'),

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

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault parse error', e);
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
    dom.activeContextCount.textContent = `${count} files in context (${chars.toLocaleString()} chars)`;
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

  function createChatBubble(author) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${author.toLowerCase()}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = author;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.dialogueStream.appendChild(bubble);
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
    return body;
  }

  function renderFormattedText(container, rawText) {
    container.innerHTML = rawText
      .replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, '<pre><code>[$1]\n$2</code></pre>')
      .replace(/\n/g, '<br>');
  }

  function buildPromptPayload(instruction) {
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return contextStr ? `[WORKSPACE CONTEXT]:\n${contextStr}\n[USER INSTRUCTION]:\n${instruction}` : instruction;
  }

  // DYNAMIC LIVE MODEL FETCHING
  async function fetchLiveModels() {
    dom.btnFetchLiveModels.textContent = 'Syncing...';
    let fetchedAny = false;

    // 1. Google AI Studio live models
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length > 0) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            dom.optgroupGemini.innerHTML = '';
            data.models
              .filter(m => m.name && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .forEach(m => {
                const id = m.name.replace('models/', '');
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = m.displayName || id;
                dom.optgroupGemini.appendChild(opt);
              });
            fetchedAny = true;
          }
        }
      } catch (e) {
        console.warn('Gemini model sync note:', e.message);
      }
    }

    // 2. Groq live models
    const groqKeys = state.keys.groq || [];
    if (groqKeys.length > 0) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKeys[0].key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            dom.optgroupGroq.innerHTML = '';
            data.data.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m.id;
              opt.textContent = m.id;
              dom.optgroupGroq.appendChild(opt);
            });
            fetchedAny = true;
          }
        }
      } catch (e) {
        console.warn('Groq model sync note:', e.message);
      }
    }

    // 3. OpenRouter free models
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          const freeModels = data.data.filter(m => m.id && (m.id.includes(':free') || m.pricing?.prompt === '0'));
          if (freeModels.length > 0) {
            dom.optgroupOpenrouter.innerHTML = '';
            freeModels.slice(0, 15).forEach(m => {
              const opt = document.createElement('option');
              opt.value = m.id;
              opt.textContent = m.name || m.id;
              dom.optgroupOpenrouter.appendChild(opt);
            });
            fetchedAny = true;
          }
        }
      }
    } catch (e) {
      console.warn('OpenRouter sync note:', e.message);
    }

    dom.btnFetchLiveModels.textContent = fetchedAny ? 'Synced!' : 'Sync Failed';
    setTimeout(() => { dom.btnFetchLiveModels.textContent = '⚡ Sync Live Models'; }, 2000);
  }

  // OFFICIAL CODEPEN EXPORT
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

  // SSE STREAMING CALL: GOOGLE GEMINI
  async function streamGemini(apiKey, model, systemPrompt, contents, config, onChunk) {
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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google AI Studio HTTP ${res.status}: ${err}`);
    }

    const reader = res.body.getReader();
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
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          try {
            const json = JSON.parse(trimmed.substring(5).trim());
            if (json.candidates && json.candidates[0]?.content?.parts) {
              const piece = json.candidates[0].content.parts.map(p => p.text || '').join('');
              fullText += piece;
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }

    return fullText;
  }

  // SSE STREAMING CALL: OPENAI COMPATIBLE (GROQ / OPENROUTER)
  async function streamOpenAICompatible(endpoint, apiKey, model, messages, config, onChunk) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192)
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Provider HTTP ${res.status}: ${err}`);
    }

    const reader = res.body.getReader();
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
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const chunkStr = trimmed.substring(5).trim();
          if (chunkStr === '[DONE]') continue;
          try {
            const json = JSON.parse(chunkStr);
            const delta = json.choices[0]?.delta?.content || '';
            fullText += delta;
            onChunk(fullText);
          } catch (e) {}
        }
      }
    }

    return fullText;
  }

  // RESILIENT AI GATEWAY ROUTER (WITH RETRY & MULTI-MODEL FALLBACK)
  async function routeAndSynthesize(userPrompt) {
    const userBubble = createChatBubble('User');
    userBubble.textContent = userPrompt;

    state.runSettings.model = dom.settingModel.value;
    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    state.runSettings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);

    // Determine target provider
    let selectedModel = state.runSettings.model;
    let targetProvider = 'gemini';
    if (selectedModel.startsWith('llama') || selectedModel.startsWith('deepseek-r1-distill')) targetProvider = 'groq';
    else if (selectedModel.includes('openrouter') || selectedModel.includes(':free')) targetProvider = 'openrouter';

    // Auto-detect provider if user has keys in another provider
    let keys = state.keys[targetProvider] || [];
    if (keys.length === 0) {
      // Check if any provider has keys
      for (const p of ['gemini', 'groq', 'openrouter']) {
        if (state.keys[p] && state.keys[p].length > 0) {
          targetProvider = p;
          keys = state.keys[p];
          if (p === 'gemini') selectedModel = 'gemini-2.5-flash';
          else if (p === 'groq') selectedModel = 'llama-3.3-70b-versatile';
          else if (p === 'openrouter') selectedModel = 'openrouter/free';
          dom.settingModel.value = selectedModel;
          break;
        }
      }
    }

    if (keys.length === 0) {
      const errBubble = createChatBubble('AI');
      errBubble.innerHTML = '<strong>No API Key found.</strong> Please open <button class="btn-xs primary-outline" id="btn-prompt-open-vault">Key Vault</button> to add your free API Key.';
      document.getElementById('btn-prompt-open-vault')?.addEventListener('click', () => {
        dom.keyVaultModal.style.display = 'flex';
        renderVaultTable();
      });
      return;
    }

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';
    dom.globalStatusDot.className = 'pill-indicator online';
    dom.globalStatusLabel.textContent = `Generating with ${selectedModel}...`;

    const aiBubble = createChatBubble('AI');
    aiBubble.innerHTML = '<em>Thinking & streaming response...</em>';

    // Prepare message structures
    const fullPrompt = buildPromptPayload(userPrompt);
    state.chatHistory.push({ role: 'user', content: fullPrompt });

    // Fallback model list if 503/429 hits
    const fallbackGeminiModels = [selectedModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let success = false;
    let fullOutput = '';

    // Model & Key Execution Loop
    for (let keyIdx = 0; keyIdx < keys.length && !success; keyIdx++) {
      const activeKey = keys[keyIdx].key;

      if (targetProvider === 'gemini') {
        const geminiContents = state.chatHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        for (const candidateModel of fallbackGeminiModels) {
          try {
            fullOutput = await streamGemini(
              activeKey,
              candidateModel,
              state.runSettings.systemInstructions,
              geminiContents,
              state.runSettings,
              (streamed) => renderFormattedText(aiBubble, streamed)
            );
            success = true;
            break;
          } catch (err) {
            console.warn(`[Gateway Notice] Gemini model ${candidateModel} note:`, err.message);
            if (!state.runSettings.autoCascade) break;
            // Short backoff delay for 503 transient spikes
            await new Promise(r => setTimeout(r, 600));
          }
        }
      } else if (targetProvider === 'groq') {
        const groqMessages = [];
        if (state.runSettings.systemInstructions) groqMessages.push({ role: 'system', content: state.runSettings.systemInstructions });
        state.chatHistory.forEach(m => groqMessages.push({ role: m.role, content: m.content }));

        try {
          fullOutput = await streamOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            activeKey,
            selectedModel,
            groqMessages,
            state.runSettings,
            (streamed) => renderFormattedText(aiBubble, streamed)
          );
          success = true;
        } catch (err) {
          console.warn(`[Gateway Notice] Groq execution note:`, err.message);
        }
      } else if (targetProvider === 'openrouter') {
        const openRouterMessages = [];
        if (state.runSettings.systemInstructions) openRouterMessages.push({ role: 'system', content: state.runSettings.systemInstructions });
        state.chatHistory.forEach(m => openRouterMessages.push({ role: m.role, content: m.content }));

        try {
          fullOutput = await streamOpenAICompatible(
            'https://openrouter.ai/api/v1/chat/completions',
            activeKey,
            selectedModel,
            openRouterMessages,
            state.runSettings,
            (streamed) => renderFormattedText(aiBubble, streamed)
          );
          success = true;
        } catch (err) {
          console.warn(`[Gateway Notice] OpenRouter execution note:`, err.message);
        }
      }
    }

    dom.btnExecutePrompt.disabled = false;

    if (success && fullOutput) {
      dom.statusDot.className = 'status-indicator ready';
      dom.globalStatusLabel.textContent = 'AI Gateway: Ready';
      state.chatHistory.push({ role: 'assistant', content: fullOutput });
      applyOutputToFiles(fullOutput);
    } else {
      dom.statusDot.className = 'status-indicator error';
      dom.globalStatusLabel.textContent = 'Gateway Limit reached';
      aiBubble.innerHTML = '<span style="color:var(--accent-rose);">⚠️ Model currently unavailable (503/429). Check Key Vault or select another model in Run Settings.</span>';
    }
  }

  function applyOutputToFiles(text) {
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let found = 0;

    while ((match = fileRegex.exec(text)) !== null) {
      addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
      found++;
    }

    if (found > 0) {
      renderFiles();
    } else if (state.activeFile && text.includes('```')) {
      // If code blocks exist and a file is active
      const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        addOrUpdateFile(state.activeFile, codeMatch[1], true);
      }
    }
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured for ${provider.toUpperCase()}. Add your key above.</td>`;
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
      const name = prompt('Enter file path (e.g. index.html, styles.css, app.js):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
      }
    });

    dom.btnEmptyCreate.addEventListener('click', () => dom.btnNewFile.click());

    dom.btnClearWorkspace.addEventListener('click', () => {
      if (state.files.size > 0 && confirm('Clear all files from workspace?')) {
        state.files.clear();
        state.activeFile = null;
        dom.codeEditor.value = '';
        renderFiles();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.chatHistory = [];
      dom.dialogueStream.innerHTML = '<div class="dialogue-welcome"><p>Chat history cleared.</p></div>';
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

    // EXECUTION HANDLER
    function handleSend() {
      const prompt = dom.promptInput.value.trim();
      if (!prompt) return;
      dom.promptInput.value = '';
      routeAndSynthesize(prompt);
    }

    dom.btnExecutePrompt.addEventListener('click', handleSend);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnCodepenExport.addEventListener('click', exportToCodePen);
    dom.btnFetchLiveModels.addEventListener('click', fetchLiveModels);

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
      if (!state.activeFile) return alert('No file selected.');
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
      const selected = dom.settingModel.options[dom.settingModel.selectedIndex].text.split(' (')[0];
      dom.activeModelDisplay.textContent = selected;
      dom.headerModelLabel.textContent = selected;
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
    });
  }

  function init() {
    loadKeys();
    initEvents();
    renderFiles();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
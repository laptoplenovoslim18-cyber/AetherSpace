(function () {
  'use strict';

  // SOTA 2026 DEFAULT MODEL ROSTER (OVERRIDDEN BY LIVE FETCH)
  const DEFAULT_MODELS = {
    gemini: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' }
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' }
    ],
    openrouter: [
      { id: 'openrouter/free', name: 'OpenRouter Free Auto-Router' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Free' },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Free' }
    ],
    hf: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B' }
    ]
  };

  const state = {
    files: new Map(),
    activeFile: null,
    currentView: 'chat',
    conversationHistory: [], // [{ role: 'user'|'model', text: '...' }]
    models: JSON.parse(JSON.stringify(DEFAULT_MODELS)),
    runSettings: {
      model: 'gemini-3.7-flash',
      systemInstructions: 'You are AetherSpace Principal Systems & AI Engineer. Provide direct, natural, highly competent solutions without repetitive canned introductions.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [], hf: [] }
  };

  const dom = {
    viewTabChat: document.getElementById('view-tab-chat'),
    viewTabEditor: document.getElementById('view-tab-editor'),
    viewChatContainer: document.getElementById('view-chat-container'),
    viewEditorContainer: document.getElementById('view-editor-container'),
    openFilesCount: document.getElementById('open-files-count'),
    btnToggleExplorer: document.getElementById('btn-toggle-explorer'),
    explorerDrawer: document.getElementById('explorer-drawer'),

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

    chatStreamScroller: document.getElementById('chat-stream-scroller'),
    chatMessageList: document.getElementById('chat-message-list'),
    promptInput: document.getElementById('prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    activeContextLabel: document.getElementById('active-context-label'),
    globalStatusDot: document.getElementById('global-status-dot'),
    headerModelLabel: document.getElementById('header-model-label'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportManifest: document.getElementById('btn-export-manifest'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingModel: document.getElementById('setting-model'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
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
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),
    keyCountBadge: document.getElementById('key-count-badge')
  };

  // 1. PERSISTENCE & KEY MANAGEMENT
  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [], hf: [] }, JSON.parse(raw));
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

  // 2. DYNAMIC LIVE MODEL INVENTORY FETCHING
  async function fetchLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length > 0) {
      const key = geminiKeys[0].key;
      try {
        dom.gatewayStatusText.textContent = 'Querying live Gemini model inventory...';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            const valid = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => {
                const cleanId = m.name.replace(/^models\//, '');
                return { id: cleanId, name: m.displayName || cleanId };
              })
              .filter(m => m.id.includes('gemini-3') || m.id.includes('gemini-2.5') || m.id.includes('gemini-2.0'))
              .slice(0, 8);

            if (valid.length > 0) {
              state.models.gemini = valid;
              console.log('[Dynamic Gateway] Updated Gemini inventory live:', valid);
            }
          }
        }
      } catch (err) {
        console.warn('Dynamic model fetch note:', err.message);
      }
    }
    populateModelDropdown();
    dom.gatewayStatusText.textContent = 'Gateway Ready';
  }

  function populateModelDropdown() {
    dom.settingModel.innerHTML = '';

    const createGroup = (label, items) => {
      const group = document.createElement('optgroup');
      group.label = label;
      items.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === state.runSettings.model) opt.selected = true;
        group.appendChild(opt);
      });
      return group;
    };

    dom.settingModel.appendChild(createGroup('Google AI Studio (Live)', state.models.gemini));
    dom.settingModel.appendChild(createGroup('Groq Cloud', state.models.groq));
    dom.settingModel.appendChild(createGroup('OpenRouter Free Router', state.models.openrouter));

    if (!dom.settingModel.value && state.models.gemini.length > 0) {
      state.runSettings.model = state.models.gemini[0].id;
      dom.settingModel.value = state.runSettings.model;
    }
    dom.headerModelLabel.textContent = dom.settingModel.options[dom.settingModel.selectedIndex]?.text.split(' (')[0] || state.runSettings.model;
  }

  // 3. WORKSPACE & FILE MANAGEMENT
  function renderFiles() {
    dom.openFilesCount.textContent = state.files.size;
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
      li.addEventListener('click', () => {
        selectFile(filename);
        switchView('editor');
      });
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
    dom.activeContextLabel.textContent = `${count} context files (${chars.toLocaleString()} chars)`;
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

  function switchView(viewName) {
    state.currentView = viewName;
    if (viewName === 'chat') {
      dom.viewTabChat.classList.add('active');
      dom.viewTabEditor.classList.remove('active');
      dom.viewChatContainer.style.display = 'flex';
      dom.viewEditorContainer.style.display = 'none';
    } else {
      dom.viewTabEditor.classList.add('active');
      dom.viewTabChat.classList.remove('active');
      dom.viewEditorContainer.style.display = 'flex';
      dom.viewChatContainer.style.display = 'none';
      updateGutter();
    }
  }

  // 4. RESILIENT MULTI-TURN AI GATEWAY WITH REAL SSE STREAMING & RETRY
  function appendChatBubble(role, initialText = '') {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'ai'}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = role === 'user' ? 'You' : dom.headerModelLabel.textContent;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';
    body.textContent = initialText;

    bubble.appendChild(auth);
    bubble.appendChild(body);
    dom.chatMessageList.appendChild(bubble);
    dom.chatStreamScroller.scrollTop = dom.chatStreamScroller.scrollHeight;

    return body;
  }

  function renderFormattedAiResponse(container, text) {
    container.innerHTML = '';
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let lastIndex = 0;
    let match;

    while ((match = fileRegex.exec(text)) !== null) {
      const preText = text.substring(lastIndex, match.index);
      if (preText) {
        const span = document.createElement('span');
        span.innerHTML = preText.replace(/\n/g, '<br>');
        container.appendChild(span);
      }

      const filePath = match[1].trim();
      const codeContent = match[2].trimStart();

      const card = document.createElement('div');
      card.style.margin = '8px 0';
      card.innerHTML = `
        <div style="background:#030407; border:1px solid var(--border-subtle); border-radius:6px; overflow:hidden;">
          <div style="background:#0b0e14; padding:6px 10px; font-family:var(--font-mono); font-size:11px; display:flex; justify-content:space-between; align-items:center;">
            <span class="code-artifact-tag">📄 ${filePath}</span>
            <button class="btn-xs primary-outline" data-apply-file="${filePath}">Apply to Workspace</button>
          </div>
          <pre style="margin:0; padding:10px; border:none;"><code>${codeContent.replace(/</g, '&lt;')}</code></pre>
        </div>
      `;

      card.querySelector('[data-apply-file]').addEventListener('click', () => {
        addOrUpdateFile(filePath, codeContent, true);
        selectFile(filePath);
        switchView('editor');
      });

      container.appendChild(card);
      addOrUpdateFile(filePath, codeContent, true);
      lastIndex = fileRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      const span = document.createElement('span');
      span.innerHTML = remainingText.replace(/\n/g, '<br>');
      container.appendChild(span);
    }
  }

  // GEMINI REAL-TIME SSE STREAMING CALL WITH RETRY
  async function streamGemini(apiKey, model, systemPrompt, contentsHistory, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const payload = {
      contents: contentsHistory,
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
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.substring(5).trim();
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              const partText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (partText) {
                fullText += partText;
                onChunk(fullText);
              }
            } catch (parseErr) {
              // Ignore partial JSON chunk in buffer
            }
          }
        }
      }
    }
    return fullText;
  }

  // OPENAI-COMPATIBLE SSE STREAMING (GROQ / OPENROUTER)
  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, contentsHistory, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });

    contentsHistory.forEach(item => {
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts.map(p => p.text).join('')
      });
    });

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
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.substring(5).trim();
          if (jsonStr === '[DONE]') break;
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(fullText);
              }
            } catch (e) {}
          }
        }
      }
    }
    return fullText;
  }

  // AUTONOMOUS GATEWAY DISPATCHER WITH RETRY & FALLBACK
  async function dispatchGateway(promptText) {
    // 1. Build Multi-File Context
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });

    const userEntry = contextStr ? `[ATTACHED WORKSPACE CONTEXT]\n${contextStr}\n[TASK]\n${promptText}` : promptText;
    state.conversationHistory.push({ role: 'user', parts: [{ text: userEntry }] });

    appendChatBubble('user', promptText);
    dom.promptInput.value = '';
    dom.btnSendPrompt.disabled = true;
    dom.globalStatusDot.className = 'status-indicator busy';

    const aiBubbleBody = appendChatBubble('ai', '...');

    // Determine Provider & Model Candidates
    let selectedModel = state.runSettings.model;
    let provider = 'gemini';
    if (selectedModel.startsWith('llama') || selectedModel.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (selectedModel.includes('openrouter') || selectedModel.includes(':free')) provider = 'openrouter';

    let keys = state.keys[provider] || [];
    if (keys.length === 0) {
      dom.globalStatusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = `Missing API Key for ${provider.toUpperCase()}`;
      aiBubbleBody.textContent = `No API Key stored for ${provider.toUpperCase()}. Please open Key Vault to add a key.`;
      dom.btnSendPrompt.disabled = false;
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    // Candidate Fallback Queue
    const fallbackQueue = [selectedModel];
    if (provider === 'gemini') {
      ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash'].forEach(m => {
        if (!fallbackQueue.includes(m)) fallbackQueue.push(m);
      });
    }

    let success = false;
    let finalOutput = '';

    outerLoop:
    for (const modelToTry of fallbackQueue) {
      for (let k = 0; k < keys.length; k++) {
        const activeKey = keys[k].key;
        try {
          dom.gatewayStatusText.textContent = `Streaming from ${modelToTry} (Key ${k + 1}/${keys.length})...`;
          
          if (provider === 'gemini') {
            finalOutput = await streamGemini(
              activeKey,
              modelToTry,
              state.runSettings.systemInstructions,
              state.conversationHistory,
              (chunk) => {
                aiBubbleBody.textContent = chunk;
                dom.chatStreamScroller.scrollTop = dom.chatStreamScroller.scrollHeight;
              }
            );
          } else if (provider === 'groq') {
            finalOutput = await streamOpenAICompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              activeKey,
              modelToTry,
              state.runSettings.systemInstructions,
              state.conversationHistory,
              (chunk) => {
                aiBubbleBody.textContent = chunk;
                dom.chatStreamScroller.scrollTop = dom.chatStreamScroller.scrollHeight;
              }
            );
          } else if (provider === 'openrouter') {
            finalOutput = await streamOpenAICompatible(
              'https://openrouter.ai/api/v1/chat/completions',
              activeKey,
              modelToTry,
              state.runSettings.systemInstructions,
              state.conversationHistory,
              (chunk) => {
                aiBubbleBody.textContent = chunk;
                dom.chatStreamScroller.scrollTop = dom.chatStreamScroller.scrollHeight;
              }
            );
          }

          success = true;
          state.runSettings.model = modelToTry;
          dom.headerModelLabel.textContent = modelToTry;
          break outerLoop;

        } catch (err) {
          console.warn(`[Gateway Failover] Model ${modelToTry} Key ${k} encountered:`, err.message);
          
          // If HTTP 503 or 429, auto-retry next candidate in queue without popups
          if (err.message.includes('503') || err.message.includes('429')) {
            dom.gatewayStatusText.textContent = `Notice: ${modelToTry} busy. Auto-routing to fallback model...`;
            await new Promise(r => setTimeout(r, 600)); // Non-blocking jitter
          } else if (!state.runSettings.autoCascade) {
            aiBubbleBody.textContent = `Execution halted: ${err.message}`;
            break outerLoop;
          }
        }
      }
    }

    dom.btnSendPrompt.disabled = false;

    if (success && finalOutput) {
      dom.globalStatusDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = `Completed via ${state.runSettings.model}`;
      state.conversationHistory.push({ role: 'model', parts: [{ text: finalOutput }] });
      renderFormattedAiResponse(aiBubbleBody, finalOutput);
    } else {
      dom.globalStatusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'Inference unavailable on all keys/models';
      aiBubbleBody.textContent = 'All candidate models and keys are currently busy or rate-limited. Please retry in a few seconds or add a secondary key.';
    }
  }

  // 5. STAGING & EXPORT (CODEPEN, HTML BUNDLE, MANIFEST)
  function exportToCodePen() {
    if (state.files.size === 0) return alert('Workspace is empty. Create HTML/CSS/JS files first.');

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
      title: 'AetherSpace Live Export',
      html: htmlCode,
      css: cssCode,
      js: jsCode
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

  // 6. EVENT ATTACHMENTS
  function initEvents() {
    dom.viewTabChat.addEventListener('click', () => switchView('chat'));
    dom.viewTabEditor.addEventListener('click', () => switchView('editor'));

    dom.btnToggleExplorer.addEventListener('click', () => {
      dom.explorerDrawer.classList.toggle('open');
    });

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

    dom.btnSendPrompt.addEventListener('click', () => {
      const val = dom.promptInput.value.trim();
      if (val) dispatchGateway(val);
    });

    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = dom.promptInput.value.trim();
        if (val) dispatchGateway(val);
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.conversationHistory = [];
      dom.chatMessageList.innerHTML = '';
    });

    dom.btnNewFile.addEventListener('click', () => {
      const name = prompt('Enter filename (e.g. index.html, styles.css):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
        switchView('editor');
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

    dom.btnExportManifest.addEventListener('click', () => {
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

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));
    dom.btnRefreshModels.addEventListener('click', fetchLiveModels);

    dom.settingModel.addEventListener('change', () => {
      state.runSettings.model = dom.settingModel.value;
      dom.headerModelLabel.textContent = dom.settingModel.options[dom.settingModel.selectedIndex].text.split(' (')[0];
    });

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));
    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = 'You are AetherSpace Principal Systems & AI Engineer. Provide direct, natural, highly competent solutions without repetitive canned introductions.';
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
      const active = document.querySelector('.vault-tab-btn.active');
      const prov = active ? active.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return alert('Please enter an API key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      fetchLiveModels();
    });
  }

  // 7. INIT
  function init() {
    loadKeys();
    initEvents();
    renderFiles();
    populateModelDropdown();
    dom.settingSystemInstructions.value = state.runSettings.systemInstructions;
    fetchLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
(function () {
  'use strict';

  const state = {
    files: new Map(),
    activeFile: null,
    viewMode: 'chat', // 'chat' | 'studio' | 'split'
    orchestratorMode: 'direct', // 'direct' | 'multi-agent'
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: 'You are AetherSpace Principal Systems & AI Engineer. Deliver clean, deterministic, working code without placeholders.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [], hf: [] },
    liveModels: { gemini: [], groq: [], openrouter: [] }
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

    btnViewChat: document.getElementById('btn-view-chat'),
    btnViewStudio: document.getElementById('btn-view-studio'),
    btnViewSplit: document.getElementById('btn-view-split'),
    paneChat: document.getElementById('pane-chat'),
    paneStudio: document.getElementById('pane-studio'),
    orchestratorModeSelect: document.getElementById('orchestrator-mode-select'),

    chatStreamContainer: document.getElementById('chat-stream-container'),
    chatInput: document.getElementById('chat-input'),
    btnSendChat: document.getElementById('btn-send-chat'),
    activeContextSummary: document.getElementById('active-context-summary'),
    connectionStatus: document.getElementById('connection-status'),
    keyCountBadge: document.getElementById('key-count-badge'),
    activeModelNavLabel: document.getElementById('active-model-nav-label'),

    editorTabs: document.getElementById('editor-tabs'),
    codeEditor: document.getElementById('code-editor'),
    lineGutter: document.getElementById('line-gutter'),
    cursorPos: document.getElementById('cursor-pos'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),

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

  // PERSISTENCE
  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [], hf: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault load error', e);
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

  // DYNAMIC LIVE MODEL FETCHER
  async function fetchLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length > 0) {
      try {
        const key = geminiKeys[0].key;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            state.liveModels.gemini = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => m.name.replace('models/', ''));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Gemini live models:', e.message);
      }
    }

    const groqKeys = state.keys.groq || [];
    if (groqKeys.length > 0) {
      try {
        const key = groqKeys[0].key;
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            state.liveModels.groq = data.data.map(m => m.id);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Groq live models:', e.message);
      }
    }

    rebuildModelDropdown();
  }

  function rebuildModelDropdown() {
    const currentSelected = dom.settingModel.value;
    dom.settingModel.innerHTML = '';

    // Gemini group
    const gemGroup = document.createElement('optgroup');
    gemGroup.label = 'Google AI Studio (Live Available)';
    const geminiList = state.liveModels.gemini.length > 0 
      ? state.liveModels.gemini 
      : ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

    geminiList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      gemGroup.appendChild(opt);
    });
    dom.settingModel.appendChild(gemGroup);

    // Groq group
    const groqGroup = document.createElement('optgroup');
    groqGroup.label = 'Groq Cloud (Live Available)';
    const groqList = state.liveModels.groq.length > 0 
      ? state.liveModels.groq 
      : ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'];

    groqList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      groqGroup.appendChild(opt);
    });
    dom.settingModel.appendChild(groqGroup);

    // OpenRouter group
    const openGroup = document.createElement('optgroup');
    openGroup.label = 'OpenRouter (Free Tier)';
    ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      openGroup.appendChild(opt);
    });
    dom.settingModel.appendChild(openGroup);

    if ([...dom.settingModel.options].some(o => o.value === currentSelected)) {
      dom.settingModel.value = currentSelected;
    }
    dom.activeModelNavLabel.textContent = dom.settingModel.value.split('/').pop();
  }

  // VIEW MODE ENGINE
  function setViewMode(mode) {
    state.viewMode = mode;
    dom.btnViewChat.classList.toggle('active', mode === 'chat');
    dom.btnViewStudio.classList.toggle('active', mode === 'studio');
    dom.btnViewSplit.classList.toggle('active', mode === 'split');

    if (mode === 'chat') {
      dom.paneChat.style.display = 'flex';
      dom.paneStudio.style.display = 'none';
    } else if (mode === 'studio') {
      dom.paneChat.style.display = 'none';
      dom.paneStudio.style.display = 'flex';
    } else if (mode === 'split') {
      dom.paneChat.style.display = 'flex';
      dom.paneStudio.style.display = 'flex';
    }
  }

  // WORKSPACE FILE MANAGEMENT
  function renderFiles() {
    if (state.files.size === 0) {
      dom.fileTreeEmptyState.style.display = 'block';
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
      tab.className = `studio-tab ${filename === state.activeFile ? 'active' : ''}`;

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
    dom.activeContextSummary.textContent = `${count} files in context (${chars.toLocaleString()} chars)`;
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

  // CHAT STREAM RENDERING
  function appendChatMessage(role, initialText = '') {
    const msg = document.createElement('div');
    msg.className = `chat-message ${role}`;

    const header = document.createElement('div');
    header.className = 'msg-header';
    header.textContent = role === 'user' ? 'User' : (role === 'system' ? 'System' : 'AI Assistant');

    const content = document.createElement('div');
    content.className = 'msg-content';
    content.textContent = initialText;

    msg.appendChild(header);
    msg.appendChild(content);
    dom.chatStreamContainer.appendChild(msg);
    dom.chatStreamContainer.scrollTop = dom.chatStreamContainer.scrollHeight;

    return {
      element: msg,
      contentEl: content,
      update(text) {
        content.innerHTML = text
          .replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, '<pre><code>[$1]\n$2</code></pre>')
          .replace(/\n/g, '<br>');
        dom.chatStreamContainer.scrollTop = dom.chatStreamContainer.scrollHeight;
      }
    };
  }

  function buildPromptContext(userInstruction) {
    let ctx = '';
    state.files.forEach((f, name) => {
      if (f.inContext) ctx += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return ctx ? `WORKSPACE CONTEXT:\n${ctx}\nTASK:\n${userInstruction}` : userInstruction;
  }

  // STREAMING API INFERENCE WITH AUTO-CASCADE & BACKOFF
  async function streamGeminiContent(apiKey, model, systemPrompt, prompt, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              const part = data.candidates[0].content.parts.map(p => p.text || '').join('');
              fullText += part;
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, prompt, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

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
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              fullText += data.choices[0].delta.content;
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  // EXECUTE CHAT & ORCHESTRATION PIPELINE
  async function executePrompt() {
    const promptText = dom.chatInput.value.trim();
    if (!promptText) return;

    appendChatMessage('user', promptText);
    dom.chatInput.value = '';

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
    else if (model.includes('/')) provider = 'hf';

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      appendChatMessage('system', `No API Key found for provider [${provider.toUpperCase()}]. Open Key Vault to enter a valid key.`);
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    dom.btnSendChat.disabled = true;
    dom.connectionStatus.innerHTML = '<span class="dot busy"></span> Streaming...';

    const fullPrompt = buildPromptContext(promptText);
    const aiMessage = appendChatMessage('ai', 'Connecting...');
    let success = false;
    let finalOutput = '';

    // Multi-key failover & fallback loop
    for (let i = 0; i < keys.length; i++) {
      try {
        if (provider === 'gemini') {
          finalOutput = await streamGeminiContent(
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings,
            (text) => aiMessage.update(text)
          );
        } else if (provider === 'groq') {
          finalOutput = await streamOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings,
            (text) => aiMessage.update(text)
          );
        } else if (provider === 'openrouter') {
          finalOutput = await streamOpenAICompatible(
            'https://openrouter.ai/api/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings,
            (text) => aiMessage.update(text)
          );
        }
        success = true;
        break;
      } catch (err) {
        console.warn(`[Failover] Key ${i} failed with error:`, err.message);
        if (i < keys.length - 1 && state.runSettings.autoCascade) {
          aiMessage.update(`*High load/limit on key ${i + 1}. Cascading to key ${i + 2}...*`);
          await new Promise(r => setTimeout(r, 1000));
        } else {
          aiMessage.update(`*Execution Error: ${err.message}. If 503 persists, select another active model from the Run Settings panel.*`);
        }
      }
    }

    dom.btnSendChat.disabled = false;
    dom.connectionStatus.innerHTML = success 
      ? '<span class="dot ready"></span> Ready' 
      : '<span class="dot error"></span> Error';

    if (success && finalOutput) {
      applyExtractedFiles(finalOutput);
    }
  }

  function applyExtractedFiles(text) {
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let count = 0;

    while ((match = fileRegex.exec(text)) !== null) {
      addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
      count++;
    }

    if (count > 0) {
      renderFiles();
    }
  }

  // CODEPEN EXPORT
  function exportToCodePen() {
    if (state.files.size === 0) return alert('Workspace is empty.');

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
    input.value = JSON.stringify({ title: 'AetherSpace Export', html, css, js });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // KEY VAULT TABLE
  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const prov = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[prov] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:12px;">No keys configured for ${prov.toUpperCase()}.</td>`;
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
        fetchLiveModels();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  // EVENT ATTACHMENTS
  function initEvents() {
    dom.btnViewChat.addEventListener('click', () => setViewMode('chat'));
    dom.btnViewStudio.addEventListener('click', () => setViewMode('studio'));
    dom.btnViewSplit.addEventListener('click', () => setViewMode('split'));

    dom.orchestratorModeSelect.addEventListener('change', (e) => {
      state.orchestratorMode = e.target.value;
    });

    dom.btnSendChat.addEventListener('click', executePrompt);
    dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executePrompt();
      }
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

    dom.btnNewFile.addEventListener('click', () => {
      const name = prompt('File name (e.g. index.html, styles.css):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
      }
    });
    dom.btnEmptyCreate.addEventListener('click', () => dom.btnNewFile.click());

    dom.btnClearWorkspace.addEventListener('click', () => {
      if (state.files.size > 0 && confirm('Clear all files?')) {
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

    dom.btnExportZip.addEventListener('click', () => {
      if (state.files.size === 0) return alert('Workspace is empty.');
      let manifest = 'PROJECT MANIFEST\n================\n';
      state.files.forEach((f, name) => manifest += `\n[FILE: ${name}]\n${f.content}\n`);
      const blob = new Blob([manifest], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'aetherspace-manifest.txt';
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

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));
    dom.btnRefreshModels.addEventListener('click', fetchLiveModels);

    dom.settingModel.addEventListener('change', () => {
      dom.activeModelNavLabel.textContent = dom.settingModel.value.split('/').pop();
    });

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));
    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = 'You are AetherSpace Principal Systems & AI Engineer. Deliver clean, deterministic, working code without placeholders.';
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

      if (!key) return alert('Please enter a key.');
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
    dom.settingSystemInstructions.value = state.runSettings.systemInstructions;
    fetchLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
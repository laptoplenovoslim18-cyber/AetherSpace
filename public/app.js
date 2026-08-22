(function () {
  'use strict';

  // 1. STATE & STORES
  const state = {
    files: new Map(),
    activeFile: null,
    chatHistory: [], // [{role: 'user'|'model', content: string}]
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: 'You are AetherSpace Principal AI Architect. Synthesize production-ready code with complete logic and zero placeholders.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  // 2. DOM REFERENCES
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
    btnClearChat: document.getElementById('btn-clear-chat'),
    statusDot: document.getElementById('status-dot'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnSaveServer: document.getElementById('btn-save-server'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),

    settingModel: document.getElementById('setting-model'),
    optgroupGemini: document.getElementById('optgroup-gemini'),
    optgroupGroq: document.getElementById('optgroup-groq'),
    optgroupOpenRouter: document.getElementById('optgroup-openrouter'),

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

  // 3. KEY VAULT MANAGEMENT
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

  // 4. DYNAMIC MODEL DISCOVERY (LIVE FETCH)
  async function fetchLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length > 0) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const valid = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => m.name.replace(/^models\//, ''));

            if (valid.length > 0) {
              dom.optgroupGemini.innerHTML = '';
              valid.forEach(modelName => {
                const opt = document.createElement('option');
                opt.value = modelName;
                opt.textContent = modelName;
                if (modelName === 'gemini-2.5-flash' || modelName.includes('flash')) opt.selected = true;
                dom.optgroupGemini.appendChild(opt);
              });
            }
          }
        }
      } catch (err) {
        console.warn('Live Gemini fetch failed', err.message);
      }
    }

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
          }
        }
      } catch (err) {
        console.warn('Live Groq fetch failed', err.message);
      }
    }
  }

  // 5. WORKSPACE FILE EXPLORER
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

  // 6. CHAT STREAM UI
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

  function renderBubbleContent(container, text) {
    container.innerHTML = text
      .replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, '<pre><code>[$1]\n$2</code></pre>')
      .replace(/\n/g, '<br>');
    dom.dialogueStream.scrollTop = dom.dialogueStream.scrollHeight;
  }

  // 7. AI GATEWAY ROUTER (STREAMING & MULTI-TURN)
  async function streamGemini(apiKey, model, systemPrompt, chatHistory, fileContext, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const contents = [];
    if (fileContext) {
      contents.push({
        role: 'user',
        parts: [{ text: `ACTIVE WORKSPACE FILES:\n${fileContext}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. Workspace context loaded.' }]
      });
    }

    chatHistory.forEach(turn => {
      contents.push({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: turn.content }]
      });
    });

    const bodyPayload = {
      contents: contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    if (config.thinkingBudget > 0) {
      bodyPayload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }
    if (config.searchGrounding) {
      bodyPayload.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google AI Studio HTTP ${response.status}: ${errText}`);
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
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
              fullText += text;
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, chatHistory, fileContext, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    if (fileContext) messages.push({ role: 'system', content: `ACTIVE WORKSPACE FILES:\n${fileContext}` });

    chatHistory.forEach(turn => {
      messages.push({
        role: turn.role === 'user' ? 'user' : 'assistant',
        content: turn.content
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
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Provider HTTP ${response.status}: ${errText}`);
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
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
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

  // 8. SYNTHESIS PIPELINE & RESILIENT AUTO-FAILOVER
  async function executeMessage() {
    const prompt = dom.promptInput.value.trim();
    if (!prompt) return;

    dom.promptInput.value = '';
    const userBubble = createChatBubble('User');
    renderBubbleContent(userBubble, prompt);

    state.chatHistory.push({ role: 'user', content: prompt });

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
    else if (model.includes('/') || model.includes(':free')) provider = 'openrouter';

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      const aiBubble = createChatBubble('AI');
      renderBubbleContent(aiBubble, `No API Key found for ${provider.toUpperCase()}. Please open Key Vault to add a free API Key.`);
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
      return;
    }

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';

    let fileContext = '';
    state.files.forEach((f, name) => {
      if (f.inContext) fileContext += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });

    const aiBubble = createChatBubble('AI');
    let fullResult = '';
    let success = false;

    for (let i = 0; i < keys.length; i++) {
      try {
        if (provider === 'gemini') {
          fullResult = await streamGemini(
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            state.chatHistory,
            fileContext,
            state.runSettings,
            (partial) => renderBubbleContent(aiBubble, partial)
          );
        } else if (provider === 'groq') {
          fullResult = await streamOpenAICompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            state.chatHistory,
            fileContext,
            state.runSettings,
            (partial) => renderBubbleContent(aiBubble, partial)
          );
        } else if (provider === 'openrouter') {
          fullResult = await streamOpenAICompatible(
            'https://openrouter.ai/api/v1/chat/completions',
            keys[i].key,
            model,
            state.runSettings.systemInstructions,
            state.chatHistory,
            fileContext,
            state.runSettings,
            (partial) => renderBubbleContent(aiBubble, partial)
          );
        }
        success = true;
        break;
      } catch (err) {
        console.warn(`[Failover] Key ${i} failed:`, err.message);
        if (err.message.includes('503') && model.includes('flash') && model !== 'gemini-2.0-flash') {
          // Automatic graceful model downgrade on 503 high demand spike
          try {
            renderBubbleContent(aiBubble, `High demand on ${model}. Auto-routing to gemini-2.0-flash...`);
            fullResult = await streamGemini(
              keys[i].key,
              'gemini-2.0-flash',
              state.runSettings.systemInstructions,
              state.chatHistory,
              fileContext,
              state.runSettings,
              (partial) => renderBubbleContent(aiBubble, partial)
            );
            success = true;
            break;
          } catch (fallbackErr) {}
        }

        if (!state.runSettings.autoCascade || i === keys.length - 1) {
          renderBubbleContent(aiBubble, `Execution Error: ${err.message}`);
          break;
        }
      }
    }

    dom.btnExecutePrompt.disabled = false;

    if (success && fullResult) {
      dom.statusDot.className = 'status-indicator ready';
      state.chatHistory.push({ role: 'model', content: fullResult });

      // Automatically sync code blocks to workspace
      const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
      let match;
      let count = 0;
      while ((match = fileRegex.exec(fullResult)) !== null) {
        addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
        count++;
      }
      if (count > 0) renderFiles();
    } else {
      dom.statusDot.className = 'status-indicator error';
    }
  }

  // 9. VAULT UI
  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${provider.toUpperCase()}.</td>`;
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
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  // 10. CODEPEN EXPORT
  function exportToCodePen() {
    if (state.files.size === 0) return alert('Workspace is empty.');
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

  // 11. INITIALIZATION & EVENT ATTACHMENTS
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

    dom.btnExecutePrompt.addEventListener('click', executeMessage);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
        e.preventDefault();
        executeMessage();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.chatHistory = [];
      dom.dialogueStream.innerHTML = '';
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
        alert(`Saved ${state.activeFile} to disk.`);
      } catch (err) {
        alert('Preserved in browser memory.');
      }
    });

    dom.settingModel.addEventListener('change', () => {
      dom.activeModelDisplay.textContent = dom.settingModel.options[dom.settingModel.selectedIndex].text.split(' (')[0];
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));
    dom.btnRefreshModels.addEventListener('click', fetchLiveModels);

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));
    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = 'You are AetherSpace Principal AI Architect. Synthesize production-ready code with complete logic and zero placeholders.';
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
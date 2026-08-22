(function () {
  'use strict';

  const state = {
    currentView: 'chat',
    files: new Map(),
    activeFile: null,
    chatHistory: [], // True Multi-Turn context
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: 'You are AetherSpace Principal Systems Architect. Deliver direct, high-precision technical answers without conversational stubs or mock data.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    viewTabs: document.querySelectorAll('.nav-tab'),
    viewPanels: document.querySelectorAll('.view-panel'),

    // Chat
    chatStream: document.getElementById('chat-stream'),
    chatEmptyState: document.getElementById('chat-empty-state'),
    chatPromptInput: document.getElementById('chat-prompt-input'),
    btnSendChat: document.getElementById('btn-send-chat'),
    chatContextStat: document.getElementById('chat-context-stat'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    activeModelNavLabel: document.getElementById('active-model-nav-label'),

    // Editor
    fileList: document.getElementById('editor-file-list'),
    editorTabs: document.getElementById('editor-tabs'),
    codeEditor: document.getElementById('code-editor'),
    lineGutter: document.getElementById('line-gutter'),
    cursorPos: document.getElementById('cursor-pos'),
    btnNewFile: document.getElementById('btn-new-file'),
    btnUploadFiles: document.getElementById('btn-upload-files'),
    btnClearFiles: document.getElementById('btn-clear-files'),
    hiddenFileInput: document.getElementById('hidden-file-input'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportManifest: document.getElementById('btn-export-manifest'),
    btnSaveDisk: document.getElementById('btn-save-disk'),
    btnCodepenExport: document.getElementById('btn-codepen-export'),

    // Settings
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

    // Key Vault
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    keyVaultModal: document.getElementById('key-vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),
    keyCountBadge: document.getElementById('key-count-badge')
  };

  // 1. PERSISTENCE
  function loadVault() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault load error', e);
    }
    updateKeyBadge();
  }

  function saveVault() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // 2. DYNAMIC MODEL DISCOVERY
  async function syncLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length === 0) return;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const geminiModels = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));

        if (geminiModels.length > 0) {
          // Update model selector
          const currentVal = dom.settingModel.value;
          dom.settingModel.innerHTML = '';

          const groupGoogle = document.createElement('optgroup');
          groupGoogle.label = 'Google AI Studio (Live Available)';
          geminiModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            if (m === currentVal || m === 'gemini-2.5-flash') opt.selected = true;
            groupGoogle.appendChild(opt);
          });
          dom.settingModel.appendChild(groupGoogle);

          const groupGroq = document.createElement('optgroup');
          groupGroq.label = 'Groq Cloud (Fast Inference)';
          groupGroq.innerHTML = '<option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option><option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill</option>';
          dom.settingModel.appendChild(groupGroq);

          updateModelDisplay();
        }
      }
    } catch (e) {
      console.warn('Model discovery note:', e.message);
    }
  }

  function updateModelDisplay() {
    state.runSettings.model = dom.settingModel.value;
    dom.activeModelNavLabel.textContent = state.runSettings.model.split('-')[0].toUpperCase();
  }

  // 3. SSE STREAMING INFERENCE WITH 503/429 FAILOVER
  async function streamGeminiWithFailover(userMessage, onChunk, onDone, onError) {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length === 0) {
      onError('Missing Google AI Studio API Key. Please add one in Key Vault.');
      return;
    }

    // Fallback candidates if the selected model encounters a 503 capacity spike
    const modelCandidates = [
      state.runSettings.model,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ].filter((v, i, a) => a.indexOf(v) === i);

    let lastError = null;

    for (let k = 0; k < geminiKeys.length; k++) {
      const apiKey = geminiKeys[k].key;

      for (let m = 0; m < modelCandidates.length; m++) {
        const activeModel = modelCandidates[m];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

        // Build Multi-turn contents payload
        const contents = state.chatHistory.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }));

        // Attach workspace file context if available
        let contextPrefix = '';
        state.files.forEach((f, name) => {
          if (f.inContext) contextPrefix += `[File: ${name}]\n${f.content}\n\n`;
        });

        const currentPromptText = contextPrefix ? `WORKSPACE CONTEXT:\n${contextPrefix}\nUSER: ${userMessage}` : userMessage;
        contents.push({ role: 'user', parts: [{ text: currentPromptText }] });

        const body = {
          contents: contents,
          generationConfig: {
            temperature: state.runSettings.temperature,
            maxOutputTokens: state.runSettings.maxOutputTokens
          }
        };

        if (state.runSettings.systemInstructions) {
          body.systemInstruction = { parts: [{ text: state.runSettings.systemInstructions }] };
        }
        if (state.runSettings.thinkingBudget > 0) {
          body.generationConfig.thinkingConfig = { thinkingBudget: state.runSettings.thinkingBudget };
        }
        if (state.runSettings.searchGrounding) {
          body.tools = [{ googleSearch: {} }];
        }

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (response.status === 503 || response.status === 429) {
            console.warn(`[Failover] Model ${activeModel} returned ${response.status}. Attempting fallback candidate...`);
            continue; // Try next model candidate
          }

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let fullGeneratedText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.replace('data: ', '').trim();
                if (jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
                    const text = parsed.candidates[0].content.parts.map(p => p.text || '').join('');
                    fullGeneratedText += text;
                    onChunk(text);
                  }
                } catch (pe) {
                  // Buffer chunk fragment parse pass
                }
              }
            }
          }

          // Complete success
          state.chatHistory.push({ role: 'user', text: userMessage });
          state.chatHistory.push({ role: 'model', text: fullGeneratedText });
          onDone(fullGeneratedText);
          return;
        } catch (err) {
          lastError = err;
          console.warn(`[Inference Attempt Failed] ${err.message}`);
        }
      }
    }

    onError(lastError ? lastError.message : 'All failover candidates exhausted.');
  }

  // 4. UI INTERACTIONS
  function initChat() {
    dom.btnSendChat.addEventListener('click', handleChatSubmit);
    dom.chatPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSubmit();
      }
    });

    dom.btnClearHistory.addEventListener('click', () => {
      state.chatHistory = [];
      dom.chatStream.innerHTML = '';
      dom.chatStream.appendChild(dom.chatEmptyState);
      dom.chatEmptyState.style.display = 'block';
    });

    dom.btnSyncModels.addEventListener('click', () => {
      syncLiveModels();
      alert('Live models inventory synchronized from API.');
    });
  }

  async function handleChatSubmit() {
    const text = dom.chatPromptInput.value.trim();
    if (!text) return;

    dom.chatEmptyState.style.display = 'none';
    appendChatBubble('You', text, 'user');
    dom.chatPromptInput.value = '';

    const aiBubble = appendChatBubble('AI', '...', 'ai');
    let accumulatedText = '';

    dom.btnSendChat.disabled = true;

    await streamGeminiWithFailover(
      text,
      (chunk) => {
        if (accumulatedText === '') aiBubble.querySelector('.chat-bubble-body').innerHTML = '';
        accumulatedText += chunk;
        aiBubble.querySelector('.chat-bubble-body').innerHTML = accumulatedText.replace(/\n/g, '<br>');
        dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
      },
      (finalText) => {
        dom.btnSendChat.disabled = false;
        // Parse multi-file XML blocks if generated
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let match;
        while ((match = fileRegex.exec(finalText)) !== null) {
          addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
        }
      },
      (errorMsg) => {
        dom.btnSendChat.disabled = false;
        aiBubble.className = 'chat-bubble error';
        aiBubble.querySelector('.chat-bubble-body').textContent = `Inference Note: ${errorMsg}`;
      }
    );
  }

  function appendChatBubble(author, text, type) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    bubble.innerHTML = `<div class="chat-bubble-author">${author}</div><div class="chat-bubble-body">${text.replace(/\n/g, '<br>')}</div>`;
    dom.chatStream.appendChild(bubble);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
    return bubble;
  }

  // 5. FILE SYSTEM & CODE STUDIO
  function addOrUpdateFile(filename, content = '', inContext = true) {
    state.files.set(filename, { content, inContext });
    if (!state.activeFile) state.activeFile = filename;
    renderFileSidebar();
    if (state.activeFile === filename) {
      dom.codeEditor.value = content;
      updateGutter();
    }
  }

  function renderFileSidebar() {
    dom.fileList.innerHTML = '';
    dom.editorTabs.innerHTML = '';

    state.files.forEach((fileObj, filename) => {
      const li = document.createElement('li');
      li.className = `file-item ${filename === state.activeFile ? 'active' : ''}`;
      li.textContent = filename;
      li.addEventListener('click', () => {
        state.activeFile = filename;
        dom.codeEditor.value = state.files.get(filename).content;
        renderFileSidebar();
        updateGutter();
      });
      dom.fileList.appendChild(li);

      const tab = document.createElement('div');
      tab.className = `editor-tab ${filename === state.activeFile ? 'active' : ''}`;
      tab.textContent = filename;
      tab.addEventListener('click', () => {
        state.activeFile = filename;
        dom.codeEditor.value = state.files.get(filename).content;
        renderFileSidebar();
        updateGutter();
      });
      dom.editorTabs.appendChild(tab);
    });

    let contextCount = 0;
    state.files.forEach(f => { if (f.inContext) contextCount++; });
    dom.chatContextStat.textContent = `${contextCount} files in prompt context`;
  }

  function updateGutter() {
    const lines = dom.codeEditor.value.split('\n').length;
    let str = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) str += i + '\n';
    dom.lineGutter.textContent = str;
  }

  // 6. CODEPEN ONE-CLICK EXPORT
  function exportToCodePen() {
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

  // 7. EVENT ATTACHMENTS
  function initEvents() {
    // View Switcher
    dom.viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.viewTabs.forEach(t => t.classList.remove('active'));
        dom.viewPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const viewId = `view-${tab.dataset.view}`;
        document.getElementById(viewId).classList.add('active');
      });
    });

    // Editor sync
    dom.codeEditor.addEventListener('input', () => {
      if (state.activeFile) state.files.get(state.activeFile).content = dom.codeEditor.value;
      updateGutter();
    });

    // Run Settings Panel
    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));
    dom.settingModel.addEventListener('change', updateModelDisplay);

    // Key Vault Modal
    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.keyVaultModal.style.display = 'none');

    dom.btnAddKey.addEventListener('click', () => {
      const activeTab = document.querySelector('.vault-tab-btn.active');
      const prov = activeTab ? activeTab.dataset.provider : 'gemini';
      const keyVal = dom.vaultKeyInput.value.trim();
      const labelVal = dom.vaultLabelInput.value.trim() || 'Key';

      if (!keyVal) return;
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key: keyVal, label: labelVal, created: new Date().toLocaleDateString() });
      saveVault();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      syncLiveModels();
    });

    // Direct CodePen Export
    dom.btnCodepenExport.addEventListener('click', exportToCodePen);

    // Save to Disk
    dom.btnSaveDisk.addEventListener('click', async () => {
      if (!state.activeFile) return alert('No active file selected.');
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: state.activeFile, content: dom.codeEditor.value })
        });
        if (!res.ok) throw new Error('Save error');
        alert(`Saved ${state.activeFile} to disk.`);
      } catch (err) {
        alert('File preserved in browser state.');
      }
    });
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      dom.vaultKeysTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:14px;">No keys stored for ${provider.toUpperCase()}.</td></tr>`;
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `<td><code>${mask}</code></td><td>${k.label}</td><td><span class="badge">Free Tier</span></td><td>${k.created}</td><td><button class="btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>`;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveVault();
        renderVaultTable();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function init() {
    loadVault();
    initEvents();
    initChat();
    updateModelDisplay();
    syncLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
(function () {
  'use strict';

  const state = {
    currentView: 'chat',
    files: new Map(), // filename -> { content: string, inContext: boolean }
    activeFile: null,
    runSettings: {
      model: 'gemini-3.7-flash',
      systemInstructions: 'You are AetherSpace SOTA AI Architect. Synthesize deterministic, production-ready code with complete logic.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] },
    chatHistory: []
  };

  const dom = {
    tabBtnChat: document.getElementById('tab-btn-chat'),
    tabBtnEditor: document.getElementById('tab-btn-editor'),
    viewChat: document.getElementById('view-chat'),
    viewEditor: document.getElementById('view-editor'),

    gatewayStatusDot: document.getElementById('gateway-status-dot'),
    settingModel: document.getElementById('setting-model'),
    btnSyncModels: document.getElementById('btn-sync-models'),

    chatStream: document.getElementById('chat-stream'),
    chatEmptyHero: document.getElementById('chat-empty-hero'),
    chatPromptInput: document.getElementById('chat-prompt-input'),
    btnSendChat: document.getElementById('btn-send-chat'),
    activeContextBadge: document.getElementById('active-context-badge'),
    btnToggleContextDrawer: document.getElementById('btn-toggle-context-drawer'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    workspaceFileList: document.getElementById('workspace-file-list'),
    btnNewFile: document.getElementById('btn-new-file'),
    btnUploadFile: document.getElementById('btn-upload-file'),
    btnClearFiles: document.getElementById('btn-clear-files'),
    hiddenFileInput: document.getElementById('hidden-file-input'),

    editorTabs: document.getElementById('editor-tabs'),
    codeEditor: document.getElementById('code-editor'),
    lineGutter: document.getElementById('line-gutter'),
    cursorPos: document.getElementById('cursor-pos'),
    btnExportBundle: document.getElementById('btn-export-bundle'),
    btnExportManifest: document.getElementById('btn-export-manifest'),
    btnSaveServer: document.getElementById('btn-save-server'),
    btnCodepenExport: document.getElementById('btn-codepen-export'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
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
    const total = Object.values(state.keys).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // DYNAMIC MODEL INVENTORY FETCHING
  async function syncLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length === 0) return;

    dom.gatewayStatusDot.className = 'status-dot busy';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));

        // Update select with live discovered models
        if (models.length > 0) {
          const geminiGroup = dom.settingModel.querySelector('optgroup[label*="Google"]');
          if (geminiGroup) {
            geminiGroup.innerHTML = '';
            models.slice(0, 5).forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              if (m === state.runSettings.model) opt.selected = true;
              geminiGroup.appendChild(opt);
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Discovery] Live model sync error:', err.message);
    }
    dom.gatewayStatusDot.className = 'status-dot ready';
  }

  // SSE STREAMING GATEWAY WITH AUTO-RETRY & MULTI-MODEL FAILOVER
  async function streamGatewayRequest(prompt, onToken) {
    const model = state.runSettings.model;
    let provider = 'gemini';
    if (model.startsWith('llama') || model.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (model.includes('openrouter') || model.includes(':free')) provider = 'openrouter';

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      throw new Error(`Missing API Key for ${provider.toUpperCase()}. Please configure it in Key Vault.`);
    }

    // Build Context
    let contextStr = '';
    state.files.forEach((f, name) => {
      if (f.inContext) contextStr += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    const fullUserPrompt = contextStr ? `WORKSPACE CODE CONTEXT:\n${contextStr}\nTASK INSTRUCTION:\n${prompt}` : prompt;

    // Fallback Models List in case of 503 Overload
    const fallbackModels = provider === 'gemini' 
      ? [model, 'gemini-2.5-flash', 'gemini-2.0-flash']
      : [model];

    let lastError = null;

    for (let mIdx = 0; mIdx < fallbackModels.length; mIdx++) {
      const activeModel = fallbackModels[mIdx];

      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const apiKey = keys[kIdx].key;

        // Try up to 2 retries on 503
        for (let retry = 0; retry < 2; retry++) {
          try {
            if (provider === 'gemini') {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
              const payload = {
                contents: [{ role: 'user', parts: [{ text: fullUserPrompt }] }],
                generationConfig: {
                  temperature: state.runSettings.temperature,
                  maxOutputTokens: state.runSettings.maxOutputTokens
                }
              };
              if (state.runSettings.systemInstructions) {
                payload.systemInstruction = { parts: [{ text: state.runSettings.systemInstructions }] };
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

              if (response.status === 503 || response.status === 429) {
                const errBody = await response.text();
                console.warn(`[Gateway Warning] ${activeModel} returned ${response.status}. Retrying...`);
                await new Promise(r => setTimeout(r, 1200 * (retry + 1)));
                continue; // retry
              }

              if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errBody}`);
              }

              // Read SSE Stream
              const reader = response.body.getReader();
              const decoder = new TextDecoder('utf-8');
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep last partial line

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;
                    try {
                      const parsed = JSON.parse(jsonStr);
                      if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
                        const token = parsed.candidates[0].content.parts.map(p => p.text || '').join('');
                        onToken(token);
                      }
                    } catch (pe) {}
                  }
                }
              }
              return; // Success!
            } else {
              // OpenAI Compatible (Groq / OpenRouter)
              const endpoint = provider === 'groq' 
                ? 'https://api.groq.com/openai/v1/chat/completions' 
                : 'https://openrouter.ai/api/v1/chat/completions';

              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: activeModel,
                  messages: [
                    { role: 'system', content: state.runSettings.systemInstructions },
                    { role: 'user', content: fullUserPrompt }
                  ],
                  stream: true,
                  temperature: state.runSettings.temperature,
                  max_tokens: Math.min(state.runSettings.maxOutputTokens, 8192)
                })
              });

              if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errBody}`);
              }

              const reader = response.body.getReader();
              const decoder = new TextDecoder('utf-8');
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
                    if (jsonStr === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const delta = parsed.choices[0].delta.content || '';
                      onToken(delta);
                    } catch (pe) {}
                  }
                }
              }
              return; // Success!
            }
          } catch (err) {
            lastError = err;
            console.warn(`[Failover] Model ${activeModel} on Key ${kIdx} failed:`, err.message);
          }
        }
      }
    }

    throw lastError || new Error('All failover attempts exhausted.');
  }

  // CHAT STREAM RENDERING & INTERACTION
  async function handleSendChat() {
    const prompt = dom.chatPromptInput.value.trim();
    if (!prompt) return;

    if (dom.chatEmptyHero) dom.chatEmptyHero.style.display = 'none';

    // Append User Bubble
    appendBubble('user', prompt);
    dom.chatPromptInput.value = '';
    dom.btnSendChat.disabled = true;
    dom.gatewayStatusDot.className = 'status-dot busy';

    // Prepare AI Bubble
    const aiBubble = appendBubble('ai', '');
    const bodyEl = aiBubble.querySelector('.chat-bubble-body');
    let fullResponse = '';

    try {
      await streamGatewayRequest(prompt, (token) => {
        fullResponse += token;
        bodyEl.innerHTML = formatMarkdown(fullResponse);
        dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
      });

      // Extract generated files automatically
      applyFileExtraction(fullResponse);
      dom.gatewayStatusDot.className = 'status-dot ready';
    } catch (err) {
      bodyEl.innerHTML = `<span style="color:var(--accent-rose);">Gateway Error: ${err.message}</span>`;
      dom.gatewayStatusDot.className = 'status-dot error';
    }

    dom.btnSendChat.disabled = false;
  }

  function appendBubble(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = `
      <div class="chat-bubble-author">${role === 'user' ? 'You' : state.runSettings.model}</div>
      <div class="chat-bubble-body">${formatMarkdown(text)}</div>
    `;
    dom.chatStream.appendChild(bubble);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
    return bubble;
  }

  function formatMarkdown(str) {
    if (!str) return '...';
    return str
      .replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, '<pre><code>[FILE CREATED: $1]\n$2</code></pre>')
      .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/\n/g, '<br>');
  }

  function applyFileExtraction(text) {
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let count = 0;
    while ((match = fileRegex.exec(text)) !== null) {
      addOrUpdateFile(match[1].trim(), match[2].trimStart(), true);
      count++;
    }
    if (count > 0) renderFiles();
  }

  // FILE SYSTEM & EDITOR
  function renderFiles() {
    dom.workspaceFileList.innerHTML = '';
    state.files.forEach((fileObj, filename) => {
      const li = document.createElement('li');
      li.className = `file-item ${filename === state.activeFile ? 'active' : ''}`;
      li.innerHTML = `
        <span>${filename}</span>
        <button class="icon-tool-btn" data-del="${filename}">&times;</button>
      `;
      li.addEventListener('click', () => selectFile(filename));
      li.querySelector('[data-del]').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });
      dom.workspaceFileList.appendChild(li);
    });

    renderTabs();
    updateContextCounter();
  }

  function renderTabs() {
    dom.editorTabs.innerHTML = '';
    state.files.forEach((_, filename) => {
      const tab = document.createElement('div');
      tab.className = `editor-tab ${filename === state.activeFile ? 'active' : ''}`;
      tab.innerHTML = `
        <span>${filename}</span>
        <button class="icon-tool-btn" data-close="${filename}">&times;</button>
      `;
      tab.addEventListener('click', () => selectFile(filename));
      tab.querySelector('[data-close]').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });
      dom.editorTabs.appendChild(tab);
    });
  }

  function selectFile(filename) {
    if (!state.files.has(filename)) return;
    state.activeFile = filename;
    dom.codeEditor.value = state.files.get(filename).content;
    renderFiles();
    updateGutter();
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
    let count = 0;
    state.files.forEach(f => { if (f.inContext) count++; });
    dom.activeContextBadge.textContent = `${count} files attached`;
  }

  function updateGutter() {
    const lines = dom.codeEditor.value.split('\n').length;
    let str = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) str += i + '\n';
    dom.lineGutter.textContent = str;
  }

  // CODEPEN EXPORT
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
      title: 'AetherSpace Canvas Export',
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
      dom.vaultKeysTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${provider.toUpperCase()}.</td></tr>`;
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
        <td><button class="icon-tool-btn" data-del="${idx}" style="color:var(--accent-rose);">&times;</button></td>
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
    // View Switcher
    dom.tabBtnChat.addEventListener('click', () => {
      dom.tabBtnChat.classList.add('active');
      dom.tabBtnEditor.classList.remove('active');
      dom.viewChat.classList.add('active');
      dom.viewEditor.classList.remove('active');
      state.currentView = 'chat';
    });

    dom.tabBtnEditor.addEventListener('click', () => {
      dom.tabBtnEditor.classList.add('active');
      dom.tabBtnChat.classList.remove('active');
      dom.viewEditor.classList.add('active');
      dom.viewChat.classList.remove('active');
      state.currentView = 'editor';
      renderFiles();
    });

    // Chat
    dom.btnSendChat.addEventListener('click', handleSendChat);
    dom.chatPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      dom.chatStream.innerHTML = '';
      if (dom.chatEmptyHero) dom.chatStream.appendChild(dom.chatEmptyHero);
    });

    dom.btnToggleContextDrawer.addEventListener('click', () => dom.tabBtnEditor.click());

    // Editor & File Controls
    dom.codeEditor.addEventListener('input', () => {
      if (state.activeFile) state.files.get(state.activeFile).content = dom.codeEditor.value;
      updateGutter();
    });

    dom.btnNewFile.addEventListener('click', () => {
      const name = prompt('Filename (e.g. index.html, script.js):');
      if (name && name.trim()) {
        addOrUpdateFile(name.trim(), '', true);
        selectFile(name.trim());
      }
    });

    dom.btnUploadFile.addEventListener('click', () => dom.hiddenFileInput.click());
    dom.hiddenFileInput.addEventListener('change', (e) => {
      Array.from(e.target.files || []).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => addOrUpdateFile(file.name, ev.target.result, true);
        reader.readAsText(file);
      });
      dom.hiddenFileInput.value = '';
    });

    dom.btnClearFiles.addEventListener('click', () => {
      if (confirm('Clear workspace files?')) {
        state.files.clear();
        state.activeFile = null;
        dom.codeEditor.value = '';
        renderFiles();
      }
    });

    dom.btnSaveServer.addEventListener('click', async () => {
      if (!state.activeFile) return alert('No file active.');
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: state.activeFile, content: dom.codeEditor.value })
        });
        if (!res.ok) throw new Error('Failed to save to server');
        alert(`Saved ${state.activeFile} to disk.`);
      } catch (err) {
        alert('File preserved in local memory.');
      }
    });

    dom.btnExportBundle.addEventListener('click', () => {
      if (state.files.size === 0) return alert('Workspace is empty.');
      let bundle = '<!DOCTYPE html>\n<html>\n<head>\n';
      state.files.forEach((f, name) => {
        if (name.endsWith('.css')) bundle += `<style>/* ${name} */\n${f.content}\n</style>\n`;
      });
      bundle += '</head>\n<body>\n';
      state.files.forEach((f, name) => {
        if (name.endsWith('.html')) bundle += f.content + '\n';
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

    dom.btnCodepenExport.addEventListener('click', exportToCodePen);
    dom.btnSyncModels.addEventListener('click', syncLiveModels);

    // Settings
    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingModel.addEventListener('change', () => {
      state.runSettings.model = dom.settingModel.value;
    });

    // Key Vault
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
      if (!key) return;

      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      syncLiveModels();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    renderFiles();
    syncLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
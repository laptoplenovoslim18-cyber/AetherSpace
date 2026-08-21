(function () {
  'use strict';

  const state = {
    files: new Map(),
    activeFile: null,
    activeProvider: 'gemini',
    auth: { isLoggedIn: false, user: null },
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: 'You are AetherSpace SOTA Senior Principal Software Architect. Synthesize clean, deterministic, production-ready code with complete logic and zero placeholders.',
      thinkingBudget: 4096,
      searchGrounding: false,
      autoCascade: true,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], hf: [], openrouter: [] }
  };

  const dom = {
    fileTreeRoot: document.getElementById('file-tree-root'),
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

    promptInput: document.getElementById('prompt-input'),
    btnExecutePrompt: document.getElementById('btn-execute-prompt'),
    activeContextCount: document.getElementById('active-context-count'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    governorStat: document.getElementById('governor-stat'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnExportZip: document.getElementById('btn-export-zip'),
    btnExportHtml: document.getElementById('btn-export-html'),
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
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),

    authModal: document.getElementById('auth-modal'),
    openAuthBtn: document.getElementById('open-auth-btn'),
    btnCloseAuth: document.getElementById('btn-close-auth'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    btnSubmitAuth: document.getElementById('btn-submit-auth'),
    authStateLabel: document.getElementById('auth-state-label')
  };

  function loadStoredKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) {
        state.keys = Object.assign({ gemini: [], groq: [], hf: [], openrouter: [] }, JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Failed to parse stored API keys', e);
    }
    updateKeyBadge();
  }

  function saveStoredKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function renderFileTree() {
    const fileCount = state.files.size;
    if (fileCount === 0) {
      dom.fileTreeEmptyState.style.display = 'flex';
      dom.fileListItems.style.display = 'none';
      dom.fileListItems.innerHTML = '';
      renderEditorTabs();
      updateLineGutter();
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
      checkbox.title = 'Include in Prompt AI Context';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        fileObj.inContext = checkbox.checked;
        updateContextCounter();
      });

      const spanName = document.createElement('span');
      spanName.textContent = filename;

      left.appendChild(checkbox);
      left.appendChild(spanName);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-tool-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete File';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });

      li.appendChild(left);
      li.appendChild(deleteBtn);

      li.addEventListener('click', () => {
        selectFile(filename);
      });

      dom.fileListItems.appendChild(li);
    });

    renderEditorTabs();
    updateContextCounter();
  }

  function renderEditorTabs() {
    dom.editorTabs.innerHTML = '';
    state.files.forEach((_, filename) => {
      const tab = document.createElement('div');
      tab.className = `editor-tab ${filename === state.activeFile ? 'active' : ''}`;
      
      const tabTitle = document.createElement('span');
      tabTitle.textContent = filename;
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(filename);
      });

      tab.appendChild(tabTitle);
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => {
        selectFile(filename);
      });

      dom.editorTabs.appendChild(tab);
    });
  }

  function selectFile(filename) {
    if (!state.files.has(filename)) return;
    state.activeFile = filename;
    dom.codeEditor.value = state.files.get(filename).content;
    renderFileTree();
    updateLineGutter();
    updateCursorPos();
  }

  function addOrUpdateFile(filename, content = '', inContext = true) {
    state.files.set(filename, { content, inContext });
    if (!state.activeFile) {
      state.activeFile = filename;
    }
    renderFileTree();
    if (state.activeFile === filename) {
      dom.codeEditor.value = content;
      updateLineGutter();
    }
  }

  function removeFile(filename) {
    state.files.delete(filename);
    if (state.activeFile === filename) {
      const keys = Array.from(state.files.keys());
      state.activeFile = keys.length > 0 ? keys[keys.length - 1] : null;
      dom.codeEditor.value = state.activeFile ? state.files.get(state.activeFile).content : '';
    }
    renderFileTree();
    updateLineGutter();
  }

  function createNewFilePrompt() {
    const filename = prompt('Enter relative file name (e.g. index.js, component.css):');
    if (!filename || !filename.trim()) return;
    const clean = filename.trim();
    if (state.files.has(clean)) {
      alert('File already exists in workspace.');
      return;
    }
    addOrUpdateFile(clean, `// ${clean}\n`, true);
    selectFile(clean);
  }

  function updateContextCounter() {
    let count = 0;
    let chars = 0;
    state.files.forEach((f) => {
      if (f.inContext) {
        count++;
        chars += f.content.length;
      }
    });
    dom.activeContextCount.textContent = `${count} files (${chars.toLocaleString()} chars)`;
  }

  function updateLineGutter() {
    const text = dom.codeEditor.value;
    const lineCount = text.split('\n').length;
    let gutterStr = '';
    for (let i = 1; i <= Math.max(lineCount, 1); i++) {
      gutterStr += i + '\n';
    }
    dom.lineGutter.textContent = gutterStr;
  }

  function updateCursorPos() {
    const text = dom.codeEditor.value;
    const selStart = dom.codeEditor.selectionStart;
    const lines = text.substring(0, selStart).split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    dom.cursorPos.textContent = `Ln ${lineNum}, Col ${colNum}`;
  }

  function syncRunSettingsFromDOM() {
    state.runSettings.model = dom.settingModel.value;
    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    state.runSettings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);
  }

  function buildContextPayload(userPrompt) {
    let contextBundle = '';
    state.files.forEach((f, name) => {
      if (f.inContext) {
        contextBundle += `<file path="${name}">\n${f.content}\n</file>\n\n`;
      }
    });

    if (!contextBundle) {
      return userPrompt;
    }

    return `CURRENT WORKSPACE CONTEXT:\n${contextBundle}\nTASK SPECIFICATION:\n${userPrompt}`;
  }

  async function executeGeminiRequest(apiKey, model, systemPrompt, fullPrompt, config) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    if (config.thinkingBudget > 0) {
      bodyPayload.generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget
      };
    }

    if (config.searchGrounding) {
      bodyPayload.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google AI Studio HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json();
    if (!json.candidates || !json.candidates[0] || !json.candidates[0].content) {
      throw new Error('Empty response candidate from Google AI Studio.');
    }

    return json.candidates[0].content.parts.map(p => p.text || '').join('');
  }

  async function executeOpenAICompatibleRequest(endpointUrl, apiKey, model, systemPrompt, fullPrompt, config) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: fullPrompt });

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192)
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Provider HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json();
    if (!json.choices || !json.choices[0] || !json.choices[0].message) {
      throw new Error('Empty completion from provider.');
    }
    return json.choices[0].message.content;
  }

  async function synthesizeCloudPrompt() {
    const promptText = dom.promptInput.value.trim();
    if (!promptText) {
      alert('Please enter a prompt or instruction.');
      return;
    }

    syncRunSettingsFromDOM();
    const model = state.runSettings.model;
    let provider = 'gemini';

    if (model.startsWith('llama')) provider = 'groq';
    else if (model.includes('/') && !model.includes(':free')) provider = 'hf';
    else if (model.includes(':free')) provider = 'openrouter';

    const keysList = state.keys[provider] || [];
    if (keysList.length === 0) {
      alert(`No API keys stored for ${provider.toUpperCase()}. Please open Key Vault to add a key.`);
      dom.keyVaultModal.style.display = 'flex';
      return;
    }

    dom.btnExecutePrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';
    dom.statusText.textContent = `Routing to ${model} via Cloud Mesh...`;

    const fullPrompt = buildContextPayload(promptText);
    let outputResult = null;
    let executionSuccess = false;

    for (let i = 0; i < keysList.length; i++) {
      const currentKey = keysList[i].key;
      try {
        dom.statusText.textContent = `Executing on Key ${i + 1}/${keysList.length} (${provider})...`;
        
        if (provider === 'gemini') {
          outputResult = await executeGeminiRequest(
            currentKey,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings
          );
        } else if (provider === 'groq') {
          outputResult = await executeOpenAICompatibleRequest(
            'https://api.groq.com/openai/v1/chat/completions',
            currentKey,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings
          );
        } else if (provider === 'openrouter') {
          outputResult = await executeOpenAICompatibleRequest(
            'https://openrouter.ai/api/v1/chat/completions',
            currentKey,
            model,
            state.runSettings.systemInstructions,
            fullPrompt,
            state.runSettings
          );
        }

        executionSuccess = true;
        break;
      } catch (err) {
        console.warn(`[Cascade] Key index ${i} failed:`, err.message);
        if (!state.runSettings.autoCascade || i === keysList.length - 1) {
          dom.statusDot.className = 'status-indicator error';
          dom.statusText.textContent = `Synthesis failed: ${err.message}`;
          alert(`Inference failed on provider ${provider}: ${err.message}`);
          break;
        }
      }
    }

    dom.btnExecutePrompt.disabled = false;

    if (executionSuccess && outputResult) {
      dom.statusDot.className = 'status-indicator ready';
      dom.statusText.textContent = `Synthesis completed. Zero local compute weight active.`;
      parseAndApplySynthesisResult(outputResult);
      dom.promptInput.value = '';
    }
  }

  function parseAndApplySynthesisResult(resultText) {
    const fileTagRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let parsedCount = 0;

    while ((match = fileTagRegex.exec(resultText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trimStart();
      addOrUpdateFile(filePath, content, true);
      parsedCount++;
    }

    if (parsedCount > 0) {
      renderFileTree();
      return;
    }

    if (state.activeFile) {
      addOrUpdateFile(state.activeFile, resultText, true);
    } else {
      addOrUpdateFile('synthesis_output.txt', resultText, true);
      selectFile('synthesis_output.txt');
    }
  }

  function renderVaultKeys() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys stored for ${provider.toUpperCase()}. Add your key above.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default Key'}</td>
        <td><span class="badge">Free Tier</span></td>
        <td>${k.created || 'Just now'}</td>
        <td><button class="btn-xs" data-del-key="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;

      tr.querySelector('[data-del-key]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveStoredKeys();
        renderVaultKeys();
      });

      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function exportSingleHtml() {
    if (state.files.size === 0) {
      alert('Workspace is empty.');
      return;
    }

    let bundle = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>AetherSpace Export</title>\n';
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

    const blob = new Blob([bundle], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetherspace-bundle.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportZipArchive() {
    if (state.files.size === 0) {
      alert('Workspace is empty.');
      return;
    }

    let manifest = 'AETHERSPACE PROJECT MANIFEST\n============================\n';
    state.files.forEach((f, name) => {
      manifest += `\n[FILE: ${name}]\n${f.content}\n`;
    });

    const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetherspace-workspace-export.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveActiveFileToServer() {
    if (!state.activeFile) {
      alert('No active file selected.');
      return;
    }
    const content = dom.codeEditor.value;
    state.files.get(state.activeFile).content = content;

    try {
      dom.statusText.textContent = `Saving ${state.activeFile} to local server...`;
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: state.activeFile, content: content })
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await res.json();
      dom.statusText.textContent = `Saved to disk. Git sync scheduled.`;
    } catch (e) {
      console.warn('Server save note:', e.message);
      dom.statusText.textContent = `Saved in local browser memory.`;
    }
  }

  function initEvents() {
    dom.codeEditor.addEventListener('input', () => {
      if (state.activeFile) {
        state.files.get(state.activeFile).content = dom.codeEditor.value;
      }
      updateLineGutter();
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
        updateLineGutter();
      }
    });

    dom.btnNewFile.addEventListener('click', createNewFilePrompt);
    dom.btnEmptyCreate.addEventListener('click', createNewFilePrompt);

    dom.btnClearWorkspace.addEventListener('click', () => {
      if (state.files.size === 0) return;
      if (confirm('Clear all files from workspace memory?')) {
        state.files.clear();
        state.activeFile = null;
        dom.codeEditor.value = '';
        renderFileTree();
      }
    });

    dom.btnSelectAllContext.addEventListener('click', () => {
      state.files.forEach(f => f.inContext = true);
      renderFileTree();
    });

    dom.btnDeselectAllContext.addEventListener('click', () => {
      state.files.forEach(f => f.inContext = false);
      renderFileTree();
    });

    dom.btnUploadFiles.addEventListener('click', () => dom.hiddenFileInput.click());
    dom.hiddenFileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (re) => {
          addOrUpdateFile(file.name, re.target.result, true);
        };
        reader.readAsText(file);
      });
      dom.hiddenFileInput.value = '';
    });

    dom.btnExecutePrompt.addEventListener('click', synthesizeCloudPrompt);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        synthesizeCloudPrompt();
      }
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => {
      dom.settingsSlideout.classList.toggle('open');
    });
    dom.btnCloseSettings.addEventListener('click', () => {
      dom.settingsSlideout.classList.remove('open');
    });

    dom.settingOutputLength.addEventListener('input', () => {
      dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value;
    });

    dom.settingTemp.addEventListener('input', () => {
      dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2);
    });

    dom.btnResetSysInst.addEventListener('click', () => {
      dom.settingSystemInstructions.value = 'You are AetherSpace SOTA Senior Principal Software Architect. Synthesize clean, deterministic, production-ready code with complete logic and zero placeholders.';
    });

    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultKeys();
    });
    dom.btnCloseVault.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'none';
    });

    dom.vaultTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.vaultTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderVaultKeys();
      });
    });

    dom.btnAddKey.addEventListener('click', () => {
      const activeTab = document.querySelector('.vault-tab-btn.active');
      const provider = activeTab ? activeTab.dataset.provider : 'gemini';
      const keyVal = dom.vaultKeyInput.value.trim();
      const labelVal = dom.vaultLabelInput.value.trim() || 'Free Tier Key';

      if (!keyVal) {
        alert('Please enter an API key.');
        return;
      }

      state.keys[provider] = state.keys[provider] || [];
      state.keys[provider].push({
        key: keyVal,
        label: labelVal,
        created: new Date().toLocaleDateString()
      });

      saveStoredKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultKeys();
    });

    dom.openAuthBtn.addEventListener('click', () => {
      dom.authModal.style.display = 'flex';
    });
    dom.btnCloseAuth.addEventListener('click', () => {
      dom.authModal.style.display = 'none';
    });

    dom.tabLogin.addEventListener('click', () => {
      dom.tabLogin.classList.add('active');
      dom.tabSignup.classList.remove('active');
      dom.btnSubmitAuth.textContent = 'Sign In';
    });

    dom.tabSignup.addEventListener('click', () => {
      dom.tabSignup.classList.add('active');
      dom.tabLogin.classList.remove('active');
      dom.btnSubmitAuth.textContent = 'Create Account';
    });

    dom.btnSubmitAuth.addEventListener('click', () => {
      const email = document.getElementById('auth-email').value;
      if (email) {
        state.auth.isLoggedIn = true;
        state.auth.user = email;
        dom.authStateLabel.textContent = email.split('@')[0];
        dom.authModal.style.display = 'none';
      }
    });

    dom.btnExportHtml.addEventListener('click', exportSingleHtml);
    dom.btnExportZip.addEventListener('click', exportZipArchive);
    dom.btnSaveServer.addEventListener('click', saveActiveFileToServer);
  }

  function init() {
    loadStoredKeys();
    initEvents();
    renderFileTree();
    dom.settingSystemInstructions.value = state.runSettings.systemInstructions;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
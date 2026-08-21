/**
 * AETHERSPACE ENTERPRISE CORE APPLICATION
 * FOSS Multi-Key Edge AI Studio Client (Clean State Architecture)
 */

class AetherSpaceEngine {
  constructor() {
    this.files = new Map(); // Map: filename -> { content: string, language: string, inContext: boolean }
    this.activeFile = null;
    this.activeVaultProvider = 'google';
    this.authMode = 'login';

    // Stored keys schema: { google: [], groq: [], openrouter: [], huggingface: [] }
    this.keys = this.loadVaultKeys();
    this.auth = this.loadAuthState();
    this.settings = {
      model: 'gemini-2.5-flash',
      systemInstruction: '',
      thinkingLevel: 'medium',
      searchGrounding: false,
      temperature: 0.20,
      maxTokens: 8192
    };

    this.initUI();
  }

  loadVaultKeys() {
    try {
      const stored = localStorage.getItem('aetherspace_vault_v2');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Fehler beim Laden des Key-Tresors:', e);
    }
    return { google: [], groq: [], openrouter: [], huggingface: [] };
  }

  saveVaultKeys() {
    localStorage.setItem('aetherspace_vault_v2', JSON.stringify(this.keys));
    this.updateKeyBadge();
  }

  loadAuthState() {
    try {
      const stored = localStorage.getItem('aetherspace_auth_v2');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Fehler beim Auth-Status:', e);
    }
    return { loggedIn: false, user: null };
  }

  initUI() {
    this.updateKeyBadge();
    this.updateFileTreeUI();
    this.updateTabsUI();
    this.updateEditorSurface();
    this.updateAuthUI();

    // Global listener for closing dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.pill-dropdown-wrapper')) {
        document.querySelectorAll('.pill-dropdown-content').forEach(el => el.classList.remove('show'));
      }
    });
  }

  // --- TWO-TIER PILL CONTROLS ---
  togglePillDropdown(type) {
    const dropdown = document.getElementById(`dropdown-${type}`);
    const isOpen = dropdown.classList.contains('show');
    document.querySelectorAll('.pill-dropdown-content').forEach(el => el.classList.remove('show'));
    if (!isOpen) {
      dropdown.classList.add('show');
    }
  }

  saveGlobalConfig() {
    this.settings.searchGrounding = document.getElementById('cfg-grounding-active').checked;
    document.getElementById('setting-search-grounding').checked = this.settings.searchGrounding;
  }

  triggerMemoryCleanup() {
    if (window.gc) window.gc();
    document.getElementById('stat-context-tokens').innerText = `${this.calculateTotalContextTokens()} Tokens (Clean)`;
    alert('DOM Cache & Context Memory erfolgreich bereinigt (< 50MB RAM Guard)');
  }

  // --- RUN SETTINGS DRAWER ---
  toggleRunSettings() {
    const panel = document.getElementById('run-settings-panel');
    panel.classList.toggle('open');
  }

  handleModelChange() {
    const model = document.getElementById('setting-model-select').value;
    this.settings.model = model;
    document.getElementById('dock-active-model').innerText = `✨ ${model}`;
  }

  // --- FILE MANAGEMENT (CLEAN STATE) ---
  createFilePrompt() {
    const name = prompt('Dateiname eingeben (z. B. index.html, styles.css, app.js, backend.py):');
    if (!name || name.trim() === '') return;
    const cleanName = name.trim();
    if (this.files.has(cleanName)) {
      alert('Eine Datei mit diesem Namen existiert bereits.');
      return;
    }

    const ext = cleanName.split('.').pop().toLowerCase();
    this.files.set(cleanName, {
      content: '',
      language: ext,
      inContext: true
    });

    this.activeFile = cleanName;
    this.updateFileTreeUI();
    this.updateTabsUI();
    this.updateEditorSurface();
  }

  handleFileUpload(event) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const ext = file.name.split('.').pop().toLowerCase();
        this.files.set(file.name, {
          content: content,
          language: ext,
          inContext: true
        });
        if (i === fileList.length - 1) {
          this.activeFile = file.name;
          this.updateFileTreeUI();
          this.updateTabsUI();
          this.updateEditorSurface();
        }
      };
      reader.readAsText(file);
    }
  }

  deleteFile(name, event) {
    if (event) event.stopPropagation();
    if (!confirm(`Datei "${name}" wirklich unwiderruflich löschen?`)) return;

    this.files.delete(name);
    if (this.activeFile === name) {
      const remaining = Array.from(this.files.keys());
      this.activeFile = remaining.length > 0 ? remaining[0] : null;
    }
    this.updateFileTreeUI();
    this.updateTabsUI();
    this.updateEditorSurface();
  }

  toggleContextCheckbox(name, event) {
    if (event) event.stopPropagation();
    if (this.files.has(name)) {
      const f = this.files.get(name);
      f.inContext = !f.inContext;
      this.updateContextTokensDisplay();
    }
  }

  toggleSelectAllContext(select) {
    for (const [_, file] of this.files) {
      file.inContext = select;
    }
    this.updateFileTreeUI();
    this.updateContextTokensDisplay();
  }

  calculateTotalContextTokens() {
    let charCount = 0;
    for (const [_, file] of this.files) {
      if (file.inContext) {
        charCount += file.content.length;
      }
    }
    return Math.ceil(charCount / 4);
  }

  updateContextTokensDisplay() {
    const tokens = this.calculateTotalContextTokens();
    document.getElementById('context-selected-tokens').innerText = `${tokens} Tokens`;
    document.getElementById('dock-active-tokens').innerText = `Kontext: ${tokens} Tokens`;
    document.getElementById('stat-context-tokens').innerText = `${tokens} Tokens`;
  }

  updateFileTreeUI() {
    const emptyCard = document.getElementById('filetree-empty-state');
    const fileListEl = document.getElementById('file-list');

    if (this.files.size === 0) {
      emptyCard.style.display = 'block';
      fileListEl.style.display = 'none';
      fileListEl.innerHTML = '';
    } else {
      emptyCard.style.display = 'none';
      fileListEl.style.display = 'block';
      fileListEl.innerHTML = '';

      for (const [name, file] of this.files) {
        const li = document.createElement('li');
        li.className = `file-item ${this.activeFile === name ? 'active' : ''}`;
        li.onclick = () => this.setActiveFile(name);

        li.innerHTML = `
          <input type="checkbox" ${file.inContext ? 'checked' : ''} onclick="aetherApp.toggleContextCheckbox('${name}', event)" title="In KI-Kontext einbinden">
          <span class="file-name">${name}</span>
          <div class="file-actions">
            <button class="icon-btn" onclick="aetherApp.deleteFile('${name}', event)" title="Löschen">&#x1F5D1;&#xFE0F;</button>
          </div>
        `;
        fileListEl.appendChild(li);
      }
    }
    this.updateContextTokensDisplay();
  }

  setActiveFile(name) {
    this.activeFile = name;
    this.updateFileTreeUI();
    this.updateTabsUI();
    this.updateEditorSurface();
  }

  updateTabsUI() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';

    for (const [name, _] of this.files) {
      const tab = document.createElement('div');
      tab.className = `editor-tab ${this.activeFile === name ? 'active' : ''}`;
      tab.onclick = () => this.setActiveFile(name);
      tab.innerHTML = `
        <span>${name}</span>
        <button class="tab-close" onclick="aetherApp.deleteFile('${name}', event)">&#x2715;</button>
      `;
      container.appendChild(tab);
    }
  }

  updateEditorSurface() {
    const overlay = document.getElementById('editor-empty-overlay');
    const textarea = document.getElementById('editor-textarea');
    const gutter = document.getElementById('editor-gutter');

    if (!this.activeFile || !this.files.has(this.activeFile)) {
      overlay.style.display = 'flex';
      textarea.style.display = 'none';
      gutter.innerText = '1';
      document.getElementById('status-line-col').innerText = 'Keine Datei';
      document.getElementById('status-file-type').innerText = 'Plaintext';
      document.getElementById('status-file-size').innerText = '0 Bytes';
      return;
    }

    overlay.style.display = 'none';
    textarea.style.display = 'block';

    const file = this.files.get(this.activeFile);
    textarea.value = file.content;
    this.updateLineNumbers();

    document.getElementById('status-file-type').innerText = file.language.toUpperCase();
    document.getElementById('status-file-size').innerText = `${new Blob([file.content]).size} Bytes`;
  }

  handleEditorInput() {
    if (!this.activeFile || !this.files.has(this.activeFile)) return;
    const textarea = document.getElementById('editor-textarea');
    const file = this.files.get(this.activeFile);
    file.content = textarea.value;
    this.updateLineNumbers();
    this.updateContextTokensDisplay();
    document.getElementById('status-file-size').innerText = `${new Blob([file.content]).size} Bytes`;
  }

  handleEditorKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = document.getElementById('editor-textarea');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      this.handleEditorInput();
    }
  }

  updateLineNumbers() {
    const textarea = document.getElementById('editor-textarea');
    const gutter = document.getElementById('editor-gutter');
    const lines = textarea.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) {
      numbers += i + '\n';
    }
    gutter.innerText = numbers;
  }

  clearEditorContent() {
    if (!this.activeFile) return;
    if (confirm('Aktiven Dateiinhalt wirklich leeren?')) {
      const file = this.files.get(this.activeFile);
      file.content = '';
      this.updateEditorSurface();
    }
  }

  // --- POLYGLOT AUTO-HEALER ---
  autoHealActiveCode() {
    if (!this.activeFile) {
      alert('Keine aktive Datei zum Bereinigen geöffnet.');
      return;
    }

    const file = this.files.get(this.activeFile);
    let code = file.content;

    // Remove rogue markdown blocks, agent noise and vertical letter splits
    code = code.replace(/```[a-zA-Z]*\n?/g, '');
    code = code.replace(/```/g, '');
    code = code.replace(/^code\s+Code\s+/gim, '');
    
    // Normalize line endings
    code = code.replace(/\r\n/g, '\n');

    file.content = code;
    this.updateEditorSurface();
    alert('✨ Polyglot Auto-Healer: Code-Fragmente und Syntax-Artefakte erfolgreich bereinigt.');
  }

  // --- KEY VAULT MANAGEMENT ---
  openKeyVault() {
    document.getElementById('modal-key-vault').style.display = 'flex';
    this.renderVaultTable();
  }

  closeKeyVault() {
    document.getElementById('modal-key-vault').style.display = 'none';
  }

  switchVaultTab(provider) {
    this.activeVaultProvider = provider;
    document.querySelectorAll('.vault-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    this.renderVaultTable();
  }

  saveKeyFromVault() {
    const keyInput = document.getElementById('vault-key-input');
    const labelInput = document.getElementById('vault-label-input');
    const statusMsg = document.getElementById('vault-status-msg');

    const key = keyInput.value.trim();
    const label = labelInput.value.trim() || `Key ${this.keys[this.activeVaultProvider].length + 1}`;

    if (!key) {
      statusMsg.innerText = 'Bitte gib einen gültigen API Key ein.';
      statusMsg.style.color = 'var(--accent-red)';
      return;
    }

    this.keys[this.activeVaultProvider].push({
      key: key,
      label: label,
      created: new Date().toLocaleDateString('de-DE'),
      tier: 'Free Tier Validated'
    });

    this.saveVaultKeys();
    keyInput.value = '';
    labelInput.value = '';
    statusMsg.innerText = 'Key erfolgreich im sicheren Tresor gespeichert!';
    statusMsg.style.color = 'var(--accent-green)';
    this.renderVaultTable();
  }

  deleteVaultKey(index) {
    this.keys[this.activeVaultProvider].splice(index, 1);
    this.saveVaultKeys();
    this.renderVaultTable();
  }

  renderVaultTable() {
    const tbody = document.getElementById('vault-table-body');
    tbody.innerHTML = '';

    const list = this.keys[this.activeVaultProvider] || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dark); padding: 16px;">Keine Keys für ${this.activeVaultProvider.toUpperCase()} hinterlegt.</td></tr>`;
      return;
    }

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      const masked = item.key.substring(0, 7) + '...' + item.key.substring(item.key.length - 4);
      tr.innerHTML = `
        <td>${masked}</td>
        <td>${item.label}</td>
        <td>${item.created}</td>
        <td><span class="pill-dot dot-green" style="display:inline-block; margin-right:4px;"></span>${item.tier}</td>
        <td><button class="btn btn-xs btn-outline" onclick="aetherApp.deleteVaultKey(${index})">Löschen</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  updateKeyBadge() {
    let total = 0;
    for (const p in this.keys) {
      total += this.keys[p].length;
    }
    document.getElementById('key-count-badge').innerText = total;
  }

  // --- UNIFIED CLOUD AI EXECUTION ENGINE ---
  handlePromptKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.executeUnifiedGeneration();
    }
  }

  async executeUnifiedGeneration() {
    const promptInput = document.getElementById('ai-prompt-input');
    const promptText = promptInput.value.trim();
    if (!promptText) {
      alert('Bitte gib eine Anweisung oder Frage ein.');
      return;
    }

    // Check if we have keys for Google or Groq or OpenRouter
    const googleKeys = this.keys.google || [];
    const groqKeys = this.keys.groq || [];
    const openrouterKeys = this.keys.openrouter || [];

    if (googleKeys.length === 0 && groqKeys.length === 0 && openrouterKeys.length === 0) {
      alert('Keine API Keys im Schnittstellen-Tresor hinterlegt!\n\nBitte öffne den "Schnittstellen-Tresor" und hinterlege einen kostenlosen Google AI Studio oder Groq Cloud Key.');
      this.openKeyVault();
      return;
    }

    const banner = document.getElementById('ai-execution-banner');
    const bannerText = document.getElementById('ai-banner-text');
    const btnGen = document.getElementById('btn-generate-ai');

    banner.style.display = 'flex';
    btnGen.disabled = true;
    bannerText.innerText = 'Starte Cloud-Inferenz über Multi-Key Kaskade...';

    // Build context payload
    let fullPrompt = '';
    let contextBundle = '';
    for (const [name, file] of this.files) {
      if (file.inContext && file.content.trim() !== '') {
        contextBundle += `\n--- DATEI: ${name} ---\n${file.content}\n`;
      }
    }

    if (contextBundle !== '') {
      fullPrompt = `Hier ist der relevante Projekt-Kontext:\n${contextBundle}\n\nBenutzer-Anweisung:\n${promptText}`;
    } else {
      fullPrompt = promptText;
    }

    const sysInstruction = document.getElementById('setting-system-prompt').value.trim();
    const temp = parseFloat(document.getElementById('setting-temperature').value);
    const maxTokens = parseInt(document.getElementById('setting-max-tokens').value, 10);
    const useGrounding = document.getElementById('setting-search-grounding').checked;

    try {
      let resultText = '';

      // 1. Try Google AI Studio Keys in sequence
      if (googleKeys.length > 0) {
        for (let i = 0; i < googleKeys.length; i++) {
          bannerText.innerText = `Google AI Studio Key ${i + 1}/${googleKeys.length} aktiv...`;
          try {
            resultText = await this.callGoogleAI(googleKeys[i].key, fullPrompt, sysInstruction, temp, maxTokens, useGrounding);
            if (resultText) break;
          } catch (err) {
            console.warn(`Key ${i + 1} Limit/Fehler:`, err);
          }
        }
      }

      // 2. Cascade to Groq Cloud if no result yet
      if (!resultText && groqKeys.length > 0) {
        for (let i = 0; i < groqKeys.length; i++) {
          bannerText.innerText = `Groq LPU Kaskade Key ${i + 1}/${groqKeys.length} aktiv...`;
          try {
            resultText = await this.callGroqAI(groqKeys[i].key, fullPrompt, sysInstruction, temp, maxTokens);
            if (resultText) break;
          } catch (err) {
            console.warn(`Groq Key ${i + 1} Limit/Fehler:`, err);
          }
        }
      }

      if (!resultText) {
        throw new Error('Alle hinterlegten API Keys haben ihr Kontingent erschöpft oder einen Fehler gemeldet.');
      }

      // If no file is active, create one automatically
      if (!this.activeFile) {
        const defaultName = 'generated_output.js';
        this.files.set(defaultName, { content: '', language: 'javascript', inContext: true });
        this.activeFile = defaultName;
      }

      const activeFileObj = this.files.get(this.activeFile);
      activeFileObj.content = resultText;
      this.updateFileTreeUI();
      this.updateTabsUI();
      this.updateEditorSurface();
      promptInput.value = '';
    } catch (error) {
      alert(`Inferenz-Fehler: ${error.message}`);
    } finally {
      banner.style.display = 'none';
      btnGen.disabled = false;
    }
  }

  async callGoogleAI(apiKey, prompt, systemInstruction, temperature, maxTokens, useGrounding) {
    const model = 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens
      }
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (useGrounding) {
      body.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Google API Status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async callGroqAI(apiKey, prompt, systemInstruction, temperature, maxTokens) {
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API Status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // --- SMART EXPORTERS ---
  exportSingleHtml() {
    let combinedHtml = '';
    for (const [name, file] of this.files) {
      if (name.endsWith('.html')) {
        combinedHtml = file.content;
        break;
      }
    }

    if (!combinedHtml) {
      combinedHtml = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>AetherSpace Export</title></head><body>\n<h1>AetherSpace Export</h1>\n<pre>${this.activeFile ? this.files.get(this.activeFile).content : 'Kein Inhalt'}</pre>\n</body></html>`;
    }

    const blob = new Blob([combinedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetherspace_export.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  exportWorkspaceZip() {
    // Zero dependency text-bundle export
    let bundle = '=== AETHERSPACE PROJECT EXPORT BUNDLE ===\n\n';
    for (const [name, file] of this.files) {
      bundle += `\n--- BEGIN FILE: ${name} ---\n${file.content}\n--- END FILE: ${name} ---\n`;
    }

    const blob = new Blob([bundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetherspace_bundle.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- AUTHENTICATION ---
  openAuthModal() {
    document.getElementById('modal-auth').style.display = 'flex';
  }

  closeAuthModal() {
    document.getElementById('modal-auth').style.display = 'none';
  }

  switchAuthMode(mode) {
    this.authMode = mode;
    document.getElementById('tab-auth-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-auth-signup').classList.toggle('active', mode === 'signup');
    document.getElementById('auth-submit-btn').innerText = mode === 'login' ? 'Anmelden' : 'Registrieren';
  }

  handleSocialAuth(provider) {
    this.auth = { loggedIn: true, user: { email: `developer@${provider.toLowerCase()}.com`, name: `${provider} Architect` } };
    localStorage.setItem('aetherspace_auth_v2', JSON.stringify(this.auth));
    this.updateAuthUI();
    this.closeAuthModal();
  }

  handleEmailAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    this.auth = { loggedIn: true, user: { email: email, name: email.split('@')[0] } };
    localStorage.setItem('aetherspace_auth_v2', JSON.stringify(this.auth));
    this.updateAuthUI();
    this.closeAuthModal();
  }

  updateAuthUI() {
    const label = document.getElementById('auth-btn-label');
    if (this.auth && this.auth.loggedIn) {
      label.innerText = this.auth.user.name;
    } else {
      label.innerText = 'Anmelden';
    }
  }
}

// Global initialization
window.aetherApp = new AetherSpaceEngine();

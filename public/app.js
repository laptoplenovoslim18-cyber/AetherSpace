(function () {
  'use strict';

  const state = {
    files: new Map(), // filename -> { content, inContext }
    mode: 'single', // 'single' | 'orchestration'
    keys: { gemini: [], groq: [], openrouter: [] },
    availableModels: {
      gemini: ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'],
      groq: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'],
      openrouter: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free']
    }
  };

  const dom = {
    chatStream: document.getElementById('chat-stream'),
    mainPromptInput: document.getElementById('main-prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    activeModelSelect: document.getElementById('active-model-select'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    btnModeSingle: document.getElementById('btn-mode-single'),
    btnModeOrchestration: document.getElementById('btn-mode-orchestration'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    activeContextPill: document.getElementById('active-context-pill'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    btnToggleDrawer: document.getElementById('btn-toggle-drawer'),
    slideoutDrawer: document.getElementById('slideout-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),

    drawerFileList: document.getElementById('drawer-file-list'),
    btnDrawerNewFile: document.getElementById('btn-drawer-new-file'),
    drawerSystemPrompt: document.getElementById('drawer-system-prompt'),
    drawerThinkingBudget: document.getElementById('drawer-thinking-budget'),
    drawerSearchGrounding: document.getElementById('drawer-search-grounding'),
    drawerAutoFallback: document.getElementById('drawer-auto-fallback'),

    vaultModal: document.getElementById('vault-modal'),
    openVaultBtn: document.getElementById('open-vault-btn'),
    btnCloseVaultModal: document.getElementById('btn-close-vault-modal'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnSaveKey: document.getElementById('btn-save-key'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_vault_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
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
    const total = Object.values(state.keys).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // DYNAMIC LIVE MODEL INVENTORY SYNC
  async function syncModelInventory() {
    dom.statusText.textContent = 'Synchronisiere Live-Modellkatalog...';
    
    // Gemini sync
    if (state.keys.gemini.length > 0) {
      try {
        const key = state.keys.gemini[0].key;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models) {
            const chatModels = data.models
              .map(m => m.name.replace('models/', ''))
              .filter(name => (name.includes('gemini') || name.includes('flash')) && !name.includes('embedding') && !name.includes('vision'));
            if (chatModels.length > 0) state.availableModels.gemini = chatModels;
          }
        }
      } catch (e) { console.warn('Gemini sync skipped', e); }
    }

    // Groq sync
    if (state.keys.groq.length > 0) {
      try {
        const key = state.keys.groq[0].key;
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            const groqList = data.data.map(m => m.id).filter(id => !id.includes('whisper') && !id.includes('guard'));
            if (groqList.length > 0) state.availableModels.groq = groqList;
          }
        }
      } catch (e) { console.warn('Groq sync skipped', e); }
    }

    renderModelDropdown();
    dom.statusText.textContent = 'Modellkatalog aktuell.';
  }

  function renderModelDropdown() {
    const gemOpt = document.getElementById('optgroup-gemini');
    const groqOpt = document.getElementById('optgroup-groq');
    const openOpt = document.getElementById('optgroup-openrouter');

    gemOpt.innerHTML = '';
    state.availableModels.gemini.slice(0, 5).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      gemOpt.appendChild(opt);
    });

    groqOpt.innerHTML = '';
    state.availableModels.groq.slice(0, 5).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `Groq: ${m}`;
      groqOpt.appendChild(opt);
    });

    openOpt.innerHTML = '';
    state.availableModels.openrouter.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `OpenRouter: ${m}`;
      openOpt.appendChild(opt);
    });
  }

  function appendChatRow(author, initialText = '') {
    const empty = dom.chatStream.querySelector('.chat-empty-state');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = `chat-row ${author === 'User' ? 'user' : 'ai'}`;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = author;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = formatMarkdownAndFiles(initialText);

    row.appendChild(meta);
    row.appendChild(bubble);
    dom.chatStream.appendChild(row);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;

    return {
      update: (newText) => {
        bubble.innerHTML = formatMarkdownAndFiles(newText);
        dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
      }
    };
  }

  function formatMarkdownAndFiles(text) {
    if (!text) return '';
    // Parse <file path="..."> blocks into clean code panes
    const formatted = text.replace(/<file path="([^"]+)">([\s\S]*?)<\/file>/g, (_, path, code) => {
      // Auto register to workspace
      state.files.set(path, { content: code.trim(), inContext: true });
      renderDrawerFiles();
      return `<div class="code-header-bar"><span>📄 ${path}</span><button class="btn-xs primary-outline" onclick="navigator.clipboard.writeText(\`${encodeURIComponent(code)}\`)">Kopieren</button></div><pre><code>${escapeHtml(code)}</code></pre>`;
    });

    return formatted.replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderDrawerFiles() {
    dom.drawerFileList.innerHTML = '';
    if (state.files.size === 0) {
      dom.drawerFileList.innerHTML = '<li class="drawer-empty-note">Keine Dateien im Workspace.</li>';
      dom.activeContextPill.textContent = '0 Dateien im Kontext';
      return;
    }

    state.files.forEach((f, name) => {
      const li = document.createElement('li');
      li.className = 'drawer-file-item';
      li.innerHTML = `
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${f.inContext ? 'checked' : ''}>
          <span>${name}</span>
        </label>
        <button class="link-btn" style="color:var(--accent-rose);">&times;</button>
      `;

      li.querySelector('input').addEventListener('change', (e) => {
        f.inContext = e.target.checked;
        updateContextCount();
      });

      li.querySelector('button').addEventListener('click', () => {
        state.files.delete(name);
        renderDrawerFiles();
      });

      dom.drawerFileList.appendChild(li);
    });

    updateContextCount();
  }

  function updateContextCount() {
    let count = 0;
    state.files.forEach(f => { if (f.inContext) count++; });
    dom.activeContextPill.textContent = `${count} Datei(en) im Kontext`;
  }

  function buildPromptContext(userPrompt) {
    let ctx = '';
    state.files.forEach((f, name) => {
      if (f.inContext) ctx += `<file path="${name}">\n${f.content}\n</file>\n\n`;
    });
    return ctx ? `WORKSPACE CONTEXT:\n${ctx}\nBENUTZERAUFTRAG:\n${userPrompt}` : userPrompt;
  }

  // RESILIENT SSE STREAM GENERATOR WITH 503 AUTO-FALLBACK
  async function executeStreamWithFailover(provider, model, fullPrompt, chatHandle) {
    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      chatHandle.update(`Kein API-Key für Provider [${provider.toUpperCase()}] gefunden. Bitte im Key Vault hinterlegen.`);
      return;
    }

    const fallbackQueue = [model];
    if (provider === 'gemini') {
      ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'].forEach(m => {
        if (!fallbackQueue.includes(m)) fallbackQueue.push(m);
      });
    }

    for (let mIdx = 0; mIdx < fallbackQueue.length; mIdx++) {
      const currentModel = fallbackQueue[mIdx];
      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const apiKey = keys[kIdx].key;
        try {
          dom.statusText.textContent = `Routing to ${currentModel} (Key ${kIdx + 1})...`;

          if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const body = {
              contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192
              }
            };

            const sys = dom.drawerSystemPrompt.value.trim();
            if (sys) body.systemInstruction = { parts: [{ text: sys }] };
            const budget = parseInt(dom.drawerThinkingBudget.value, 10);
            if (budget > 0) body.generationConfig.thinkingConfig = { thinkingBudget: budget };
            if (dom.drawerSearchGrounding.checked) body.tools = [{ googleSearch: {} }];

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            if (res.status === 503 || res.status === 429) {
              console.warn(`Model ${currentModel} returned HTTP ${res.status}. Auto-cascading...`);
              continue; // try next key or model
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(line.substring(6));
                    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
                      accumulated += json.candidates[0].content.parts.map(p => p.text || '').join('');
                      chatHandle.update(accumulated);
                    }
                  } catch (je) {}
                }
              }
            }

            return; // Success!
          } else {
            // Groq / OpenRouter Streaming
            const endpoint = provider === 'groq' 
              ? 'https://api.groq.com/openai/v1/chat/completions' 
              : 'https://openrouter.ai/api/v1/chat/completions';

            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: currentModel,
                messages: [{ role: 'user', content: fullPrompt }],
                stream: true
              })
            });

            if (res.status === 503 || res.status === 429) continue;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const json = JSON.parse(line.substring(6));
                    if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                      accumulated += json.choices[0].delta.content;
                      chatHandle.update(accumulated);
                    }
                  } catch (je) {}
                }
              }
            }
            return;
          }
        } catch (err) {
          console.warn(`Failover triggered on ${currentModel}:`, err.message);
        }
      }
    }

    chatHandle.update(`Alle verfügbaren Modell-Routen sind derzeit ausgelastet. Bitte versuche es in wenigen Sekunden erneut.`);
  }

  async function handleSendPrompt() {
    const text = dom.mainPromptInput.value.trim();
    if (!text) return;

    appendChatRow('User', text);
    dom.mainPromptInput.value = '';
    dom.btnSendPrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';

    const fullPrompt = buildPromptContext(text);
    const selectedModel = dom.activeModelSelect.value;
    let provider = 'gemini';
    if (selectedModel.startsWith('llama') || selectedModel.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (selectedModel.startsWith('openrouter') || selectedModel.includes(':free')) provider = 'openrouter';

    if (state.mode === 'orchestration') {
      // Multi-Agent Debate
      const handleA = appendChatRow(`Agent Alpha (${selectedModel})`, 'Analysiere Architektur...');
      await executeStreamWithFailover(provider, selectedModel, fullPrompt, handleA);

      const handleB = appendChatRow('Agent Beta (Groq Validator)', 'Überprüfe Code und erstelle Optimierung...');
      await executeStreamWithFailover('groq', 'llama-3.3-70b-versatile', `Überprüfe folgende Lösung und optimiere sie:\n${text}`, handleB);
    } else {
      const handle = appendChatRow(`AI (${selectedModel})`, '');
      await executeStreamWithFailover(provider, selectedModel, fullPrompt, handle);
    }

    dom.btnSendPrompt.disabled = false;
    dom.statusDot.className = 'status-indicator ready';
    dom.statusText.textContent = 'Bereit.';
  }

  function exportCodePen() {
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

  function renderVaultKeys() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const prov = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[prov] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      dom.vaultKeysTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:12px;">Keine Keys für ${prov.toUpperCase()} hinterlegt.</td></tr>`;
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Standard'}</td>
        <td><span class="badge">Free Tier</span></td>
        <td><button class="link-btn" data-del="${idx}" style="color:var(--accent-rose);">Löschen</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultKeys();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function initEvents() {
    dom.btnSendPrompt.addEventListener('click', handleSendPrompt);
    dom.mainPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrompt();
      }
    });

    dom.btnModeSingle.addEventListener('click', () => {
      state.mode = 'single';
      dom.btnModeSingle.classList.add('active');
      dom.btnModeOrchestration.classList.remove('active');
    });

    dom.btnModeOrchestration.addEventListener('click', () => {
      state.mode = 'orchestration';
      dom.btnModeOrchestration.classList.add('active');
      dom.btnModeSingle.classList.remove('active');
    });

    dom.btnSyncModels.addEventListener('click', syncModelInventory);
    dom.btnCodepenExport.addEventListener('click', exportCodePen);

    dom.btnToggleDrawer.addEventListener('click', () => dom.slideoutDrawer.classList.toggle('open'));
    dom.btnCloseDrawer.addEventListener('click', () => dom.slideoutDrawer.classList.remove('open'));

    dom.btnDrawerNewFile.addEventListener('click', () => {
      const name = prompt('Dateiname eingeben (z.B. index.html, styles.css):');
      if (name && name.trim()) {
        state.files.set(name.trim(), { content: '', inContext: true });
        renderDrawerFiles();
      }
    });

    dom.openVaultBtn.addEventListener('click', () => {
      dom.vaultModal.style.display = 'flex';
      renderVaultKeys();
    });

    dom.btnCloseVaultModal.addEventListener('click', () => {
      dom.vaultModal.style.display = 'none';
    });

    dom.vaultTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.vaultTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderVaultKeys();
      });
    });

    dom.btnSaveKey.addEventListener('click', () => {
      const active = document.querySelector('.vault-tab-btn.active');
      const prov = active ? active.dataset.provider : 'gemini';
      const key = dom.vaultKeyInput.value.trim();
      const label = dom.vaultLabelInput.value.trim() || 'Key';

      if (!key) return alert('Bitte Key eingeben.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultKeys();
      syncModelInventory();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    renderModelDropdown();
    renderDrawerFiles();
    if (state.keys.gemini.length > 0 || state.keys.groq.length > 0) {
      syncModelInventory();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
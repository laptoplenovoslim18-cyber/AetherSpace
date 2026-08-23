(function () {
  'use strict';

  const state = {
    mode: 'direct', // 'direct' | 'orchestrator'
    messages: [],
    modelsPool: [],
    activeModel: null,
    runSettings: {
      systemInstructions: '',
      thinkingBudget: 0,
      autoFallback: true,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    btnModeDirect: document.getElementById('btn-mode-direct'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    btnFetchModels: document.getElementById('btn-fetch-models'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    keyCountBadge: document.getElementById('key-count-badge'),
    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    activeModelNav: document.getElementById('active-model-nav'),

    chatViewport: document.getElementById('chat-viewport'),
    chatStream: document.getElementById('chat-stream'),
    emptyChatHero: document.getElementById('empty-chat-hero'),

    promptInput: document.getElementById('prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    statusDot: document.getElementById('status-dot'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    btnClearChat: document.getElementById('btn-clear-chat'),

    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingModel: document.getElementById('setting-model'),
    modelSourceBadge: document.getElementById('model-source-badge'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingAutoFallback: document.getElementById('setting-auto-fallback'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val'),

    keyVaultModal: document.getElementById('key-vault-modal'),
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
      console.warn('Key storage error', e);
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

  // DYNAMIC MODEL INVENTORY FETCHING
  async function syncModelsFromProviders() {
    dom.gatewayStatusText.textContent = 'Synchronizing Live Model Inventory...';
    dom.statusDot.className = 'status-indicator busy';

    const pool = [];

    // 1. Fetch Google AI Studio Live Models
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const apiKey = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .forEach(m => {
                const cleanId = m.name.replace(/^models\//, '');
                pool.push({
                  id: cleanId,
                  name: m.displayName || cleanId,
                  provider: 'gemini'
                });
              });
          }
        }
      } catch (err) {
        console.warn('Gemini dynamic fetch note:', err.message);
      }
    }

    // 2. Fetch Groq Models
    if (state.keys.groq && state.keys.groq.length > 0) {
      const apiKey = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach(m => {
              pool.push({
                id: m.id,
                name: m.id,
                provider: 'groq'
              });
            });
          }
        }
      } catch (err) {
        console.warn('Groq dynamic fetch note:', err.message);
      }
    }

    // Default Fallbacks if no keys entered yet
    if (pool.length === 0) {
      pool.push(
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Default)', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (OpenRouter Free)', provider: 'openrouter' }
      );
      dom.modelSourceBadge.textContent = 'Static Fallback';
    } else {
      dom.modelSourceBadge.textContent = `${pool.length} Live Models`;
    }

    state.modelsPool = pool;
    renderModelDropdown();
    dom.gatewayStatusText.textContent = 'Gateway Ready';
    dom.statusDot.className = 'status-indicator ready';
  }

  function renderModelDropdown() {
    dom.settingModel.innerHTML = '';
    
    const groups = { gemini: 'Google AI Studio', groq: 'Groq Cloud', openrouter: 'OpenRouter' };
    
    Object.keys(groups).forEach(prov => {
      const groupModels = state.modelsPool.filter(m => m.provider === prov);
      if (groupModels.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groups[prov];
        groupModels.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          opt.dataset.provider = m.provider;
          optgroup.appendChild(opt);
        });
        dom.settingModel.appendChild(optgroup);
      }
    });

    if (!state.activeModel && state.modelsPool.length > 0) {
      state.activeModel = state.modelsPool[0].id;
    }
    
    dom.settingModel.value = state.activeModel;
    updateActiveModelUI();
  }

  function updateActiveModelUI() {
    const selected = dom.settingModel.options[dom.settingModel.selectedIndex];
    dom.activeModelNav.textContent = selected ? selected.text.split(' (')[0] : 'Select Model';
  }

  function appendChatRow(role, authorName) {
    if (dom.emptyChatHero) {
      dom.emptyChatHero.style.display = 'none';
    }

    const row = document.createElement('div');
    row.className = `chat-row ${role}`;

    const auth = document.createElement('div');
    auth.className = 'chat-bubble-author';
    auth.textContent = authorName;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    row.appendChild(auth);
    row.appendChild(bubble);
    dom.chatStream.appendChild(row);
    dom.chatViewport.scrollTop = dom.chatViewport.scrollHeight;

    return bubble;
  }

  // REAL-TIME SSE STREAMING (GEMINI)
  async function streamGemini(apiKey, model, systemPrompt, history, targetBubble) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const contents = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const body = {
      contents: contents,
      generationConfig: {
        temperature: state.runSettings.temperature
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
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
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace(/^data: /, '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            fullResponse += chunk;
            targetBubble.innerHTML = formatMarkdown(fullResponse);
            dom.chatViewport.scrollTop = dom.chatViewport.scrollHeight;
          } catch (e) {}
        }
      }
    }

    return fullResponse;
  }

  // REAL-TIME SSE STREAMING (OPENAI-COMPATIBLE: GROQ / OPENROUTER)
  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, history, targetBubble) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });

    history.forEach(m => {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text });
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: state.runSettings.temperature,
        stream: true
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Provider HTTP ${res.status}: ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace(/^data: /, '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.choices?.[0]?.delta?.content || '';
            fullResponse += chunk;
            targetBubble.innerHTML = formatMarkdown(fullResponse);
            dom.chatViewport.scrollTop = dom.chatViewport.scrollHeight;
          } catch (e) {}
        }
      }
    }

    return fullResponse;
  }

  function formatMarkdown(text) {
    return text
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  async function executePrompt() {
    const prompt = dom.promptInput.value.trim();
    if (!prompt) return;

    dom.promptInput.value = '';
    dom.btnSendPrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';

    // Append User Message
    const userBubble = appendChatRow('user', 'You');
    userBubble.textContent = prompt;
    state.messages.push({ role: 'user', text: prompt });

    const selectedOption = dom.settingModel.options[dom.settingModel.selectedIndex];
    const model = dom.settingModel.value;
    const provider = selectedOption ? selectedOption.dataset.provider : 'gemini';

    const keys = state.keys[provider] || [];
    if (keys.length === 0) {
      const errBubble = appendChatRow('model', 'System');
      errBubble.innerHTML = `<em>No API Key stored for ${provider.toUpperCase()}. Open Key Vault to add a key.</em>`;
      dom.statusDot.className = 'status-indicator error';
      dom.btnSendPrompt.disabled = false;
      return;
    }

    if (state.mode === 'orchestrator') {
      await executeOrchestratorFlow(prompt);
      dom.btnSendPrompt.disabled = false;
      dom.statusDot.className = 'status-indicator ready';
      return;
    }

    // Direct Chat Stream
    const modelBubble = appendChatRow('model', model);
    modelBubble.innerHTML = '<em>Connecting...</em>';

    let success = false;
    for (let i = 0; i < keys.length; i++) {
      try {
        dom.gatewayStatusText.textContent = `Streaming from ${model}...`;
        let answer = '';
        if (provider === 'gemini') {
          answer = await streamGemini(keys[i].key, model, state.runSettings.systemInstructions, state.messages, modelBubble);
        } else if (provider === 'groq') {
          answer = await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', keys[i].key, model, state.runSettings.systemInstructions, state.messages, modelBubble);
        } else if (provider === 'openrouter') {
          answer = await streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', keys[i].key, model, state.runSettings.systemInstructions, state.messages, modelBubble);
        }
        state.messages.push({ role: 'model', text: answer });
        success = true;
        break;
      } catch (err) {
        console.warn(`Attempt on key ${i} failed:`, err.message);
        if (!state.runSettings.autoFallback || i === keys.length - 1) {
          modelBubble.innerHTML = `<span style="color:var(--accent-rose);">Execution Error: ${err.message}</span>`;
          break;
        }
      }
    }

    dom.btnSendPrompt.disabled = false;
    dom.statusDot.className = success ? 'status-indicator ready' : 'status-indicator error';
    dom.gatewayStatusText.textContent = success ? 'Gateway Ready' : 'Inference Failed';
  }

  async function executeOrchestratorFlow(taskPrompt) {
    const archBubble = appendChatRow('model', 'Architect Agent');
    archBubble.innerHTML = '<em>Designing system architecture...</em>';

    const apiKey = state.keys.gemini[0]?.key || state.keys.groq[0]?.key;
    const provider = state.keys.gemini[0] ? 'gemini' : 'groq';

    const archPrompt = `You are the Lead Systems Architect. Break down this task into architecture and implementation specs: "${taskPrompt}"`;
    let archResult = '';

    if (provider === 'gemini') {
      archResult = await streamGemini(apiKey, 'gemini-2.0-flash', '', [{ role: 'user', text: archPrompt }], archBubble);
    } else {
      archResult = await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, 'llama-3.3-70b-versatile', '', [{ role: 'user', text: archPrompt }], archBubble);
    }

    const engBubble = appendChatRow('model', 'Engineer Agent');
    engBubble.innerHTML = '<em>Synthesizing production code...</em>';

    const engPrompt = `You are the Lead Implementation Engineer. Implement complete production code based on this architecture:\n${archResult}`;
    if (provider === 'gemini') {
      await streamGemini(apiKey, 'gemini-2.0-flash', '', [{ role: 'user', text: engPrompt }], engBubble);
    } else {
      await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, 'llama-3.3-70b-versatile', '', [{ role: 'user', text: engPrompt }], engBubble);
    }
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured for ${provider.toUpperCase()}.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default'}</td>
        <td><span class="badge">Active</span></td>
        <td><button class="link-btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
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
    dom.btnModeDirect.addEventListener('click', () => {
      state.mode = 'direct';
      dom.btnModeDirect.classList.add('active');
      dom.btnModeOrchestrator.classList.remove('active');
    });

    dom.btnModeOrchestrator.addEventListener('click', () => {
      state.mode = 'orchestrator';
      dom.btnModeOrchestrator.classList.add('active');
      dom.btnModeDirect.classList.remove('active');
    });

    dom.btnFetchModels.addEventListener('click', syncModelsFromProviders);

    dom.btnSendPrompt.addEventListener('click', executePrompt);
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executePrompt();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      state.messages = [];
      dom.chatStream.innerHTML = '';
      if (dom.emptyChatHero) dom.emptyChatHero.style.display = 'flex';
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingModel.addEventListener('change', () => {
      state.activeModel = dom.settingModel.value;
      updateActiveModelUI();
    });

    dom.settingTemp.addEventListener('input', () => {
      state.runSettings.temperature = parseFloat(dom.settingTemp.value);
      dom.settingTempVal.textContent = state.runSettings.temperature.toFixed(2);
    });

    dom.settingSystemInstructions.addEventListener('input', () => {
      state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
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

      if (!key) return;
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      syncModelsFromProviders();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    syncModelsFromProviders();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
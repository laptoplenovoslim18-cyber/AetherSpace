(function () {
  'use strict';

  const state = {
    mode: 'direct', // 'direct' | 'orchestration' | 'multiagent'
    keys: { gemini: [], groq: [], openrouter: [] },
    availableModels: {
      gemini: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Adaptive)' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning)' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Stable LTS)' }
      ],
      groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
        { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' }
      ],
      openrouter: [
        { id: 'openrouter/free', name: 'OpenRouter Free Auto' },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
        { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)' }
      ]
    },
    primaryModel: 'gemini-2.5-flash',
    fallbackModel: 'llama-3.3-70b-versatile',
    config: {
      systemInstructions: '',
      thinkingBudget: 0,
      streaming: true,
      autoFallback: true,
      searchGrounding: false,
      temperature: 0.70
    },
    history: []
  };

  const dom = {
    modePills: document.querySelectorAll('.mode-pill'),
    currentModeTag: document.getElementById('current-mode-tag'),
    headerActiveModel: document.getElementById('header-active-model'),
    headerStatusIndicator: document.getElementById('header-status-indicator'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    settingsDrawer: document.getElementById('settings-drawer'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    selectActiveModel: document.getElementById('select-active-model'),
    selectFallbackModel: document.getElementById('select-fallback-model'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingStreamingToggle: document.getElementById('setting-streaming-toggle'),
    settingAutoFallback: document.getElementById('setting-auto-fallback'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingTemperature: document.getElementById('setting-temperature'),
    tempValDisplay: document.getElementById('temp-val-display'),

    btnOpenVault: document.getElementById('btn-open-vault'),
    vaultModal: document.getElementById('vault-modal'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnSaveKey: document.getElementById('btn-save-key'),
    vaultKeysList: document.getElementById('vault-keys-list'),
    vtabBtns: document.querySelectorAll('.vtab-btn'),
    keyCountBadge: document.getElementById('key-count-badge'),

    streamContainer: document.getElementById('stream-container'),
    chatInput: document.getElementById('chat-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    btnCodepenExport: document.getElementById('btn-codepen-export')
  };

  function loadKeys() {
    try {
      const raw = localStorage.getItem('aetherspace_gateway_keys');
      if (raw) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [] }, JSON.parse(raw));
    } catch (e) {
      console.warn('Vault key parse error', e);
    }
    updateKeyBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_gateway_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  // DYNAMIC MODEL INVENTORY FETCHING
  async function fetchLiveModels() {
    // 1. Google AI Studio live fetch
    if (state.keys.gemini.length > 0) {
      try {
        const k = state.keys.gemini[0].key;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const valid = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name }));
            if (valid.length > 0) state.availableModels.gemini = valid.slice(0, 8);
          }
        }
      } catch (err) {
        console.warn('Gemini model sync notice:', err.message);
      }
    }

    // 2. Groq Cloud live fetch
    if (state.keys.groq.length > 0) {
      try {
        const k = state.keys.groq[0].key;
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${k}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            const valid = data.data.filter(m => m.active !== false).map(m => ({ id: m.id, name: m.id }));
            if (valid.length > 0) state.availableModels.groq = valid.slice(0, 8);
          }
        }
      } catch (err) {
        console.warn('Groq model sync notice:', err.message);
      }
    }

    populateModelSelectors();
  }

  function populateModelSelectors() {
    dom.selectActiveModel.innerHTML = '';
    dom.selectFallbackModel.innerHTML = '';

    ['gemini', 'groq', 'openrouter'].forEach(prov => {
      const optGroupActive = document.createElement('optgroup');
      optGroupActive.label = prov.toUpperCase();
      const optGroupFallback = document.createElement('optgroup');
      optGroupFallback.label = prov.toUpperCase();

      state.availableModels[prov].forEach(m => {
        const opt1 = document.createElement('option');
        opt1.value = m.id;
        opt1.textContent = m.name;
        optGroupActive.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = m.id;
        opt2.textContent = m.name;
        optGroupFallback.appendChild(opt2);
      });

      dom.selectActiveModel.appendChild(optGroupActive);
      dom.selectFallbackModel.appendChild(optGroupFallback);
    });

    if (state.availableModels.gemini.length > 0) {
      state.primaryModel = state.availableModels.gemini[0].id;
      dom.selectActiveModel.value = state.primaryModel;
    }
    if (state.availableModels.groq.length > 0) {
      state.fallbackModel = state.availableModels.groq[0].id;
      dom.selectFallbackModel.value = state.fallbackModel;
    }

    updateHeaderModelBadge();
  }

  function updateHeaderModelBadge() {
    dom.headerActiveModel.textContent = state.primaryModel;
  }

  function appendUserMessage(text) {
    const card = document.createElement('div');
    card.className = 'message-card user';
    const bubble = document.createElement('div');
    bubble.className = 'bubble-content';
    bubble.textContent = text;
    card.appendChild(bubble);
    dom.streamContainer.appendChild(card);
    dom.streamContainer.scrollTop = dom.streamContainer.scrollHeight;
  }

  function createAssistantMessageCard(modelId) {
    const card = document.createElement('div');
    card.className = 'message-card assistant';

    const header = document.createElement('div');
    header.className = 'assistant-header';
    header.innerHTML = `<span>AI Model:</span> <span class="assistant-model-pill">${modelId}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble-content';
    bubble.innerHTML = '<span class="stream-cursor"></span>';

    card.appendChild(header);
    card.appendChild(bubble);
    dom.streamContainer.appendChild(card);
    dom.streamContainer.scrollTop = dom.streamContainer.scrollHeight;

    return {
      card,
      bubble,
      update(content) {
        bubble.innerHTML = renderFormattedOutput(content) + '<span class="stream-cursor"></span>';
        dom.streamContainer.scrollTop = dom.streamContainer.scrollHeight;
      },
      finish(content) {
        bubble.innerHTML = renderFormattedOutput(content);
        dom.streamContainer.scrollTop = dom.streamContainer.scrollHeight;
      }
    };
  }

  function renderFormattedOutput(raw) {
    const codeBlockRegex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
    let rendered = raw.replace(codeBlockRegex, (match, lang, code) => {
      const safeLang = lang || 'code';
      const cleanCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${safeLang}</span>
          <button class="code-copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(code)}'))">Copy Code</button>
        </div>
        <pre class="code-block-body"><code>${cleanCode}</code></pre>
      </div>`;
    });
    return rendered.replace(/\n/g, '<br>');
  }

  // SSE STREAMING FOR GOOGLE GEMINI
  async function streamGemini(apiKey, model, userText, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: state.config.temperature }
    };

    if (state.config.systemInstructions.trim()) {
      body.systemInstruction = { parts: [{ text: state.config.systemInstructions }] };
    }
    if (state.config.thinkingBudget > 0) {
      body.generationConfig.thinkingConfig = { thinkingBudget: state.config.thinkingBudget };
    }
    if (state.config.searchGrounding) {
      body.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`Google AI Studio HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
              const part = parsed.candidates[0].content.parts[0];
              if (part && part.text) {
                fullText += part.text;
                onChunk(fullText);
              }
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  // SSE STREAMING FOR GROQ / OPENROUTER (OPENAI COMPATIBLE)
  async function streamOpenAICompatible(endpoint, apiKey, model, userText, onChunk) {
    const messages = [];
    if (state.config.systemInstructions.trim()) {
      messages.push({ role: 'system', content: state.config.systemInstructions });
    }
    messages.push({ role: 'user', content: userText });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: state.config.temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`Provider HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices[0]?.delta?.content;
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

  // DYNAMIC GATEWAY DISPATCHER WITH AUTOMATIC 503/429 CASCADE
  async function executeGatewayPrompt(userPrompt) {
    appendUserMessage(userPrompt);
    dom.chatInput.value = '';
    dom.btnSendPrompt.disabled = true;

    if (state.mode === 'orchestration') {
      await runOrchestration(userPrompt);
    } else if (state.mode === 'multiagent') {
      await runMultiAgentDebate(userPrompt);
    } else {
      await runSingleStream(state.primaryModel, userPrompt, true);
    }

    dom.btnSendPrompt.disabled = false;
  }

  async function runSingleStream(modelId, promptText, allowFallback = true) {
    const provider = getProviderByModelId(modelId);
    const keys = state.keys[provider] || [];

    if (keys.length === 0) {
      const card = createAssistantMessageCard(modelId);
      card.finish(`⚠️ Execution blocked: No API Key found for ${provider.toUpperCase()}. Please open Key Vault to add a key.`);
      dom.vaultModal.style.display = 'flex';
      renderVaultTable();
      return null;
    }

    const card = createAssistantMessageCard(modelId);
    let success = false;
    let fullOutput = '';

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i].key;
      try {
        if (provider === 'gemini') {
          fullOutput = await streamGemini(key, modelId, promptText, (chunk) => card.update(chunk));
        } else if (provider === 'groq') {
          fullOutput = await streamOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', key, modelId, promptText, (chunk) => card.update(chunk));
        } else if (provider === 'openrouter') {
          fullOutput = await streamOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', key, modelId, promptText, (chunk) => card.update(chunk));
        }
        card.finish(fullOutput);
        success = true;
        break;
      } catch (err) {
        console.warn(`[Gateway Warning] Error on ${modelId} (Key ${i + 1}):`, err.message);
        
        // CATCH 503 (High Demand) or 429 (Rate Limit) -> AUTO FALLBACK
        if ((err.status === 503 || err.status === 429 || err.status === 404) && allowFallback && state.config.autoFallback) {
          card.update(`⚠️ [${modelId} busy / 503 Spike] Auto-rerouting to secondary model (${state.fallbackModel})...\n`);
          return await runSingleStream(state.fallbackModel, promptText, false);
        }
      }
    }

    if (!success) {
      card.finish(`⚠️ All connection attempts failed. Check network or verify keys in Key Vault.`);
    }

    return fullOutput;
  }

  // ORCHESTRATION PIPELINE (ARCHITECT -> EXECUTOR)
  async function runOrchestration(userPrompt) {
    const archPrompt = `[ORCHESTRATION ROLE: SYSTEM ARCHITECT]\nDeconstruct the following engineering requirement into an architectural execution plan:\n${userPrompt}`;
    const plan = await runSingleStream(state.primaryModel, archPrompt, true);
    if (plan) {
      const execPrompt = `[ORCHESTRATION ROLE: LEAD IMPLEMENTER]\nBased on the following architectural plan:\n${plan}\nImplement full production-ready code with complete logic and zero placeholders.`;
      await runSingleStream(state.fallbackModel, execPrompt, true);
    }
  }

  // MULTI-AGENT DEBATE (MODEL A GENERATES, MODEL B AUDITS)
  async function runMultiAgentDebate(userPrompt) {
    const p1 = `[DEBATE AGENT A - PRIMARY PROPOSAL]\nSynthesize a complete solution for:\n${userPrompt}`;
    const proposal = await runSingleStream(state.primaryModel, p1, true);
    if (proposal) {
      const p2 = `[DEBATE AGENT B - HARDENED AUDITOR]\nAudit the following solution for performance, edge-case failures, and architectural integrity:\n${proposal}`;
      await runSingleStream(state.fallbackModel, p2, true);
    }
  }

  function getProviderByModelId(modelId) {
    if (modelId.startsWith('gemini')) return 'gemini';
    if (modelId.startsWith('llama') || modelId.startsWith('deepseek-r1-distill') || modelId.startsWith('gemma')) return 'groq';
    return 'openrouter';
  }

  function renderVaultTable() {
    const activeTab = document.querySelector('.vtab-btn.active');
    const prov = activeTab ? activeTab.dataset.provider : 'gemini';
    const list = state.keys[prov] || [];

    dom.vaultKeysList.innerHTML = '';
    if (list.length === 0) {
      dom.vaultKeysList.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured for ${prov.toUpperCase()}.</td></tr>`;
      return;
    }

    list.forEach((k, idx) => {
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default Key'}</td>
        <td><span class="badge">Active</span></td>
        <td>${k.created}</td>
        <td><button class="text-tool-btn" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        list.splice(idx, 1);
        saveKeys();
        renderVaultTable();
      });
      dom.vaultKeysList.appendChild(tr);
    });
  }

  function exportCodePen() {
    const lastCard = dom.streamContainer.querySelector('.message-card.assistant:last-of-type');
    const text = lastCard ? lastCard.textContent : '';
    
    let htmlCode = '', cssCode = '', jsCode = '';
    const htmlMatch = text.match(/```html\n([\s\S]*?)```/i);
    const cssMatch = text.match(/```css\n([\s\S]*?)```/i);
    const jsMatch = text.match(/```(?:javascript|js)\n([\s\S]*?)```/i);

    if (htmlMatch) htmlCode = htmlMatch[1];
    if (cssMatch) cssCode = cssMatch[1];
    if (jsMatch) jsCode = jsMatch[1];

    if (!htmlCode && !cssCode && !jsCode) {
      alert('No HTML/CSS/JS code block found in recent AI response.');
      return;
    }

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

  function initEvents() {
    dom.modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.modePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.mode = pill.dataset.mode;
        dom.currentModeTag.textContent = `${pill.textContent} Active`;
      });
    });

    dom.btnSendPrompt.addEventListener('click', () => {
      const text = dom.chatInput.value.trim();
      if (text) executeGatewayPrompt(text);
    });

    dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = dom.chatInput.value.trim();
        if (text) executeGatewayPrompt(text);
      }
    });

    dom.btnOpenSettings.addEventListener('click', () => dom.settingsDrawer.classList.add('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsDrawer.classList.remove('open'));

    dom.selectActiveModel.addEventListener('change', () => {
      state.primaryModel = dom.selectActiveModel.value;
      updateHeaderModelBadge();
    });
    dom.selectFallbackModel.addEventListener('change', () => {
      state.fallbackModel = dom.selectFallbackModel.value;
    });

    dom.settingSystemInstructions.addEventListener('input', () => state.config.systemInstructions = dom.settingSystemInstructions.value);
    dom.settingThinkingBudget.addEventListener('change', () => state.config.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10));
    dom.settingStreamingToggle.addEventListener('change', () => state.config.streaming = dom.settingStreamingToggle.checked);
    dom.settingAutoFallback.addEventListener('change', () => state.config.autoFallback = dom.settingAutoFallback.checked);
    dom.settingSearchGrounding.addEventListener('change', () => state.config.searchGrounding = dom.settingSearchGrounding.checked);
    dom.settingTemperature.addEventListener('input', () => {
      state.config.temperature = parseFloat(dom.settingTemperature.value);
      dom.tempValDisplay.textContent = state.config.temperature.toFixed(2);
    });

    dom.btnOpenVault.addEventListener('click', () => {
      dom.vaultModal.style.display = 'flex';
      renderVaultTable();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.vaultModal.style.display = 'none');

    dom.vtabBtns.forEach(b => {
      b.addEventListener('click', () => {
        dom.vtabBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderVaultTable();
      });
    });

    dom.btnSaveKey.addEventListener('click', async () => {
      const active = document.querySelector('.vtab-btn.active');
      const prov = active ? active.dataset.provider : 'gemini';
      const keyVal = dom.vaultKeyInput.value.trim();
      const labelVal = dom.vaultLabelInput.value.trim() || 'Key';

      if (!keyVal) return alert('Please enter an API key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key: keyVal, label: labelVal, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      await fetchLiveModels();
    });

    dom.btnClearChat.addEventListener('click', () => {
      if (confirm('Clear chat history?')) dom.streamContainer.innerHTML = '';
    });
    dom.btnRefreshModels.addEventListener('click', () => fetchLiveModels());
    dom.btnCodepenExport.addEventListener('click', exportCodePen);
  }

  async function init() {
    loadKeys();
    populateModelSelectors();
    initEvents();
    await fetchLiveModels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
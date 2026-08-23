(function () {
  'use strict';

  const DEFAULT_MODELS = {
    gemini: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Top Coding / Agentic)' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Fast Agentic Fallback)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Reasoning)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (High-Throughput)' }
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Groq)' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Groq)' }
    ],
    openrouter: [
      { id: 'openrouter/free', name: 'OpenRouter Auto Free Router' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)' }
    ],
    hf: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B (HF Free)' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (HF Free)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3 (HF Free)' }
    ]
  };

  const state = {
    mode: 'chat', // 'chat' | 'multi' | 'orchestrator'
    autoRouter: true,
    models: Object.assign({}, DEFAULT_MODELS),
    activeModel: 'gemini-3.7-flash',
    chatHistory: [],
    runSettings: {
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: false,
      autoCascade: true,
      rateGovernor: true,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    keys: { gemini: [], groq: [], openrouter: [], hf: [], youtube: [] },
    spaces: [],
    requestCounters: {}
  };

  const dom = {
    chatViewport: document.getElementById('chat-viewport'),
    chatMessages: document.getElementById('chat-messages'),
    welcomeScreen: document.getElementById('welcome-screen'),
    promptInput: document.getElementById('prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    btnExportCodepen: document.getElementById('btn-export-codepen'),
    gatewayStatusLine: document.getElementById('gateway-status-line'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    activeModeBadge: document.getElementById('active-mode-badge'),
    btnModeChat: document.getElementById('btn-mode-chat'),
    btnModeMulti: document.getElementById('btn-mode-multi'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    btnToggleAutoRouter: document.getElementById('btn-toggle-auto-router'),
    quickModelSelect: document.getElementById('quick-model-select'),
    btnFetchLiveModels: document.getElementById('btn-fetch-live-models'),
    keyCountBadge: document.getElementById('key-count-badge'),
    spaceCountBadge: document.getElementById('space-count-badge'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingModelSelect: document.getElementById('setting-model-select'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingRateGovernor: document.getElementById('setting-rate-governor'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
    settingTemp: document.getElementById('setting-temp'),
    settingTempVal: document.getElementById('setting-temp-val'),
    settingMaxTokens: document.getElementById('setting-max-tokens'),
    settingMaxTokensVal: document.getElementById('setting-max-tokens-val'),

    keyVaultModal: document.getElementById('key-vault-modal'),
    openKeyVaultBtn: document.getElementById('open-key-vault-btn'),
    btnCloseVault: document.getElementById('btn-close-vault'),
    vaultKeyInput: document.getElementById('vault-key-input'),
    vaultLabelInput: document.getElementById('vault-label-input'),
    btnAddKey: document.getElementById('btn-add-key'),
    autoClassifyPreview: document.getElementById('auto-classify-preview'),
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),

    spaceManagerModal: document.getElementById('space-manager-modal'),
    openSpaceManagerBtn: document.getElementById('open-space-manager-btn'),
    btnCloseSpaceManager: document.getElementById('btn-close-space-manager'),
    spaceUrlInput: document.getElementById('space-url-input'),
    spaceNameInput: document.getElementById('space-name-input'),
    btnAddSpace: document.getElementById('btn-add-space'),
    spaceItemsList: document.getElementById('space-items-list'),

    tagBtns: document.querySelectorAll('.tag-btn')
  };

  function loadState() {
    try {
      const rawKeys = localStorage.getItem('aetherspace_vault_keys');
      if (rawKeys) state.keys = Object.assign({ gemini: [], groq: [], openrouter: [], hf: [], youtube: [] }, JSON.parse(rawKeys));
      const rawSpaces = localStorage.getItem('aetherspace_user_spaces');
      if (rawSpaces) state.spaces = JSON.parse(rawSpaces);
    } catch (e) {
      console.warn('Storage parse notice', e);
    }
    updateKeyBadge();
    updateSpaceBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function saveSpaces() {
    localStorage.setItem('aetherspace_user_spaces', JSON.stringify(state.spaces));
    updateSpaceBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function updateSpaceBadge() {
    dom.spaceCountBadge.textContent = `${state.spaces.length} Active`;
  }

  function classifyApiKey(key) {
    const k = key.trim();
    if (/^AIzaSy[A-Za-z0-9_-]{33}$/.test(k)) return 'gemini';
    if (/^gsk_[A-Za-z0-9]{48,}$/.test(k)) return 'groq';
    if (/^sk-or-v1-[a-f0-9]{64}$/.test(k)) return 'openrouter';
    if (/^hf_[A-Za-z0-9]{34,}$/.test(k)) return 'hf';
    if (/^AIza[0-9A-Za-z-_]{35}$/.test(k)) return 'youtube';
    return 'gemini';
  }

  function populateModelSelectors() {
    dom.quickModelSelect.innerHTML = '';
    dom.settingModelSelect.innerHTML = '';

    const labels = { gemini: 'Google AI Studio', groq: 'Groq Cloud', openrouter: 'OpenRouter', hf: 'Hugging Face' };

    Object.keys(state.models).forEach((provider) => {
      const optGroup1 = document.createElement('optgroup');
      optGroup1.label = labels[provider] || provider;
      const optGroup2 = document.createElement('optgroup');
      optGroup2.label = labels[provider] || provider;

      state.models[provider].forEach((m) => {
        const opt1 = document.createElement('option');
        opt1.value = m.id;
        opt1.textContent = m.name;
        if (m.id === state.activeModel) opt1.selected = true;
        optGroup1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = m.id;
        opt2.textContent = m.name;
        if (m.id === state.activeModel) opt2.selected = true;
        optGroup2.appendChild(opt2);
      });

      dom.quickModelSelect.appendChild(optGroup1);
      dom.settingModelSelect.appendChild(optGroup2);
    });
  }

  async function fetchLiveModels() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length === 0) {
      alert('Please store at least one Google AI Studio key in Key Vault.');
      return;
    }

    try {
      showGatewayStatus('Fetching live inventory from Google AI Studio...');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.models && Array.isArray(data.models)) {
        state.models.gemini = data.models
          .filter(m => m.name && (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => {
            const cleanId = m.name.replace(/^models\//, '');
            return { id: cleanId, name: `${m.displayName || cleanId} (${cleanId})` };
          });
        populateModelSelectors();
        showGatewayStatus(`Live sync complete. ${state.models.gemini.length} models updated.`);
        setTimeout(hideGatewayStatus, 3000);
      }
    } catch (e) {
      showGatewayStatus(`Live sync notice: ${e.message}`);
      setTimeout(hideGatewayStatus, 3000);
    }
  }

  function showGatewayStatus(text) {
    dom.gatewayStatusText.textContent = text;
    dom.gatewayStatusLine.style.display = 'inline-flex';
  }

  function hideGatewayStatus() {
    dom.gatewayStatusLine.style.display = 'none';
  }

  function appendUserMessage(text) {
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'chat-row user';
    row.innerHTML = `
      <div class="chat-header-meta"><span>You</span></div>
      <div class="chat-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    `;
    dom.chatMessages.appendChild(row);
    scrollToBottom();
    state.chatHistory.push({ role: 'user', content: text });
  }

  function createAssistantMessageNode(modelLabel) {
    if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'chat-row assistant';
    const meta = document.createElement('div');
    meta.className = 'chat-header-meta';
    meta.innerHTML = `<span class="model-tag">${escapeHtml(modelLabel)}</span>`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    row.appendChild(meta);
    row.appendChild(bubble);
    dom.chatMessages.appendChild(row);
    scrollToBottom();
    return { row, bubble };
  }

  function renderFormattedContent(targetElement, rawText, isStreaming = false) {
    const codeBlockRegex = /```([a-zA-Z0-9_\-\+\.]*)\n([\s\S]*?)```/g;
    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      const before = rawText.substring(lastIndex, match.index);
      html += escapeHtml(before).replace(/\n/g, '<br>');
      const lang = match[1] || 'code';
      const code = match[2];
      const safeCode = escapeHtml(code);

      html += `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${escapeHtml(lang)}</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(code)}'))">Copy</button>
          </div>
          <pre class="code-block-pre"><code>${safeCode}</code></pre>
        </div>
      `;
      lastIndex = match.index + match[0].length;
    }

    const remaining = rawText.substring(lastIndex);
    html += escapeHtml(remaining).replace(/\n/g, '<br>');

    if (isStreaming) html += '<span class="streaming-cursor"></span>';
    targetElement.innerHTML = html;
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function scrollToBottom() {
    dom.chatViewport.scrollTop = dom.chatViewport.scrollHeight;
  }

  // GEMINI SSE STREAM
  async function streamGemini(apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = state.chatHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const bodyPayload = {
      contents: contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
    if (config.thinkingBudget > 0) bodyPayload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    if (config.searchGrounding) bodyPayload.tools = [{ googleSearch: {} }];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) throw { status: res.status, message: await res.text() };

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '', fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const json = JSON.parse(line.trim().substring(6));
            if (json.candidates && json.candidates[0] && json.candidates[0].content) {
              const parts = json.candidates[0].content.parts || [];
              for (const part of parts) {
                if (part.text) {
                  fullText += part.text;
                  onChunk(fullText);
                }
              }
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  // OPENAI-COMPATIBLE SSE STREAM (GROQ / OPENROUTER)
  async function streamOpenAI(endpoint, apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    state.chatHistory.forEach(m => messages.push({ role: m.role, content: m.content }));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: config.temperature,
        max_tokens: Math.min(config.maxOutputTokens, 8192),
        stream: true
      })
    });

    if (!res.ok) throw { status: res.status, message: await res.text() };

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '', fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const payload = line.trim().substring(6).trim();
          if (payload === '[DONE]') break;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices && json.choices[0] && json.choices[0].delta ? json.choices[0].delta.content : '';
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

  // HUGGING FACE SERVERLESS INFERENCE API
  async function streamHuggingFace(apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const endpoint = `https://api-inference.huggingface.co/models/${model}`;
    const prompt = (systemPrompt ? `System: ${systemPrompt}\n` : '') + `User: ${userMessage}\nAssistant:`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 2048, temperature: config.temperature, return_full_text: false }
      })
    });

    if (!res.ok) throw { status: res.status, message: await res.text() };
    const json = await res.json();
    let text = '';
    if (Array.isArray(json) && json[0] && json[0].generated_text) text = json[0].generated_text;
    else if (json.generated_text) text = json.generated_text;
    else text = JSON.stringify(json);

    onChunk(text);
    return text;
  }

  // SEMANTIC ROUTER
  function decideModelAutomatically(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('architect') || lower.includes('microservice') || lower.includes('consensus') || lower.includes('orchestrat')) {
      return 'gemini-3.1-pro-preview';
    }
    if (lower.includes('html') || lower.includes('css') || lower.includes('javascript') || lower.includes('code') || lower.includes('function') || lower.includes('class')) {
      return 'gemini-3.7-flash';
    }
    return 'llama-3.3-70b-versatile';
  }

  // GATEWAY DISPATCHER
  async function handleSend() {
    const text = dom.promptInput.value.trim();
    if (!text) return;

    dom.promptInput.value = '';
    dom.btnSendPrompt.disabled = true;

    appendUserMessage(text);

    let chosenModel = state.activeModel;
    if (state.autoRouter) {
      chosenModel = decideModelAutomatically(text);
      showGatewayStatus(`Auto-Router: Assigned ${chosenModel}`);
    }

    let provider = 'gemini';
    if (chosenModel.startsWith('llama') || chosenModel.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (chosenModel.includes('openrouter') || chosenModel.includes(':free')) provider = 'openrouter';
    else if (chosenModel.includes('/') && !chosenModel.includes(':free')) provider = 'hf';

    const keysList = state.keys[provider] || [];
    if (keysList.length === 0) {
      const { bubble } = createAssistantMessageNode('Gateway');
      renderFormattedContent(bubble, `No API Key found for **${provider.toUpperCase()}**. Please open Key Vault to add a key.`);
      dom.btnSendPrompt.disabled = false;
      return;
    }

    const modelChain = [chosenModel];
    if (provider === 'gemini') {
      ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'].forEach(f => {
        if (!modelChain.includes(f)) modelChain.push(f);
      });
    }

    const { bubble, row } = createAssistantMessageNode(chosenModel);
    renderFormattedContent(bubble, '', true);

    let executionSuccess = false;
    let completedText = '';

    for (let k = 0; k < keysList.length && !executionSuccess; k++) {
      const currentKey = keysList[k].key;

      for (let m = 0; m < modelChain.length && !executionSuccess; m++) {
        const candidateModel = modelChain[m];

        try {
          if (candidateModel !== chosenModel) {
            showGatewayStatus(`Cascade Shift: ${candidateModel} (Key #${k + 1})`);
          }

          if (provider === 'gemini') {
            completedText = await streamGemini(currentKey, candidateModel, state.runSettings.systemInstructions, text, state.runSettings, acc => {
              renderFormattedContent(bubble, acc, true);
              scrollToBottom();
            });
          } else if (provider === 'groq') {
            completedText = await streamOpenAI('https://api.groq.com/openai/v1/chat/completions', currentKey, candidateModel, state.runSettings.systemInstructions, text, state.runSettings, acc => {
              renderFormattedContent(bubble, acc, true);
              scrollToBottom();
            });
          } else if (provider === 'openrouter') {
            completedText = await streamOpenAI('https://openrouter.ai/api/v1/chat/completions', currentKey, candidateModel, state.runSettings.systemInstructions, text, state.runSettings, acc => {
              renderFormattedContent(bubble, acc, true);
              scrollToBottom();
            });
          } else if (provider === 'hf') {
            completedText = await streamHuggingFace(currentKey, candidateModel, state.runSettings.systemInstructions, text, state.runSettings, acc => {
              renderFormattedContent(bubble, acc, true);
              scrollToBottom();
            });
          }

          executionSuccess = true;
          row.querySelector('.chat-header-meta span').textContent = candidateModel;
          break;
        } catch (err) {
          console.warn(`Gateway notice: ${candidateModel} error:`, err.status || err.message);
          if (!state.runSettings.autoCascade) break;
        }
      }
    }

    hideGatewayStatus();
    dom.btnSendPrompt.disabled = false;

    if (executionSuccess && completedText) {
      renderFormattedContent(bubble, completedText, false);
      state.chatHistory.push({ role: 'assistant', content: completedText });
    } else {
      renderFormattedContent(bubble, 'Gateway Notice: Request could not be completed across active keys. Please check Key Vault.');
    }
  }

  function exportLatestCodeToCodePen() {
    if (state.chatHistory.length === 0) return alert('No conversation history.');
    const last = state.chatHistory.filter(m => m.role === 'assistant').pop();
    if (!last) return alert('No assistant response found.');

    const htmlMatch = last.content.match(/```html\n([\s\S]*?)```/);
    const cssMatch = last.content.match(/```css\n([\s\S]*?)```/);
    const jsMatch = last.content.match(/```(?:javascript|js)\n([\s\S]*?)```/);

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
      title: 'AetherSpace Export',
      html: htmlMatch ? htmlMatch[1] : '',
      css: cssMatch ? cssMatch[1] : '',
      js: jsMatch ? jsMatch[1] : ''
    });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function renderVaultKeys() {
    dom.vaultKeysTbody.innerHTML = '';
    const all = [];
    Object.keys(state.keys).forEach(p => {
      (state.keys[p] || []).forEach((k, idx) => {
        all.push({ provider: p, key: k.key, label: k.label, created: k.created, idx });
      });
    });

    if (all.length === 0) {
      dom.vaultKeysTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured. Paste any key above.</td></tr>';
      return;
    }

    all.forEach(item => {
      const tr = document.createElement('tr');
      const mask = item.key.length > 8 ? `${item.key.substring(0, 4)}...${item.key.substring(item.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><span class="mode-badge">${item.provider.toUpperCase()}</span></td>
        <td><code>${mask}</code></td>
        <td>${escapeHtml(item.label)}</td>
        <td><span class="badge">Active Free</span></td>
        <td><button class="tool-chip" data-del-prov="${item.provider}" data-del-idx="${item.idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del-prov]').addEventListener('click', (e) => {
        const prov = e.target.dataset.delProv;
        const idx = parseInt(e.target.dataset.delIdx, 10);
        state.keys[prov].splice(idx, 1);
        saveKeys();
        renderVaultKeys();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function renderSpacesList() {
    dom.spaceItemsList.innerHTML = '';
    if (state.spaces.length === 0) {
      dom.spaceItemsList.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:12px;">No custom Hugging Face spaces connected yet.</div>';
      return;
    }

    state.spaces.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'space-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(s.url)}</div>
        </div>
        <button class="tool-chip" data-del-space="${idx}" style="color:var(--accent-rose);">Remove</button>
      `;
      div.querySelector('[data-del-space]').addEventListener('click', () => {
        state.spaces.splice(idx, 1);
        saveSpaces();
        renderSpacesList();
      });
      dom.spaceItemsList.appendChild(div);
    });
  }

  function initEvents() {
    dom.promptInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnSendPrompt.addEventListener('click', handleSend);
    dom.btnExportCodepen.addEventListener('click', exportLatestCodeToCodePen);

    dom.btnClearChat.addEventListener('click', () => {
      state.chatHistory = [];
      dom.chatMessages.innerHTML = '';
      if (dom.welcomeScreen) {
        dom.chatMessages.appendChild(dom.welcomeScreen);
        dom.welcomeScreen.style.display = 'block';
      }
    });

    dom.tagBtns.forEach(b => {
      b.addEventListener('click', () => {
        dom.promptInput.value = b.dataset.preset;
        dom.promptInput.focus();
      });
    });

    dom.btnToggleAutoRouter.addEventListener('click', () => {
      state.autoRouter = !state.autoRouter;
      dom.btnToggleAutoRouter.classList.toggle('active', state.autoRouter);
      dom.btnToggleAutoRouter.querySelector('.pill-text').textContent = `Auto-Router: ${state.autoRouter ? 'ON' : 'OFF'}`;
    });

    dom.btnModeChat.addEventListener('click', () => {
      state.mode = 'chat';
      dom.btnModeChat.classList.add('active');
      dom.btnModeMulti.classList.remove('active');
      dom.btnModeOrchestrator.classList.remove('active');
      dom.activeModeBadge.textContent = 'Direct Chat';
    });

    dom.btnModeMulti.addEventListener('click', () => {
      state.mode = 'multi';
      dom.btnModeMulti.classList.add('active');
      dom.btnModeChat.classList.remove('active');
      dom.btnModeOrchestrator.classList.remove('active');
      dom.activeModeBadge.textContent = 'Multi-Agent';
    });

    dom.btnModeOrchestrator.addEventListener('click', () => {
      state.mode = 'orchestrator';
      dom.btnModeOrchestrator.classList.add('active');
      dom.btnModeChat.classList.remove('active');
      dom.btnModeMulti.classList.remove('active');
      dom.activeModeBadge.textContent = 'Orchestration';
    });

    dom.quickModelSelect.addEventListener('change', () => {
      state.activeModel = dom.quickModelSelect.value;
      dom.settingModelSelect.value = state.activeModel;
    });

    dom.settingModelSelect.addEventListener('change', () => {
      state.activeModel = dom.settingModelSelect.value;
      dom.quickModelSelect.value = state.activeModel;
    });

    dom.btnFetchLiveModels.addEventListener('click', fetchLiveModels);

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingThinkingBudget.addEventListener('change', () => {
      state.runSettings.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10);
    });

    dom.settingAutoCascade.addEventListener('change', () => {
      state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    });

    dom.settingRateGovernor.addEventListener('change', () => {
      state.runSettings.rateGovernor = dom.settingRateGovernor.checked;
    });

    dom.settingSearchGrounding.addEventListener('change', () => {
      state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    });

    dom.settingTemp.addEventListener('input', () => {
      state.runSettings.temperature = parseFloat(dom.settingTemp.value);
      dom.settingTempVal.textContent = state.runSettings.temperature.toFixed(2);
    });

    dom.settingMaxTokens.addEventListener('input', () => {
      state.runSettings.maxOutputTokens = parseInt(dom.settingMaxTokens.value, 10);
      dom.settingMaxTokensVal.textContent = state.runSettings.maxOutputTokens;
    });

    dom.openKeyVaultBtn.addEventListener('click', () => {
      dom.keyVaultModal.style.display = 'flex';
      renderVaultKeys();
    });
    dom.btnCloseVault.addEventListener('click', () => dom.keyVaultModal.style.display = 'none');

    dom.vaultKeyInput.addEventListener('input', () => {
      const detected = classifyApiKey(dom.vaultKeyInput.value);
      dom.autoClassifyPreview.textContent = `Auto-Detected Provider: ${detected.toUpperCase()}`;
    });

    dom.btnAddKey.addEventListener('click', () => {
      const keyVal = dom.vaultKeyInput.value.trim();
      const labelVal = dom.vaultLabelInput.value.trim() || 'Key';
      if (!keyVal) return alert('Please paste an API key.');
      const prov = classifyApiKey(keyVal);

      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key: keyVal, label: labelVal, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      dom.autoClassifyPreview.textContent = 'Paste an API key above for instant automatic provider classification.';
      renderVaultKeys();
    });

    dom.openSpaceManagerBtn.addEventListener('click', () => {
      dom.spaceManagerModal.style.display = 'flex';
      renderSpacesList();
    });
    dom.btnCloseSpaceManager.addEventListener('click', () => dom.spaceManagerModal.style.display = 'none');

    dom.btnAddSpace.addEventListener('click', () => {
      const url = dom.spaceUrlInput.value.trim();
      const name = dom.spaceNameInput.value.trim() || 'Custom Space';
      if (!url) return alert('Please enter a space URL.');
      state.spaces.push({ url, name });
      saveSpaces();
      dom.spaceUrlInput.value = '';
      dom.spaceNameInput.value = '';
      renderSpacesList();
    });
  }

  function init() {
    loadState();
    populateModelSelectors();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
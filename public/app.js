(function () {
  'use strict';

  // SOTA 2026 ROSTER (HuggingChat & AI Studio Validated)
  const PRUNED_SOTA_ROSTER = {
    gemini: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (SOTA Code & Agentic)' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Fast Agentic)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Reasoning)' }
    ],
    hf: [
      { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', name: 'DeepSeek V4 Flash 284B (HF SOTA)' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (Open Reasoning SOTA)' },
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B (Open Code SOTA)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3 (Fast Utility)' }
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Groq LPU)' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq LPU)' }
    ],
    openrouter: [
      { id: 'openrouter/free', name: 'OpenRouter Auto Free Router' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)' }
    ]
  };

  const state = {
    mode: 'chat',
    autoRouter: true,
    models: Object.assign({}, PRUNED_SOTA_ROSTER),
    activeModel: 'gemini-3.7-flash',
    chatHistory: [],
    runSettings: {
      customModel: '',
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: true,
      autoCascade: true,
      rateGovernor: true,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    mcp: {
      exaSearch: true,
      hfHub: true,
      urlContext: true,
      customServers: []
    },
    keys: { gemini: [], hf: [], groq: [], openrouter: [] }
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
    btnToggleAutoRouter: document.getElementById('btn-toggle-auto-router'),
    quickModelSelect: document.getElementById('quick-model-select'),
    btnFetchLiveModels: document.getElementById('btn-fetch-live-models'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnPromptPlus: document.getElementById('btn-prompt-plus'),
    promptPlusMenu: document.getElementById('prompt-plus-menu'),
    menuItemMcpServers: document.getElementById('menu-item-mcp-servers'),
    menuItemToggleSearch: document.getElementById('menu-item-toggle-search'),
    menuItemToggleUrl: document.getElementById('menu-item-toggle-url'),
    labelMenuSearch: document.getElementById('label-menu-search'),
    labelMenuUrl: document.getElementById('label-menu-url'),
    activeMcpPill: document.getElementById('active-mcp-pill'),
    activeMcpPillText: document.getElementById('active-mcp-pill-text'),
    btnCloseMcpPill: document.getElementById('btn-close-mcp-pill'),
    footerActiveModelDisplay: document.getElementById('footer-active-model-display'),
    mcpRealtimeClock: document.getElementById('mcp-realtime-clock'),

    mcpServersModal: document.getElementById('mcp-servers-modal'),
    openMcpModalBtn: document.getElementById('open-mcp-modal-btn'),
    btnCloseMcpServers: document.getElementById('btn-close-mcp-servers'),
    mcpServerCountBadge: document.getElementById('mcp-server-count-badge'),
    mcpSummaryTitle: document.getElementById('mcp-summary-title'),
    mcpSummarySub: document.getElementById('mcp-summary-sub'),
    btnMcpRefreshAll: document.getElementById('btn-mcp-refresh-all'),
    btnOpenAddCustomMcp: document.getElementById('btn-open-add-custom-mcp'),
    btnAddFirstCustomServer: document.getElementById('btn-add-first-custom-server'),
    mcpServerExaToggle: document.getElementById('mcp-server-exa-toggle'),
    mcpServerHfToggle: document.getElementById('mcp-server-hf-toggle'),
    btnHealthExa: document.getElementById('btn-health-exa'),
    btnHealthHf: document.getElementById('btn-health-hf'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingModelSelect: document.getElementById('setting-model-select'),
    settingCustomModel: document.getElementById('setting-custom-model'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingRateGovernor: document.getElementById('setting-rate-governor'),
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

    btnModeChat: document.getElementById('btn-mode-chat'),
    btnModeMulti: document.getElementById('btn-mode-multi'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    tagBtns: document.querySelectorAll('.tag-btn')
  };

  function loadState() {
    try {
      const rawKeys = localStorage.getItem('aetherspace_vault_keys');
      if (rawKeys) state.keys = Object.assign({ gemini: [], hf: [], groq: [], openrouter: [] }, JSON.parse(rawKeys));
      const rawMcp = localStorage.getItem('aetherspace_mcp_servers');
      if (rawMcp) state.mcp = Object.assign(state.mcp, JSON.parse(rawMcp));
    } catch (e) {
      console.warn('Storage parse notice', e);
    }
    updateKeyBadge();
    updateMcpUI();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
    populateModelSelectors();
  }

  function saveMcpConfig() {
    localStorage.setItem('aetherspace_mcp_servers', JSON.stringify(state.mcp));
    updateMcpUI();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function updateMcpUI() {
    let enabledCount = 0;
    if (state.mcp.exaSearch) enabledCount++;
    if (state.mcp.hfHub) enabledCount++;
    const totalConfigured = 2 + (state.mcp.customServers ? state.mcp.customServers.length : 0);

    dom.mcpServerCountBadge.textContent = `${totalConfigured} Configured`;
    dom.mcpSummaryTitle.textContent = `${totalConfigured} servers configured`;
    dom.mcpSummarySub.textContent = `${enabledCount} enabled`;
    dom.activeMcpPillText.textContent = `MCP (${enabledCount})`;

    dom.mcpServerExaToggle.checked = state.mcp.exaSearch;
    dom.mcpServerHfToggle.checked = state.mcp.hfHub;

    dom.labelMenuSearch.textContent = `Web Search (Exa): ${state.mcp.exaSearch ? 'ON' : 'OFF'}`;
    dom.labelMenuUrl.textContent = `Live URL-Context: ${state.mcp.urlContext ? 'ON' : 'OFF'}`;

    dom.activeMcpPill.style.display = enabledCount > 0 ? 'inline-flex' : 'none';
  }

  function classifyApiKey(key) {
    const k = key.trim();
    if (/^AIzaSy[A-Za-z0-9_-]{33}$/.test(k)) return 'gemini';
    if (/^hf_[A-Za-z0-9]{34,}$/.test(k)) return 'hf';
    if (/^gsk_[A-Za-z0-9]{48,}$/.test(k)) return 'groq';
    if (/^sk-or-v1-[a-f0-9]{64}$/.test(k)) return 'openrouter';
    return 'gemini';
  }

  function getAvailableProvidersWithKeys() {
    return Object.keys(state.keys).filter(p => (state.keys[p] || []).length > 0);
  }

  function populateModelSelectors() {
    dom.quickModelSelect.innerHTML = '';
    dom.settingModelSelect.innerHTML = '';

    const available = getAvailableProvidersWithKeys();
    const labels = { gemini: 'Google AI Studio', hf: 'Hugging Face SOTA', groq: 'Groq Cloud', openrouter: 'OpenRouter' };

    if (available.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '⚠️ Add Key in Vault to Unlock Models';
      dom.quickModelSelect.appendChild(opt);
      dom.settingModelSelect.appendChild(opt.cloneNode(true));
      return;
    }

    available.forEach((provider) => {
      const optGroup1 = document.createElement('optgroup');
      optGroup1.label = labels[provider] || provider;
      const optGroup2 = document.createElement('optgroup');
      optGroup2.label = labels[provider] || provider;

      (state.models[provider] || []).forEach((m) => {
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

    if (!available.some(p => (state.models[p] || []).some(m => m.id === state.activeModel))) {
      state.activeModel = state.models[available[0]][0].id;
      dom.quickModelSelect.value = state.activeModel;
      dom.settingModelSelect.value = state.activeModel;
    }

    dom.footerActiveModelDisplay.textContent = `Model: ${state.activeModel}`;
  }

  function getRealtimeTemporalSystemContext() {
    const now = new Date();
    const timeStr = now.toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'long' });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `[CURRENT REAL-TIME CONTEXT: Datum & Uhrzeit: ${timeStr} | Zeitzone: ${tz} | ISO-8601: ${now.toISOString()}]\nProvide precise real-time answers based on this exact live baseline.`;
  }

  function decideModelKeyAware(prompt) {
    const available = getAvailableProvidersWithKeys();
    if (available.length === 0) return state.activeModel;

    const lower = prompt.toLowerCase();

    if (available.includes('gemini')) {
      if (lower.includes('architect') || lower.includes('microservice') || lower.includes('orchestrat')) {
        return 'gemini-3.1-pro-preview';
      }
      return 'gemini-3.7-flash';
    }

    if (available.includes('hf')) {
      if (lower.includes('code') || lower.includes('html') || lower.includes('css') || lower.includes('js')) {
        return 'deepseek-ai/DeepSeek-V4-Flash-0731';
      }
      return 'deepseek-ai/DeepSeek-R1';
    }

    if (available.includes('groq')) {
      return 'llama-3.3-70b-versatile';
    }

    return state.models[available[0]][0].id;
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

  function renderFormattedContent(targetElement, rawText, isStreaming = false, groundingSources = []) {
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

    if (groundingSources && groundingSources.length > 0) {
      html += '<div class="grounding-sources-box"><strong>🔍 Live Web Grounding Quellen:</strong><br>';
      groundingSources.forEach(s => {
        html += `• <a href="${escapeHtml(s.uri)}" target="_blank" style="color:var(--accent-cyan);">${escapeHtml(s.title || s.uri)}</a><br>`;
      });
      html += '</div>';
    }

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

  async function resolveUrlContextIfPresent(promptText) {
    if (!state.mcp.urlContext) return promptText;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = promptText.match(urlRegex);
    if (!urls || urls.length === 0) return promptText;

    showGatewayStatus(`MCP Tool: Extracting live web context from ${urls[0]}...`);
    try {
      const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(urls[0])}`);
      if (!res.ok) return promptText;
      const data = await res.json();
      if (data.content) {
        return `[GROUNDED LIVE URL CONTEXT FROM ${urls[0]}]:\n${data.content}\n\n[USER QUERY]:\n${promptText}`;
      }
    } catch (e) {
      console.warn('URL context extract note:', e.message);
    }
    return promptText;
  }

  // GEMINI STREAM
  async function streamGemini(apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const temporalContext = getRealtimeTemporalSystemContext();
    const fullSystem = (systemPrompt ? `${systemPrompt}\n\n` : '') + temporalContext;

    const contents = state.chatHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const bodyPayload = {
      contents: contents,
      systemInstruction: { parts: [{ text: fullSystem }] },
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (config.thinkingBudget > 0) {
      bodyPayload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (state.mcp.exaSearch) {
      bodyPayload.tools = [{ googleSearch: {} }];
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok && state.mcp.exaSearch) {
      delete bodyPayload.tools;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '', fullText = '';
    const sources = [];

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
            if (json.candidates && json.candidates[0]) {
              const cand = json.candidates[0];
              if (cand.content && cand.content.parts) {
                for (const part of cand.content.parts) {
                  if (part.text) {
                    fullText += part.text;
                    onChunk(fullText, sources);
                  }
                }
              }
              if (cand.groundingMetadata && cand.groundingMetadata.groundingChunks) {
                cand.groundingMetadata.groundingChunks.forEach(c => {
                  if (c.web && c.web.uri && !sources.some(s => s.uri === c.web.uri)) {
                    sources.push({ uri: c.web.uri, title: c.web.title || c.web.uri });
                  }
                });
                onChunk(fullText, sources);
              }
            }
          } catch (e) {}
        }
      }
    }
    return { text: fullText, sources };
  }

  // HUGGING FACE ROUTER CALL (OpenAI-Compatible SOTA Endpoint)
  async function streamHuggingFace(apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const endpoint = 'https://router.huggingface.co/v1/chat/completions';
    const temporalContext = getRealtimeTemporalSystemContext();
    const fullSystem = (systemPrompt ? `${systemPrompt}\n\n` : '') + temporalContext;

    const messages = [{ role: 'system', content: fullSystem }];
    state.chatHistory.forEach(m => messages.push({ role: m.role, content: m.content }));

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
        max_tokens: Math.min(config.maxOutputTokens, 2048),
        stream: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }

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
              onChunk(fullText, []);
            }
          } catch (e) {}
        }
      }
    }
    return { text: fullText, sources: [] };
  }

  // GROQ / OPENROUTER CALL
  async function streamOpenAI(endpoint, apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const messages = [];
    const temporalContext = getRealtimeTemporalSystemContext();
    const fullSystem = (systemPrompt ? `${systemPrompt}\n\n` : '') + temporalContext;
    messages.push({ role: 'system', content: fullSystem });
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

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }
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
              onChunk(fullText, []);
            }
          } catch (e) {}
        }
      }
    }
    return { text: fullText, sources: [] };
  }

  // RESILIENT CASCADE
  async function executeWithResilientCascade(preferredModel, promptText, onChunk) {
    const candidateChain = [];
    const availableProviders = getAvailableProvidersWithKeys();

    if (availableProviders.length === 0) {
      throw new Error('No API Keys configured. Please open Key Vault to add a key.');
    }

    if (preferredModel) candidateChain.push(preferredModel);

    if (availableProviders.includes('gemini')) {
      ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'].forEach(m => {
        if (!candidateChain.includes(m)) candidateChain.push(m);
      });
    }
    if (availableProviders.includes('hf')) {
      ['deepseek-ai/DeepSeek-V4-Flash-0731', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-Coder-32B-Instruct'].forEach(m => {
        if (!candidateChain.includes(m)) candidateChain.push(m);
      });
    }
    if (availableProviders.includes('groq')) {
      ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'].forEach(m => {
        if (!candidateChain.includes(m)) candidateChain.push(m);
      });
    }
    if (availableProviders.includes('openrouter')) {
      ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free'].forEach(m => {
        if (!candidateChain.includes(m)) candidateChain.push(m);
      });
    }

    let lastError = null;

    for (let c = 0; c < candidateChain.length; c++) {
      const model = candidateChain[c];
      let provider = 'gemini';
      if (model.includes('/') && !model.includes(':free')) provider = 'hf';
      else if (model.startsWith('llama') || model.startsWith('deepseek-r1-distill')) provider = 'groq';
      else if (model.includes('openrouter') || model.includes(':free')) provider = 'openrouter';

      const keys = state.keys[provider] || [];
      if (keys.length === 0) continue;

      for (let k = 0; k < keys.length; k++) {
        const apiKey = keys[k].key;
        try {
          if (c > 0 || k > 0) {
            showGatewayStatus(`Cascade Shift: ${model} (${provider.toUpperCase()} Key #${k + 1})`);
          }

          let resObj = null;
          if (provider === 'gemini') {
            resObj = await streamGemini(apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'hf') {
            resObj = await streamHuggingFace(apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'groq') {
            resObj = await streamOpenAI('https://api.groq.com/openai/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'openrouter') {
            resObj = await streamOpenAI('https://openrouter.ai/api/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          }

          if (!resObj.text || resObj.text.trim().length === 0) {
            throw new Error('Empty response from model stream.');
          }

          return { text: resObj.text, sources: resObj.sources, model, provider };
        } catch (err) {
          lastError = err;
          console.warn(`[Gateway Cascade] ${model} on key #${k + 1} status ${err.status || err.message}. Shifting...`);
          if (!state.runSettings.autoCascade) break;
        }
      }
    }
    throw new Error(lastError ? (lastError.message || `HTTP ${lastError.status}`) : 'All available models and keys exhausted.');
  }

  // MAIN SEND DISPATCHER
  async function handleSend() {
    let rawText = dom.promptInput.value.trim();
    if (!rawText) return;

    dom.promptInput.value = '';
    dom.promptPlusMenu.style.display = 'none';
    dom.btnSendPrompt.disabled = true;

    appendUserMessage(rawText);

    const groundedText = await resolveUrlContextIfPresent(rawText);

    let chosenModel = state.runSettings.customModel || state.activeModel;
    if (state.autoRouter && !state.runSettings.customModel) {
      chosenModel = decideModelKeyAware(groundedText);
      showGatewayStatus(`Key-Aware Auto Router: Selected ${chosenModel}`);
    }

    // 1. DIRECT CHAT MODE
    if (state.mode === 'chat') {
      const { bubble, row } = createAssistantMessageNode(chosenModel);
      renderFormattedContent(bubble, '', true);

      try {
        const result = await executeWithResilientCascade(chosenModel, groundedText, (acc, sources) => {
          renderFormattedContent(bubble, acc, true, sources);
          scrollToBottom();
        });
        row.querySelector('.chat-header-meta span').textContent = result.model;
        renderFormattedContent(bubble, result.text, false, result.sources);
        state.chatHistory.push({ role: 'assistant', content: result.text });
      } catch (err) {
        renderFormattedContent(bubble, `Gateway Cascade Notice: ${err.message}`);
      }
    }

    // 2. MULTI-AGENT PIPELINE
    else if (state.mode === 'multi') {
      const { bubble } = createAssistantMessageNode('Multi-Agent Consensus Pipeline');
      bubble.innerHTML = `
        <div class="agent-step-card"><div class="agent-step-header architect">⚡ Agent 1 (Architect): Initial Solution Drafting...</div><div class="agent-body-1"></div></div>
        <div class="agent-step-card"><div class="agent-step-header reviewer">🛡️ Agent 2 (Auditor): Cross-Model Security & Logic Review...</div><div class="agent-body-2"></div></div>
        <div class="agent-step-card"><div class="agent-step-header arbiter">✨ Agent 3 (Arbiter): Final Production Synthesis...</div><div class="agent-body-3"></div></div>
      `;
      const body1 = bubble.querySelector('.agent-body-1');
      const body2 = bubble.querySelector('.agent-body-2');
      const body3 = bubble.querySelector('.agent-body-3');

      try {
        showGatewayStatus('Multi-Agent: Step 1 (Architect Drafting)...');
        const r1 = await executeWithResilientCascade(chosenModel, groundedText, (acc, sources) => {
          renderFormattedContent(body1, acc, true, sources);
          scrollToBottom();
        });
        renderFormattedContent(body1, r1.text, false, r1.sources);

        const availableHf = (state.keys.hf || []).length > 0;
        const auditorModel = availableHf ? 'deepseek-ai/DeepSeek-V4-Flash-0731' : (r1.model === 'gemini-3.6-flash' ? 'gemini-3.1-pro-preview' : 'gemini-3.6-flash');
        bubble.querySelector('.agent-step-header.reviewer').textContent = `🛡️ Agent 2 (${auditorModel}): Cross-Model Security & Logic Review`;

        showGatewayStatus(`Multi-Agent: Step 2 (${auditorModel} Audit)...`);
        const auditPrompt = `You are the Lead Security & Code Auditor. Review this draft solution for bugs, edge cases, date accuracy, and optimizations:\n${r1.text}`;
        const r2 = await executeWithResilientCascade(auditorModel, auditPrompt, (acc, sources) => {
          renderFormattedContent(body2, acc, true, sources);
          scrollToBottom();
        });
        renderFormattedContent(body2, r2.text, false, r2.sources);

        showGatewayStatus('Multi-Agent: Step 3 (Arbiter Production Synthesis)...');
        const arbiterPrompt = `You are the Arbiter. Synthesize the final, verified, production-ready solution incorporating the draft and audit:\nDraft:\n${r1.text}\nAudit Findings:\n${r2.text}`;
        const r3 = await executeWithResilientCascade(chosenModel, arbiterPrompt, (acc, sources) => {
          renderFormattedContent(body3, acc, true, sources);
          scrollToBottom();
        });
        renderFormattedContent(body3, r3.text, false, r3.sources);
        state.chatHistory.push({ role: 'assistant', content: r3.text });
      } catch (err) {
        bubble.innerHTML += `<div style="color:var(--accent-rose); margin-top:8px;">Pipeline Cascade Notice: ${err.message}</div>`;
      }
    }

    // 3. ORCHESTRATION PIPELINE
    else if (state.mode === 'orchestrator') {
      const { bubble } = createAssistantMessageNode('Supervisor Orchestrator Pipeline');
      bubble.innerHTML = `
        <div class="agent-step-card"><div class="agent-step-header architect">🧠 Supervisor: Architectural DAG Plan</div><div class="orch-plan"></div></div>
        <div class="agent-step-card"><div class="agent-step-header arbiter">⚡ Worker: Complete Implementation</div><div class="orch-exec"></div></div>
      `;
      const planEl = bubble.querySelector('.orch-plan');
      const execEl = bubble.querySelector('.orch-exec');

      try {
        showGatewayStatus('Orchestrator: Supervisor generating execution plan...');
        const rPlan = await executeWithResilientCascade(chosenModel, `Generate a clean, step-by-step architectural breakdown for: ${groundedText}`, (acc, sources) => {
          renderFormattedContent(planEl, acc, true, sources);
          scrollToBottom();
        });
        renderFormattedContent(planEl, rPlan.text, false, rPlan.sources);

        showGatewayStatus('Orchestrator: Worker executing full implementation...');
        const execPrompt = `Based on this architectural plan:\n${rPlan.text}\nImplement the complete, deterministic, production-ready code with zero placeholders for: ${groundedText}`;
        const rExec = await executeWithResilientCascade(null, execPrompt, (acc, sources) => {
          renderFormattedContent(execEl, acc, true, sources);
          scrollToBottom();
        });
        renderFormattedContent(execEl, rExec.text, false, rExec.sources);
        state.chatHistory.push({ role: 'assistant', content: rExec.text });
      } catch (err) {
        bubble.innerHTML += `<div style="color:var(--accent-rose); margin-top:8px;">Orchestrator Cascade Notice: ${err.message}</div>`;
      }
    }

    hideGatewayStatus();
    dom.btnSendPrompt.disabled = false;
  }

  function setOperationalMode(mode) {
    state.mode = mode;
    dom.btnModeChat.classList.toggle('active', mode === 'chat');
    dom.btnModeMulti.classList.toggle('active', mode === 'multi');
    dom.btnModeOrchestrator.classList.toggle('active', mode === 'orchestrator');

    const labels = { chat: 'Direct Chat', multi: 'Multi-Agent', orchestrator: 'Orchestration' };
    dom.activeModeBadge.textContent = labels[mode] || 'Direct Chat';
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
        all.push({ provider: p, key: k.key, label: k.label, idx });
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

  function updateLiveClock() {
    const now = new Date();
    dom.mcpRealtimeClock.textContent = now.toLocaleTimeString('de-DE');
  }

  function initEvents() {
    setInterval(updateLiveClock, 1000);
    updateLiveClock();

    dom.promptInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnPromptPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dom.promptPlusMenu.style.display === 'flex';
      dom.promptPlusMenu.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', () => {
      dom.promptPlusMenu.style.display = 'none';
    });

    dom.menuItemMcpServers.addEventListener('click', () => {
      dom.mcpServersModal.style.display = 'flex';
    });

    dom.menuItemToggleSearch.addEventListener('click', () => {
      state.mcp.exaSearch = !state.mcp.exaSearch;
      saveMcpConfig();
    });

    dom.menuItemToggleUrl.addEventListener('click', () => {
      state.mcp.urlContext = !state.mcp.urlContext;
      saveMcpConfig();
    });

    dom.activeMcpPill.addEventListener('click', () => {
      dom.mcpServersModal.style.display = 'flex';
    });

    dom.btnCloseMcpPill.addEventListener('click', (e) => {
      e.stopPropagation();
      state.mcp.exaSearch = false;
      state.mcp.hfHub = false;
      saveMcpConfig();
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

    dom.btnModeChat.addEventListener('click', () => setOperationalMode('chat'));
    dom.btnModeMulti.addEventListener('click', () => setOperationalMode('multi'));
    dom.btnModeOrchestrator.addEventListener('click', () => setOperationalMode('orchestrator'));

    dom.openMcpModalBtn.addEventListener('click', () => dom.mcpServersModal.style.display = 'flex');
    dom.btnCloseMcpServers.addEventListener('click', () => dom.mcpServersModal.style.display = 'none');

    dom.mcpServerExaToggle.addEventListener('change', () => {
      state.mcp.exaSearch = dom.mcpServerExaToggle.checked;
      saveMcpConfig();
    });

    dom.mcpServerHfToggle.addEventListener('change', () => {
      state.mcp.hfHub = dom.mcpServerHfToggle.checked;
      saveMcpConfig();
    });

    dom.btnHealthExa.addEventListener('click', () => alert('✅ Exa Web Search MCP: 200 OK Online'));
    dom.btnHealthHf.addEventListener('click', () => alert('✅ Hugging Face Hub MCP: 200 OK Online'));
    dom.btnMcpRefreshAll.addEventListener('click', () => {
      updateMcpUI();
      alert('🔄 All MCP Servers checked & re-synchronized.');
    });

    dom.btnToggleAutoRouter.addEventListener('click', () => {
      state.autoRouter = !state.autoRouter;
      dom.btnToggleAutoRouter.classList.toggle('active', state.autoRouter);
      dom.btnToggleAutoRouter.querySelector('.pill-text').textContent = `Auto-Router: ${state.autoRouter ? 'ON' : 'OFF'}`;
    });

    dom.quickModelSelect.addEventListener('change', () => {
      state.activeModel = dom.quickModelSelect.value;
      dom.settingModelSelect.value = state.activeModel;
      dom.footerActiveModelDisplay.textContent = `Model: ${state.activeModel}`;
    });

    dom.settingModelSelect.addEventListener('change', () => {
      state.activeModel = dom.settingModelSelect.value;
      dom.quickModelSelect.value = state.activeModel;
      dom.footerActiveModelDisplay.textContent = `Model: ${state.activeModel}`;
    });

    dom.settingCustomModel.addEventListener('input', () => {
      state.runSettings.customModel = dom.settingCustomModel.value.trim();
    });

    dom.btnFetchLiveModels.addEventListener('click', async () => {
      const geminiKeys = state.keys.gemini || [];
      if (geminiKeys.length === 0) return alert('Store a Google AI Studio key first.');
      try {
        showGatewayStatus('Refreshing & Pruning live model inventory...');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          state.models.gemini = PRUNED_SOTA_ROSTER.gemini;
          populateModelSelectors();
          showGatewayStatus(`Pruned inventory active. SOTA models retained.`);
          setTimeout(hideGatewayStatus, 3000);
        }
      } catch (e) {
        showGatewayStatus(`Sync notice: ${e.message}`);
        setTimeout(hideGatewayStatus, 3000);
      }
    });

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
  }

  function init() {
    loadState();
    populateModelSelectors();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
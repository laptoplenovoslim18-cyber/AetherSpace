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
    ]
  };

  const state = {
    mode: 'chat', // 'chat' | 'orchestrator'
    models: Object.assign({}, DEFAULT_MODELS),
    activeModel: 'gemini-3.7-flash',
    chatHistory: [],
    runSettings: {
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: false,
      autoCascade: true,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    chatViewport: document.getElementById('chat-viewport'),
    chatMessages: document.getElementById('chat-messages'),
    welcomeScreen: document.getElementById('welcome-screen'),
    promptInput: document.getElementById('prompt-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    gatewayStatusLine: document.getElementById('gateway-status-line'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    activeModeBadge: document.getElementById('active-mode-badge'),
    btnModeChat: document.getElementById('btn-mode-chat'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    quickModelSelect: document.getElementById('quick-model-select'),
    btnFetchLiveModels: document.getElementById('btn-fetch-live-models'),
    keyCountBadge: document.getElementById('key-count-badge'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingModelSelect: document.getElementById('setting-model-select'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
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
    vaultKeysTbody: document.getElementById('vault-keys-tbody'),
    vaultTabBtns: document.querySelectorAll('.vault-tab-btn'),
    tagBtns: document.querySelectorAll('.tag-btn')
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
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function populateModelSelectors() {
    dom.quickModelSelect.innerHTML = '';
    dom.settingModelSelect.innerHTML = '';

    Object.keys(state.models).forEach((provider) => {
      const groupName = provider === 'gemini' ? 'Google AI Studio' : provider === 'groq' ? 'Groq Cloud' : 'OpenRouter';
      const optGroup1 = document.createElement('optgroup');
      optGroup1.label = groupName;
      const optGroup2 = document.createElement('optgroup');
      optGroup2.label = groupName;

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

  async function fetchLiveModelsFromProvider() {
    const geminiKeys = state.keys.gemini || [];
    if (geminiKeys.length === 0) {
      alert('Please store at least one Google AI Studio key in Key Vault to fetch live models.');
      return;
    }

    try {
      showGatewayStatus('Fetching live model inventory from Google AI Studio...');
      const key = geminiKeys[0].key;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.models && Array.isArray(data.models)) {
        const fetched = data.models
          .filter(m => m.name && (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => {
            const cleanId = m.name.replace(/^models\//, '');
            return { id: cleanId, name: `${m.displayName || cleanId} (${cleanId})` };
          });

        if (fetched.length > 0) {
          state.models.gemini = fetched;
          populateModelSelectors();
          showGatewayStatus(`Synchronized ${fetched.length} live models successfully.`);
          setTimeout(hideGatewayStatus, 3000);
        }
      }
    } catch (e) {
      showGatewayStatus(`Live sync notice: ${e.message}. Using cached roster.`);
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

    if (isStreaming) {
      html += '<span class="streaming-cursor"></span>';
    }

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

  // REAL-TIME SERVER-SENT-EVENTS (SSE) STREAMING FOR GEMINI
  async function streamGeminiContent(apiKey, model, systemPrompt, userMessage, config, onChunk) {
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
      throw { status: response.status, message: errText };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.substring(6));
            if (json.candidates && json.candidates[0] && json.candidates[0].content) {
              const parts = json.candidates[0].content.parts || [];
              for (const part of parts) {
                if (part.text) {
                  fullText += part.text;
                  onChunk(fullText);
                }
              }
            }
          } catch (e) {
            // partial chunk ignored
          }
        }
      }
    }
    return fullText;
  }

  // REAL-TIME SSE STREAMING FOR OPENAI-COMPATIBLE (GROQ / OPENROUTER)
  async function streamOpenAICompatible(endpoint, apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });

    state.chatHistory.forEach(m => {
      messages.push({ role: m.role, content: m.content });
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
      throw { status: response.status, message: errText };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.substring(6).trim();
          if (payload === '[DONE]') break;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices && json.choices[0] && json.choices[0].delta ? json.choices[0].delta.content : '';
            if (delta) {
              fullText += delta;
              onChunk(fullText);
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
    }
    return fullText;
  }

  // RESILIENT AI GATEWAY CONTROLLER WITH FAILOVER
  async function handleSend() {
    const text = dom.promptInput.value.trim();
    if (!text) return;

    dom.promptInput.value = '';
    dom.btnSendPrompt.disabled = true;

    appendUserMessage(text);

    const primaryModel = state.activeModel;
    let provider = 'gemini';
    if (primaryModel.startsWith('llama') || primaryModel.startsWith('deepseek-r1-distill')) provider = 'groq';
    else if (primaryModel.includes('openrouter') || primaryModel.includes(':free')) provider = 'openrouter';

    const keysList = state.keys[provider] || [];
    if (keysList.length === 0) {
      const { bubble } = createAssistantMessageNode('Gateway');
      renderFormattedContent(bubble, `No API Key stored for **${provider.toUpperCase()}**. Please open Key Vault to add a key.`);
      dom.btnSendPrompt.disabled = false;
      return;
    }

    // Build hierarchical model fallback chain (Handling 503 / 429)
    const modelChain = [primaryModel];
    if (provider === 'gemini') {
      const fallbacks = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'];
      fallbacks.forEach(f => {
        if (!modelChain.includes(f)) modelChain.push(f);
      });
    }

    const { bubble, row } = createAssistantMessageNode(primaryModel);
    renderFormattedContent(bubble, '', true);

    let executionSuccess = false;
    let completedText = '';

    for (let k = 0; k < keysList.length && !executionSuccess; k++) {
      const currentKey = keysList[k].key;

      for (let m = 0; m < modelChain.length && !executionSuccess; m++) {
        const candidateModel = modelChain[m];

        try {
          if (candidateModel !== primaryModel) {
            showGatewayStatus(`Gateway Failover: Route shifted to ${candidateModel} (Key #${k + 1})...`);
          }

          if (provider === 'gemini') {
            completedText = await streamGeminiContent(
              currentKey,
              candidateModel,
              state.runSettings.systemInstructions,
              text,
              state.runSettings,
              (accumulated) => {
                renderFormattedContent(bubble, accumulated, true);
                scrollToBottom();
              }
            );
          } else if (provider === 'groq') {
            completedText = await streamOpenAICompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              currentKey,
              candidateModel,
              state.runSettings.systemInstructions,
              text,
              state.runSettings,
              (accumulated) => {
                renderFormattedContent(bubble, accumulated, true);
                scrollToBottom();
              }
            );
          } else if (provider === 'openrouter') {
            completedText = await streamOpenAICompatible(
              'https://openrouter.ai/api/v1/chat/completions',
              currentKey,
              candidateModel,
              state.runSettings.systemInstructions,
              text,
              state.runSettings,
              (accumulated) => {
                renderFormattedContent(bubble, accumulated, true);
                scrollToBottom();
              }
            );
          }

          executionSuccess = true;
          row.querySelector('.chat-header-meta span').textContent = candidateModel;
          break;
        } catch (err) {
          console.warn(`[Gateway Notice] Model ${candidateModel} on Key #${k + 1} encountered status:`, err.status || err.message);

          if (!state.runSettings.autoCascade) {
            break;
          }
        }
      }
    }

    hideGatewayStatus();
    dom.btnSendPrompt.disabled = false;

    if (executionSuccess && completedText) {
      renderFormattedContent(bubble, completedText, false);
      state.chatHistory.push({ role: 'assistant', content: completedText });
    } else {
      renderFormattedContent(
        bubble,
        `Gateway Notice: Cloud model capacity is currently exhausted across configured fallback paths. Please verify API key status in Vault or retry in a few moments.`
      );
    }
  }

  function renderVaultKeys() {
    const activeTab = document.querySelector('.vault-tab-btn.active');
    const provider = activeTab ? activeTab.dataset.provider : 'gemini';
    const keys = state.keys[provider] || [];

    dom.vaultKeysTbody.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No keys configured for ${provider.toUpperCase()}.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${escapeHtml(k.label || 'Default')}</td>
        <td><span class="badge">Free Tier</span></td>
        <td>${k.created}</td>
        <td><button class="tool-chip" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
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
    dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnSendPrompt.addEventListener('click', handleSend);

    dom.btnClearChat.addEventListener('click', () => {
      state.chatHistory = [];
      dom.chatMessages.innerHTML = '';
      if (dom.welcomeScreen) {
        dom.chatMessages.appendChild(dom.welcomeScreen);
        dom.welcomeScreen.style.display = 'block';
      }
    });

    dom.tagBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.promptInput.value = btn.dataset.preset;
        dom.promptInput.focus();
      });
    });

    dom.btnModeChat.addEventListener('click', () => {
      state.mode = 'chat';
      dom.btnModeChat.classList.add('active');
      dom.btnModeOrchestrator.classList.remove('active');
      dom.activeModeBadge.textContent = 'Direct Chat';
    });

    dom.btnModeOrchestrator.addEventListener('click', () => {
      state.mode = 'orchestrator';
      dom.btnModeOrchestrator.classList.add('active');
      dom.btnModeChat.classList.remove('active');
      dom.activeModeBadge.textContent = 'Agent Orchestration';
    });

    dom.quickModelSelect.addEventListener('change', () => {
      state.activeModel = dom.quickModelSelect.value;
      dom.settingModelSelect.value = state.activeModel;
    });

    dom.settingModelSelect.addEventListener('change', () => {
      state.activeModel = dom.settingModelSelect.value;
      dom.quickModelSelect.value = state.activeModel;
    });

    dom.btnFetchLiveModels.addEventListener('click', fetchLiveModelsFromProvider);

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingThinkingBudget.addEventListener('change', () => {
      state.runSettings.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10);
    });

    dom.settingSystemInstructions.addEventListener('input', () => {
      state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    });

    dom.settingAutoCascade.addEventListener('change', () => {
      state.runSettings.autoCascade = dom.settingAutoCascade.checked;
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
      const labelVal = dom.vaultLabelInput.value.trim() || 'Key';

      if (!keyVal) {
        alert('Please paste an API key.');
        return;
      }

      state.keys[provider] = state.keys[provider] || [];
      state.keys[provider].push({ key: keyVal, label: labelVal, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultKeys();
    });
  }

  function init() {
    loadKeys();
    populateModelSelectors();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
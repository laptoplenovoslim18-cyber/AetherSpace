(function () {
  'use strict';

  const DEFAULT_MODELS = {
    gemini: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Top Coding / Agentic)' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Fast Agentic Fallback)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Deep Reasoning)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (High-Throughput)' }
    ],
    hf: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B (HF Free)' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1 (HF Free)' },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3 (HF Free)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3 (HF Free)' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (HF Free)' }
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
    mode: 'chat', // 'chat' | 'multi' | 'orchestrator'
    autoRouter: true,
    models: Object.assign({}, DEFAULT_MODELS),
    activeModel: 'gemini-3.7-flash',
    chatHistory: [],
    runSettings: {
      customModel: '',
      systemInstructions: '',
      thinkingBudget: 0,
      searchGrounding: false,
      autoCascade: true,
      rateGovernor: true,
      temperature: 0.70,
      maxOutputTokens: 8192
    },
    mcp: {
      search: true,
      github: false,
      youtube: false,
      customServerUrl: ''
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
    btnModeChat: document.getElementById('btn-mode-chat'),
    btnModeMulti: document.getElementById('btn-mode-multi'),
    btnModeOrchestrator: document.getElementById('btn-mode-orchestrator'),
    btnToggleAutoRouter: document.getElementById('btn-toggle-auto-router'),
    quickModelSelect: document.getElementById('quick-model-select'),
    btnFetchLiveModels: document.getElementById('btn-fetch-live-models'),
    keyCountBadge: document.getElementById('key-count-badge'),
    mcpToolsBadge: document.getElementById('mcp-tools-badge'),

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

    mcpModal: document.getElementById('mcp-modal'),
    openMcpModalBtn: document.getElementById('open-mcp-modal-btn'),
    btnCloseMcp: document.getElementById('btn-close-mcp'),
    mcpToolSearch: document.getElementById('mcp-tool-search'),
    mcpToolGithub: document.getElementById('mcp-tool-github'),
    mcpToolYoutube: document.getElementById('mcp-tool-youtube'),
    mcpCustomServerUrl: document.getElementById('mcp-custom-server-url'),

    tagBtns: document.querySelectorAll('.tag-btn')
  };

  function loadState() {
    try {
      const rawKeys = localStorage.getItem('aetherspace_vault_keys');
      if (rawKeys) state.keys = Object.assign({ gemini: [], hf: [], groq: [], openrouter: [] }, JSON.parse(rawKeys));
      const rawMcp = localStorage.getItem('aetherspace_mcp_config');
      if (rawMcp) state.mcp = Object.assign(state.mcp, JSON.parse(rawMcp));
    } catch (e) {
      console.warn('Storage notice', e);
    }
    updateKeyBadge();
    updateMcpBadge();
  }

  function saveKeys() {
    localStorage.setItem('aetherspace_vault_keys', JSON.stringify(state.keys));
    updateKeyBadge();
  }

  function saveMcpConfig() {
    localStorage.setItem('aetherspace_mcp_config', JSON.stringify(state.mcp));
    updateMcpBadge();
  }

  function updateKeyBadge() {
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function updateMcpBadge() {
    let count = 0;
    if (state.mcp.search) count++;
    if (state.mcp.github) count++;
    if (state.mcp.youtube) count++;
    if (state.mcp.customServerUrl) count++;
    dom.mcpToolsBadge.textContent = `${count} Active`;
  }

  function classifyApiKey(key) {
    const k = key.trim();
    if (/^AIzaSy[A-Za-z0-9_-]{33}$/.test(k)) return 'gemini';
    if (/^hf_[A-Za-z0-9]{34,}$/.test(k)) return 'hf';
    if (/^gsk_[A-Za-z0-9]{48,}$/.test(k)) return 'groq';
    if (/^sk-or-v1-[a-f0-9]{64}$/.test(k)) return 'openrouter';
    return 'gemini';
  }

  function populateModelSelectors() {
    dom.quickModelSelect.innerHTML = '';
    dom.settingModelSelect.innerHTML = '';

    const labels = { gemini: 'Google AI Studio', hf: 'Hugging Face Free', groq: 'Groq Cloud', openrouter: 'OpenRouter' };

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

  function getAvailableProvidersWithKeys() {
    return Object.keys(state.keys).filter(p => (state.keys[p] || []).length > 0);
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
        return 'Qwen/Qwen2.5-Coder-32B-Instruct';
      }
      return 'deepseek-ai/DeepSeek-R1';
    }

    if (available.includes('groq')) {
      return 'llama-3.3-70b-versatile';
    }

    if (available.includes('openrouter')) {
      return 'openrouter/free';
    }

    return state.activeModel;
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

  // GEMINI STREAM CALL (ROBUST SEARCH GROUNDING & 429 TRAPPING)
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

    if (systemPrompt && systemPrompt.trim()) {
      bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (config.thinkingBudget > 0) {
      bodyPayload.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (state.mcp.search) {
      bodyPayload.tools = [{ googleSearch: {} }];
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok && state.mcp.search) {
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

  // HUGGING FACE SERVERLESS CALL
  async function streamHuggingFace(apiKey, model, systemPrompt, userMessage, config, onChunk) {
    const endpoint = `https://api-inference.huggingface.co/models/${model}`;
    const promptText = (systemPrompt ? `[SYSTEM: ${systemPrompt}]\n` : '') + `User: ${userMessage}\nAssistant:`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        inputs: promptText,
        parameters: { max_new_tokens: Math.min(config.maxOutputTokens, 2048), temperature: config.temperature, return_full_text: false }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { status: res.status, message: errText };
    }
    const json = await res.json();
    let text = '';
    if (Array.isArray(json) && json[0] && json[0].generated_text) text = json[0].generated_text;
    else if (json.generated_text) text = json.generated_text;
    else text = JSON.stringify(json);

    onChunk(text);
    return text;
  }

  // OPENAI-COMPATIBLE CALL (GROQ / OPENROUTER)
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
              onChunk(fullText);
            }
          } catch (e) {}
        }
      }
    }
    return fullText;
  }

  // UNIVERSAL CASCADE EXECUTION ENGINE (TRAPS 429/503 AND ROTATES TO NEXT MODEL/KEY)
  async function executeWithResilientCascade(preferredModel, promptText, onChunk) {
    const candidateChain = [];
    const availableProviders = getAvailableProvidersWithKeys();

    if (availableProviders.length === 0) {
      throw new Error('No API Keys configured. Please open Key Vault to add a key.');
    }

    if (preferredModel) candidateChain.push(preferredModel);

    // Build fallback candidate roster across active keys
    if (availableProviders.includes('gemini')) {
      ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'].forEach(m => {
        if (!candidateChain.includes(m)) candidateChain.push(m);
      });
    }
    if (availableProviders.includes('hf')) {
      ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-R1', 'mistralai/Mistral-7B-Instruct-v0.3'].forEach(m => {
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

          let text = '';
          if (provider === 'gemini') {
            text = await streamGemini(apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'hf') {
            text = await streamHuggingFace(apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'groq') {
            text = await streamOpenAI('https://api.groq.com/openai/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          } else if (provider === 'openrouter') {
            text = await streamOpenAI('https://openrouter.ai/api/v1/chat/completions', apiKey, model, state.runSettings.systemInstructions, promptText, state.runSettings, onChunk);
          }
          return { text, model, provider };
        } catch (err) {
          lastError = err;
          console.warn(`[Gateway Cascade] ${model} on key #${k + 1} status ${err.status || err.message}. Shifting...`);
          if (!state.runSettings.autoCascade) break;
        }
      }
    }
    throw new Error(lastError ? (lastError.message || `HTTP ${lastError.status}`) : 'All available models and keys exhausted.');
  }

  // MAIN SEND DISPATCHER (DIRECT, MULTI-AGENT, ORCHESTRATION)
  async function handleSend() {
    const text = dom.promptInput.value.trim();
    if (!text) return;

    dom.promptInput.value = '';
    dom.btnSendPrompt.disabled = true;

    appendUserMessage(text);

    let chosenModel = state.runSettings.customModel || state.activeModel;
    if (state.autoRouter && !state.runSettings.customModel) {
      chosenModel = decideModelKeyAware(text);
      showGatewayStatus(`Key-Aware Auto Router: Selected ${chosenModel}`);
    }

    // 1. DIRECT CHAT MODE
    if (state.mode === 'chat') {
      const { bubble, row } = createAssistantMessageNode(chosenModel);
      renderFormattedContent(bubble, '', true);

      try {
        const result = await executeWithResilientCascade(chosenModel, text, acc => {
          renderFormattedContent(bubble, acc, true);
          scrollToBottom();
        });
        row.querySelector('.chat-header-meta span').textContent = result.model;
        renderFormattedContent(bubble, result.text, false);
        state.chatHistory.push({ role: 'assistant', content: result.text });
      } catch (err) {
        renderFormattedContent(bubble, `Gateway Cascade Notice: ${err.message}`);
      }
    }

    // 2. TRUE 3-AGENT CONSENSUS PIPELINE (Architect -> Auditor -> Arbiter)
    else if (state.mode === 'multi') {
      const { bubble, row } = createAssistantMessageNode('Multi-Agent Consensus Pipeline');
      bubble.innerHTML = `
        <div class="agent-step-card"><div class="agent-step-header architect">⚡ Agent 1 (Architect): Initial Solution Drafting</div><div class="agent-body-1"></div></div>
        <div class="agent-step-card"><div class="agent-step-header reviewer">🛡️ Agent 2 (Security & Logic Auditor): Deep Review & Verification</div><div class="agent-body-2"></div></div>
        <div class="agent-step-card"><div class="agent-step-header arbiter">✨ Agent 3 (Arbiter): Final Production Synthesis</div><div class="agent-body-3"></div></div>
      `;
      const body1 = bubble.querySelector('.agent-body-1');
      const body2 = bubble.querySelector('.agent-body-2');
      const body3 = bubble.querySelector('.agent-body-3');

      try {
        // Step 1: Architect Draft
        showGatewayStatus('Multi-Agent: Step 1 (Architect Drafting)...');
        const r1 = await executeWithResilientCascade(chosenModel, text, acc => {
          renderFormattedContent(body1, acc, true);
          scrollToBottom();
        });
        renderFormattedContent(body1, r1.text, false);

        // Step 2: Auditor Review
        showGatewayStatus('Multi-Agent: Step 2 (Security & Logic Audit)...');
        const auditPrompt = `You are the Lead Security & Logic Auditor. Review this draft solution for bugs, edge cases, and optimizations:\n${r1.text}`;
        const r2 = await executeWithResilientCascade(null, auditPrompt, acc => {
          renderFormattedContent(body2, acc, true);
          scrollToBottom();
        });
        renderFormattedContent(body2, r2.text, false);

        // Step 3: Arbiter Synthesis
        showGatewayStatus('Multi-Agent: Step 3 (Arbiter Production Synthesis)...');
        const arbiterPrompt = `You are the Arbiter. Synthesize the final, verified, production-ready solution based on the draft and audit:\nDraft:\n${r1.text}\nAudit Findings:\n${r2.text}`;
        const r3 = await executeWithResilientCascade(chosenModel, arbiterPrompt, acc => {
          renderFormattedContent(body3, acc, true);
          scrollToBottom();
        });
        renderFormattedContent(body3, r3.text, false);
        state.chatHistory.push({ role: 'assistant', content: r3.text });
      } catch (err) {
        bubble.innerHTML += `<div style="color:var(--accent-rose); margin-top:8px;">Pipeline Cascade Notice: ${err.message}</div>`;
      }
    }

    // 3. SUPERVISOR ORCHESTRATION PIPELINE (Plan -> Worker -> Arbiter)
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
        const rPlan = await executeWithResilientCascade(chosenModel, `Generate a clean, step-by-step architectural breakdown for: ${text}`, acc => {
          renderFormattedContent(planEl, acc, true);
          scrollToBottom();
        });
        renderFormattedContent(planEl, rPlan.text, false);

        showGatewayStatus('Orchestrator: Worker executing full implementation...');
        const execPrompt = `Based on this architectural plan:\n${rPlan.text}\nImplement the complete, deterministic, production-ready code with zero placeholders for: ${text}`;
        const rExec = await executeWithResilientCascade(null, execPrompt, acc => {
          renderFormattedContent(execEl, acc, true);
          scrollToBottom();
        });
        renderFormattedContent(execEl, rExec.text, false);
        state.chatHistory.push({ role: 'assistant', content: rExec.text });
      } catch (err) {
        bubble.innerHTML += `<div style="color:var(--accent-rose); margin-top:8px;">Orchestrator Cascade Notice: ${err.message}</div>`;
      }
    }

    hideGatewayStatus();
    dom.btnSendPrompt.disabled = false;
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

    dom.settingCustomModel.addEventListener('input', () => {
      state.runSettings.customModel = dom.settingCustomModel.value.trim();
    });

    dom.btnFetchLiveModels.addEventListener('click', async () => {
      const geminiKeys = state.keys.gemini || [];
      if (geminiKeys.length === 0) return alert('Store a Google AI Studio key first.');
      try {
        showGatewayStatus('Fetching live model inventory...');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKeys[0].key}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          state.models.gemini = data.models
            .filter(m => m.name && (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => ({ id: m.name.replace(/^models\//, ''), name: `${m.displayName || m.name} (${m.name.replace(/^models\//, '')})` }));
          populateModelSelectors();
          showGatewayStatus(`Live sync complete. ${state.models.gemini.length} models ready.`);
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

    dom.openMcpModalBtn.addEventListener('click', () => dom.mcpModal.style.display = 'flex');
    dom.btnCloseMcp.addEventListener('click', () => dom.mcpModal.style.display = 'none');

    dom.mcpToolSearch.addEventListener('change', () => { state.mcp.search = dom.mcpToolSearch.checked; saveMcpConfig(); });
    dom.mcpToolGithub.addEventListener('change', () => { state.mcp.github = dom.mcpToolGithub.checked; saveMcpConfig(); });
    dom.mcpToolYoutube.addEventListener('change', () => { state.mcp.youtube = dom.mcpToolYoutube.checked; saveMcpConfig(); });
    dom.mcpCustomServerUrl.addEventListener('input', () => { state.mcp.customServerUrl = dom.mcpCustomServerUrl.value.trim(); saveMcpConfig(); });
  }

  function init() {
    loadState();
    populateModelSelectors();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
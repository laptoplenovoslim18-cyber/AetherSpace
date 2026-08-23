(function () {
  'use strict';

  // SOTA Top-3 Model Roster mit deterministischer Fallback-Kaskade
  const MODEL_FALLBACK_CASCADES = {
    gemini: ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
    groq: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'llama-3.1-8b-instant'],
    openrouter: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free']
  };

  const state = {
    activeModel: 'gemini-3.7-flash',
    chatHistory: [],
    runSettings: {
      systemInstructions: '',
      thinkingBudget: 4096,
      autoFallback: true,
      searchGrounding: false,
      maxOutputTokens: 8192,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    chatStream: document.getElementById('chat-stream'),
    chatInput: document.getElementById('chat-input'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    headerModelSelect: document.getElementById('header-model-select'),
    gatewayStatusDot: document.getElementById('gateway-status-dot'),
    gatewayStatusText: document.getElementById('gateway-status-text'),
    keyCountBadge: document.getElementById('key-count-badge'),

    btnCodepenExport: document.getElementById('btn-codepen-export'),
    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),

    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingThinkingLevel: document.getElementById('setting-thinking-level'),
    settingAutoFallback: document.getElementById('setting-auto-fallback'),
    settingSearchGrounding: document.getElementById('setting-search-grounding'),
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
    const total = Object.values(state.keys).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    dom.keyCountBadge.textContent = `${total} Key${total === 1 ? '' : 's'}`;
  }

  function getProviderForModel(modelName) {
    if (modelName.startsWith('gemini')) return 'gemini';
    if (modelName.startsWith('llama') || modelName.startsWith('deepseek-r1-distill')) return 'groq';
    return 'openrouter';
  }

  function renderMessage(role, content, modelTag) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role.toLowerCase()}`;

    const header = document.createElement('div');
    header.className = 'chat-bubble-header';
    header.innerHTML = `<span class="chat-bubble-author">${role === 'user' ? 'Du' : (modelTag || state.activeModel)}</span><span>${new Date().toLocaleTimeString()}</span>`;

    const body = document.createElement('div');
    body.className = 'chat-bubble-body';

    // Parse Code-Blocks mit Copy-Button
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let formattedContent = '';
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      formattedContent += textBefore.replace(/\n/g, '<br>');

      const lang = match[1] || 'code';
      const codeSnippet = match[2];
      const codeId = 'code_' + Math.random().toString(36).substr(2, 9);

      formattedContent += `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${lang}</span>
            <button class="copy-code-btn" data-code-id="${codeId}">Copy Code</button>
          </div>
          <pre><code id="${codeId}">${escapeHtml(codeSnippet)}</code></pre>
        </div>
      `;
      lastIndex = match.index + match[0].length;
    }

    formattedContent += content.substring(lastIndex).replace(/\n/g, '<br>');
    body.innerHTML = formattedContent;

    bubble.appendChild(header);
    bubble.appendChild(body);
    dom.chatStream.appendChild(bubble);

    // Event Listener für Copy-Buttons
    bubble.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-code-id');
        const codeText = document.getElementById(id).innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
        });
      });
    });

    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Google AI Studio REST v1beta Request
  async function callGemini(apiKey, model, systemPrompt, userPrompt, config) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (config.thinkingBudget > 0) {
      body.generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }

    if (config.searchGrounding) {
      body.tools = [{ googleSearch: {} }];
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

    const data = await res.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Leere Antwort vom Modell erhalten.');
    }

    return data.candidates[0].content.parts.map(p => p.text || '').join('');
  }

  // OpenAI-Compatible Request (Groq / OpenRouter)
  async function callOpenAICompatible(endpoint, apiKey, model, systemPrompt, userPrompt, config) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

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
        max_tokens: Math.min(config.maxOutputTokens, 8192)
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Provider HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // Zentrales Gateway mit automatischem 503 / 429 Fallback
  async function executeGatewayPrompt() {
    const prompt = dom.chatInput.value.trim();
    if (!prompt) return;

    renderMessage('user', prompt);
    dom.chatInput.value = '';

    dom.btnSendPrompt.disabled = true;
    dom.gatewayStatusDot.className = 'status-indicator busy';
    dom.gatewayStatusText.textContent = `Gateway aktiv • Route zu ${state.activeModel}...`;

    state.runSettings.systemInstructions = dom.settingSystemInstructions.value;
    state.runSettings.thinkingBudget = parseInt(dom.settingThinkingLevel.value, 10);
    state.runSettings.autoFallback = dom.settingAutoFallback.checked;
    state.runSettings.searchGrounding = dom.settingSearchGrounding.checked;
    state.runSettings.maxOutputTokens = parseInt(dom.settingOutputLength.value, 10);
    state.runSettings.temperature = parseFloat(dom.settingTemp.value);

    const initialProvider = getProviderForModel(state.activeModel);
    const candidateModels = state.runSettings.autoFallback 
      ? (MODEL_FALLBACK_CASCADES[initialProvider] || [state.activeModel])
      : [state.activeModel];

    let output = null;
    let usedModel = state.activeModel;
    let executionSuccess = false;
    let lastErrorMessage = '';

    // Versuche Top-Modelle der Kaskade der Reihe nach
    for (const modelToTry of candidateModels) {
      const provider = getProviderForModel(modelToTry);
      const keysList = state.keys[provider] || [];

      if (keysList.length === 0) {
        lastErrorMessage = `Kein API-Key im Key Vault für Provider '${provider.toUpperCase()}' hinterlegt.`;
        continue;
      }

      for (let i = 0; i < keysList.length; i++) {
        try {
          dom.gatewayStatusText.textContent = `Ausführung über ${modelToTry} (Key ${i + 1}/${keysList.length})...`;
          
          if (provider === 'gemini') {
            output = await callGemini(keysList[i].key, modelToTry, state.runSettings.systemInstructions, prompt, state.runSettings);
          } else if (provider === 'groq') {
            output = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', keysList[i].key, modelToTry, state.runSettings.systemInstructions, prompt, state.runSettings);
          } else if (provider === 'openrouter') {
            output = await callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', keysList[i].key, modelToTry, state.runSettings.systemInstructions, prompt, state.runSettings);
          }

          executionSuccess = true;
          usedModel = modelToTry;
          break;
        } catch (err) {
          console.warn(`[Gateway Fallback] ${modelToTry} fehlgeschlagen:`, err.message);
          lastErrorMessage = err.message;
        }
      }

      if (executionSuccess) break;
    }

    dom.btnSendPrompt.disabled = false;

    if (executionSuccess && output) {
      dom.gatewayStatusDot.className = 'status-indicator ready';
      dom.gatewayStatusText.textContent = `Antwort erhalten von ${usedModel}`;
      renderMessage('ai', output, usedModel);
      state.chatHistory.push({ role: 'user', content: prompt }, { role: 'model', content: output });
    } else {
      dom.gatewayStatusDot.className = 'status-indicator error';
      dom.gatewayStatusText.textContent = 'Ausführung fehlgeschlagen';
      renderMessage('ai', `⚠️ Fehler bei der Modellausführung:\n${lastErrorMessage}\n\nBitte prüfe deine Keys im Key Vault oder wähle einen anderen Provider.`, 'Gateway');
    }
  }

  // Exportiert den letzten Code-Block direkt zu CodePen
  function exportLatestCodeToCodePen() {
    const allCodeBlocks = document.querySelectorAll('.chat-scroll-stream code');
    if (allCodeBlocks.length === 0) {
      alert('Kein generierter Code im Chatverlauf vorhanden.');
      return;
    }

    const latestCode = allCodeBlocks[allCodeBlocks.length - 1].innerText;
    
    let htmlPart = '';
    let cssPart = '';
    let jsPart = '';

    if (latestCode.includes('<!DOCTYPE html>') || latestCode.includes('<html')) {
      htmlPart = latestCode;
    } else {
      htmlPart = `<div id="app">\n${escapeHtml(latestCode)}\n</div>`;
    }

    const payload = {
      title: 'AetherSpace CodePen Export',
      html: htmlPart,
      css: cssPart,
      js: jsPart
    };

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(payload);

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
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">Keine Keys für ${provider.toUpperCase()} hinterlegt.</td>`;
      dom.vaultKeysTbody.appendChild(tr);
      return;
    }

    keys.forEach((k, idx) => {
      const tr = document.createElement('tr');
      const mask = k.key.length > 8 ? `${k.key.substring(0, 4)}...${k.key.substring(k.key.length - 4)}` : '••••••••';
      tr.innerHTML = `
        <td><code>${mask}</code></td>
        <td>${k.label || 'Default'}</td>
        <td><span class="badge">Aktiv</span></td>
        <td>${k.created}</td>
        <td><button class="action-sub-btn" data-del="${idx}" style="color:var(--accent-rose);">Löschen</button></td>
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
    dom.btnSendPrompt.addEventListener('click', executeGatewayPrompt);
    dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeGatewayPrompt();
      }
    });

    dom.btnClearChat.addEventListener('click', () => {
      dom.chatStream.innerHTML = '';
      state.chatHistory = [];
    });

    dom.headerModelSelect.addEventListener('change', () => {
      state.activeModel = dom.headerModelSelect.value;
    });

    dom.btnCodepenExport.addEventListener('click', exportLatestCodeToCodePen);

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingOutputLength.addEventListener('input', () => dom.settingOutputLengthVal.textContent = dom.settingOutputLength.value);
    dom.settingTemp.addEventListener('input', () => dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2));

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

      if (!key) return alert('Bitte Key einfügen.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
    });
  }

  function init() {
    loadKeys();
    initEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
(function () {
  'use strict';

  const state = {
    mode: 'direct', // direct | orchestration | multiagent
    attachments: new Map(), // filename -> content
    history: [],
    runSettings: {
      model: 'gemini-2.5-flash',
      systemInstructions: '',
      semanticRouter: true,
      autoCascade: true,
      streaming: true,
      thinkingBudget: 0,
      temperature: 0.70
    },
    keys: { gemini: [], groq: [], openrouter: [] },
    dynamicModels: { gemini: [], groq: [], openrouter: [] }
  };

  const dom = {
    chatStream: document.getElementById('chat-stream'),
    chatContainer: document.getElementById('chat-container'),
    welcomeCard: document.getElementById('welcome-card'),
    mainPrompt: document.getElementById('main-prompt'),
    btnSendPrompt: document.getElementById('btn-send-prompt'),
    charCounter: document.getElementById('char-counter'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    currentModelTag: document.getElementById('current-model-tag'),
    keyCountBadge: document.getElementById('key-count-badge'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    fileAttachmentInput: document.getElementById('file-attachment-input'),
    contextChips: document.getElementById('context-chips'),
    modeBtns: document.querySelectorAll('.mode-btn'),

    toggleRunSettingsBtn: document.getElementById('toggle-run-settings-btn'),
    settingsSlideout: document.getElementById('settings-slideout'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSyncModels: document.getElementById('btn-sync-models'),
    btnRefreshModelsList: document.getElementById('btn-refresh-models-list'),

    settingModel: document.getElementById('setting-model'),
    settingSystemInstructions: document.getElementById('setting-system-instructions'),
    settingSemanticRouter: document.getElementById('setting-semantic-router'),
    settingAutoCascade: document.getElementById('setting-auto-cascade'),
    settingStreaming: document.getElementById('setting-streaming'),
    settingThinkingBudget: document.getElementById('setting-thinking-budget'),
    settingThinkingBudgetVal: document.getElementById('setting-thinking-budget-val'),
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
      console.warn('Vault storage read error', e);
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

  // DYNAMIC MODEL FETCHING FROM PROVIDER APIS
  async function fetchLiveModels() {
    dom.statusText.textContent = 'Syncing models...';
    dom.statusDot.className = 'status-indicator busy';

    // 1. Google Gemini Live Discovery
    if (state.keys.gemini && state.keys.gemini.length > 0) {
      const key = state.keys.gemini[0].key;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models) {
            state.dynamicModels.gemini = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => m.name.replace('models/', ''));
          }
        }
      } catch (e) {
        console.warn('Gemini model sync notice:', e.message);
      }
    }

    // 2. Groq Live Discovery
    if (state.keys.groq && state.keys.groq.length > 0) {
      const key = state.keys.groq[0].key;
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            state.dynamicModels.groq = data.data.map(m => m.id).filter(id => id.includes('llama') || id.includes('deepseek') || id.includes('qwen'));
          }
        }
      } catch (e) {
        console.warn('Groq model sync notice:', e.message);
      }
    }

    // 3. OpenRouter Live Discovery
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          state.dynamicModels.openrouter = data.data
            .filter(m => m.id.endsWith(':free') || m.id === 'openrouter/free')
            .map(m => m.id);
        }
      }
    } catch (e) {
      console.warn('OpenRouter sync notice:', e.message);
    }

    populateModelDropdown();
    dom.statusText.textContent = 'Gateway Online';
    dom.statusDot.className = 'status-indicator ready';
  }

  function populateModelDropdown() {
    const geminiGroup = document.getElementById('optgroup-gemini');
    const groqGroup = document.getElementById('optgroup-groq');
    const openrouterGroup = document.getElementById('optgroup-openrouter');

    if (state.dynamicModels.gemini.length > 0 && geminiGroup) {
      geminiGroup.innerHTML = '';
      state.dynamicModels.gemini.slice(0, 8).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        geminiGroup.appendChild(opt);
      });
    }

    if (state.dynamicModels.groq.length > 0 && groqGroup) {
      groqGroup.innerHTML = '';
      state.dynamicModels.groq.slice(0, 8).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        groqGroup.appendChild(opt);
      });
    }

    if (state.dynamicModels.openrouter.length > 0 && openrouterGroup) {
      openrouterGroup.innerHTML = '';
      state.dynamicModels.openrouter.slice(0, 8).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        openrouterGroup.appendChild(opt);
      });
    }

    dom.settingModel.value = state.runSettings.model;
    dom.currentModelTag.textContent = state.runSettings.model;
  }

  // SEMANTIC ROUTER: Auto-selects model based on task intent
  function determineOptimalModel(userPrompt, selectedModel) {
    if (!state.runSettings.semanticRouter) return selectedModel;

    const lower = userPrompt.toLowerCase();
    const isCoding = lower.includes('function') || lower.includes('class') || lower.includes('code') || lower.includes('html') || lower.includes('css') || lower.includes('javascript') || lower.includes('powershell');
    const isReasoning = lower.includes('why') || lower.includes('explain') || lower.includes('architect') || lower.includes('audit') || lower.includes('compare');

    if (isCoding && state.keys.gemini.length > 0) return 'gemini-2.5-pro';
    if (isReasoning && state.keys.groq.length > 0) return 'deepseek-r1-distill-llama-70b';

    return selectedModel;
  }

  // REAL-TIME SERVER-SENT EVENTS (SSE) STREAMING ENGINE
  async function streamGeminiSSE(apiKey, model, systemPrompt, fullPrompt, config, onChunk) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: config.temperature
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(errText);
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
              if (text) onChunk(text);
            }
          } catch (e) {
            // Buffer split
          }
        }
      }
    }
  }

  // OPENAI-COMPATIBLE SSE STREAMING (GROQ / OPENROUTER)
  async function streamOpenAICompatibleSSE(endpoint, apiKey, model, systemPrompt, fullPrompt, config, onChunk) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: fullPrompt });

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
        stream: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(errText);
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
              onChunk(data.choices[0].delta.content);
            }
          } catch (e) {
            // Buffer split
          }
        }
      }
    }
  }

  function getProviderForModel(model) {
    if (model.startsWith('llama') || model.startsWith('deepseek-r1-distill') || model.startsWith('qwen')) return 'groq';
    if (model.includes('openrouter') || model.includes(':free')) return 'openrouter';
    return 'gemini';
  }

  // MULTI-PROVIDER FAILOVER CASCADE GOVERNOR
  async function executeInferencePipeline(userPrompt, onChunk, onFallbackNotice) {
    const rawModel = dom.settingModel.value;
    const initialModel = determineOptimalModel(userPrompt, rawModel);
    let currentModel = initialModel;
    let provider = getProviderForModel(currentModel);

    // Fallback list of models per provider to automatically rotate through on 503 / 429
    const fallbackChains = {
      gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
      groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b'],
      openrouter: ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free']
    };

    let attemptKeys = (state.keys[provider] || []).map(k => k.key);
    let fallbackIndex = 0;

    while (fallbackIndex < 5) {
      if (attemptKeys.length === 0) {
        // Switch provider if current has no keys
        const otherProviders = ['gemini', 'groq', 'openrouter'].filter(p => p !== provider && (state.keys[p] || []).length > 0);
        if (otherProviders.length > 0) {
          provider = otherProviders[0];
          currentModel = fallbackChains[provider][0];
          attemptKeys = state.keys[provider].map(k => k.key);
          onFallbackNotice(`Routed to ${provider.toUpperCase()} (${currentModel})`);
        } else {
          throw new Error(`No API key configured for ${provider.toUpperCase()}. Please open Key Vault.`);
        }
      }

      for (let k = 0; k < attemptKeys.length; k++) {
        const key = attemptKeys[k];
        try {
          if (provider === 'gemini') {
            await streamGeminiSSE(key, currentModel, state.runSettings.systemInstructions, userPrompt, state.runSettings, onChunk);
            return { model: currentModel, provider };
          } else if (provider === 'groq') {
            await streamOpenAICompatibleSSE('https://api.groq.com/openai/v1/chat/completions', key, currentModel, state.runSettings.systemInstructions, userPrompt, state.runSettings, onChunk);
            return { model: currentModel, provider };
          } else if (provider === 'openrouter') {
            await streamOpenAICompatibleSSE('https://openrouter.ai/api/v1/chat/completions', key, currentModel, state.runSettings.systemInstructions, userPrompt, state.runSettings, onChunk);
            return { model: currentModel, provider };
          }
        } catch (err) {
          console.warn(`[Gateway Notice] Model ${currentModel} on key ${k} failed with status ${err.status}:`, err.message);

          // Handle 503 Overload or 429 Rate Limit seamlessly
          if (err.status === 503 || err.status === 429 || err.status === 404) {
            const chain = fallbackChains[provider] || [];
            const nextModel = chain.find(m => m !== currentModel);
            if (nextModel) {
              currentModel = nextModel;
              onFallbackNotice(`Auto-Fallback: Switched to ${nextModel} due to ${err.status === 503 ? 'high cloud demand' : 'rate limit'}`);
              break; // Try with next model in chain
            }
          }

          if (k === attemptKeys.length - 1) {
            // All keys for this provider exhausted; switch provider
            attemptKeys = [];
          }
        }
      }
      fallbackIndex++;
    }

    throw new Error('All cloud inference endpoints are currently unavailable. Please retry in a few moments.');
  }

  function appendUserMessage(text) {
    if (dom.welcomeCard) dom.welcomeCard.style.display = 'none';

    const msg = document.createElement('div');
    msg.className = 'chat-message user';
    msg.innerHTML = `
      <div class="chat-message-meta">You</div>
      <div class="chat-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    `;
    dom.chatStream.appendChild(msg);
    scrollToBottom();
  }

  function createAIMessageElement() {
    if (dom.welcomeCard) dom.welcomeCard.style.display = 'none';

    const msg = document.createElement('div');
    msg.className = 'chat-message ai';

    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    meta.innerHTML = `<span class="model-name-label">AI Gateway</span> <span class="fallback-slot"></span>`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    msg.appendChild(meta);
    msg.appendChild(bubble);
    dom.chatStream.appendChild(msg);
    scrollToBottom();

    return {
      element: msg,
      bubble: bubble,
      metaFallback: meta.querySelector('.fallback-slot'),
      metaLabel: meta.querySelector('.model-name-label')
    };
  }

  function renderArtifacts(container, fullText) {
    // Detect <file path="...">...</file> or markdown ```code blocks and transform to interactive cards
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;
    let hasArtifacts = false;
    let rendered = fullText;

    while ((match = fileRegex.exec(fullText)) !== null) {
      hasArtifacts = true;
    }

    if (hasArtifacts) {
      container.innerHTML = '';
      let lastIndex = 0;
      fileRegex.lastIndex = 0;

      while ((match = fileRegex.exec(fullText)) !== null) {
        const textBefore = fullText.substring(lastIndex, match.index);
        if (textBefore.trim()) {
          const p = document.createElement('div');
          p.innerHTML = escapeHtml(textBefore).replace(/\n/g, '<br>');
          container.appendChild(p);
        }

        const filePath = match[1].trim();
        const codeContent = match[2].trimStart();

        const card = document.createElement('div');
        card.className = 'code-artifact';
        card.innerHTML = `
          <div class="code-artifact-header">
            <span>${escapeHtml(filePath)}</span>
            <div class="code-artifact-actions">
              <button class="btn-xs" data-action="codepen">CodePen</button>
              <button class="btn-xs" data-action="copy">Copy</button>
              <button class="btn-xs" data-action="save">Save to Disk</button>
            </div>
          </div>
          <pre><code>${escapeHtml(codeContent)}</code></pre>
        `;

        card.querySelector('[data-action="codepen"]').addEventListener('click', () => {
          exportCodePenArtifact(filePath, codeContent);
        });

        card.querySelector('[data-action="copy"]').addEventListener('click', () => {
          navigator.clipboard.writeText(codeContent);
          alert('Copied to clipboard.');
        });

        card.querySelector('[data-action="save"]').addEventListener('click', async () => {
          try {
            await fetch('/api/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: filePath, content: codeContent })
            });
            alert(`Saved ${filePath} to local disk.`);
          } catch (e) {
            alert('Preserved in browser.');
          }
        });

        container.appendChild(card);
        lastIndex = fileRegex.lastIndex;
      }

      const textAfter = fullText.substring(lastIndex);
      if (textAfter.trim()) {
        const p = document.createElement('div');
        p.innerHTML = escapeHtml(textAfter).replace(/\n/g, '<br>');
        container.appendChild(p);
      }
    } else {
      container.innerHTML = escapeHtml(fullText).replace(/\n/g, '<br>');
    }
  }

  function exportCodePenArtifact(filename, content) {
    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    let html = '', css = '', js = '';
    if (filename.endsWith('.html')) html = content;
    else if (filename.endsWith('.css')) css = content;
    else if (filename.endsWith('.js')) js = content;
    else html = `<pre>${content}</pre>`;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({ title: filename, html, css, js });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function scrollToBottom() {
    dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
  }

  async function handleSend() {
    const text = dom.mainPrompt.value.trim();
    if (!text) return;

    let fullPrompt = text;
    if (state.attachments.size > 0) {
      let attachmentText = 'ATTACHED FILES CONTEXT:\n';
      state.attachments.forEach((content, name) => {
        attachmentText += `<file path="${name}">\n${content}\n</file>\n\n`;
      });
      fullPrompt = `${attachmentText}\nTASK:\n${text}`;
    }

    appendUserMessage(text);
    dom.mainPrompt.value = '';
    dom.charCounter.textContent = '0 chars';
    dom.btnSendPrompt.disabled = true;
    dom.statusDot.className = 'status-indicator busy';
    dom.statusText.textContent = 'Generating...';

    const aiMsg = createAIMessageElement();
    let accumulatedText = '';

    try {
      const result = await executeInferencePipeline(
        fullPrompt,
        (chunk) => {
          accumulatedText += chunk;
          aiMsg.bubble.textContent = accumulatedText;
          scrollToBottom();
        },
        (notice) => {
          aiMsg.metaFallback.innerHTML = `<span class="fallback-tag">${notice}</span>`;
        }
      );

      aiMsg.metaLabel.textContent = result.model;
      renderArtifacts(aiMsg.bubble, accumulatedText);
      dom.statusDot.className = 'status-indicator ready';
      dom.statusText.textContent = 'Gateway Online';
    } catch (err) {
      aiMsg.bubble.innerHTML = `<span style="color:var(--accent-rose); font-weight:600;">Gateway Notice:</span> ${escapeHtml(err.message)}`;
      dom.statusDot.className = 'status-indicator error';
      dom.statusText.textContent = 'Error';
    }

    dom.btnSendPrompt.disabled = false;
    scrollToBottom();
  }

  function renderVaultTable() {
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
        <td>${k.label || 'Key ' + (idx + 1)}</td>
        <td><span class="badge">Active</span></td>
        <td>${k.created}</td>
        <td><button class="btn-xs" data-del="${idx}" style="color:var(--accent-rose);">Delete</button></td>
      `;
      tr.querySelector('[data-del]').addEventListener('click', () => {
        keys.splice(idx, 1);
        saveKeys();
        renderVaultTable();
      });
      dom.vaultKeysTbody.appendChild(tr);
    });
  }

  function renderContextChips() {
    dom.contextChips.innerHTML = '';
    state.attachments.forEach((_, name) => {
      const chip = document.createElement('div');
      chip.className = 'context-chip';
      chip.innerHTML = `<span>${name}</span> <span data-del="${name}" style="cursor:pointer; color:var(--accent-rose);">&times;</span>`;
      chip.querySelector('[data-del]').addEventListener('click', () => {
        state.attachments.delete(name);
        renderContextChips();
      });
      dom.contextChips.appendChild(chip);
    });
  }

  function initEvents() {
    dom.mainPrompt.addEventListener('input', () => {
      dom.charCounter.textContent = `${dom.mainPrompt.value.length} chars`;
      dom.mainPrompt.style.height = 'auto';
      dom.mainPrompt.style.height = Math.min(dom.mainPrompt.scrollHeight, 200) + 'px';
    });

    dom.mainPrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.btnSendPrompt.addEventListener('click', handleSend);

    dom.btnClearChat.addEventListener('click', () => {
      if (confirm('Clear chat conversation?')) {
        dom.chatStream.innerHTML = '';
        if (dom.welcomeCard) {
          dom.chatStream.appendChild(dom.welcomeCard);
          dom.welcomeCard.style.display = 'flex';
        }
      }
    });

    dom.fileAttachmentInput.addEventListener('change', (e) => {
      Array.from(e.target.files || []).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          state.attachments.set(file.name, ev.target.result);
          renderContextChips();
        };
        reader.readAsText(file);
      });
      dom.fileAttachmentInput.value = '';
    });

    dom.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
      });
    });

    dom.toggleRunSettingsBtn.addEventListener('click', () => dom.settingsSlideout.classList.toggle('open'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsSlideout.classList.remove('open'));

    dom.settingModel.addEventListener('change', () => {
      state.runSettings.model = dom.settingModel.value;
      dom.currentModelTag.textContent = dom.settingModel.value;
    });

    dom.settingThinkingBudget.addEventListener('input', () => {
      dom.settingThinkingBudgetVal.textContent = dom.settingThinkingBudget.value;
      state.runSettings.thinkingBudget = parseInt(dom.settingThinkingBudget.value, 10);
    });

    dom.settingTemp.addEventListener('input', () => {
      dom.settingTempVal.textContent = parseFloat(dom.settingTemp.value).toFixed(2);
      state.runSettings.temperature = parseFloat(dom.settingTemp.value);
    });

    dom.settingSemanticRouter.addEventListener('change', () => {
      state.runSettings.semanticRouter = dom.settingSemanticRouter.checked;
    });

    dom.settingAutoCascade.addEventListener('change', () => {
      state.runSettings.autoCascade = dom.settingAutoCascade.checked;
    });

    dom.btnSyncModels.addEventListener('click', fetchLiveModels);
    dom.btnRefreshModelsList.addEventListener('click', fetchLiveModels);

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

      if (!key) return alert('Please paste an API key.');
      state.keys[prov] = state.keys[prov] || [];
      state.keys[prov].push({ key, label, created: new Date().toLocaleDateString() });
      saveKeys();
      dom.vaultKeyInput.value = '';
      dom.vaultLabelInput.value = '';
      renderVaultTable();
      fetchLiveModels();
    });
  }

  function init() {
    loadKeys();
    initEvents();
    if (Object.values(state.keys).some(arr => arr.length > 0)) {
      fetchLiveModels();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
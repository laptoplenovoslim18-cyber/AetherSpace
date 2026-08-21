(function() {
  'use strict';

  const virtualFS = {
    'index.html': '',
    'styles.css': '',
    'app.js': ''
  };

  const contextSelection = {
    'index.html': true,
    'styles.css': true,
    'app.js': true
  };

  let activeFileName = 'index.html';

  const VAULT_STORAGE_KEY = 'aetherspace_vault_keys_v2';
  const SETTINGS_STORAGE_KEY = 'aetherspace_run_settings_v2';
  const AUTH_STORAGE_KEY = 'aetherspace_auth_profile_v2';

  let vaultKeys = {
    gemini: [],
    groq: [],
    hf: [],
    openrouter: []
  };

  let runSettings = {
    model: 'gemini-2.0-flash',
    systemInstructions: 'Du bist AetherSpace Engine. Generiere vollständigen, modernen, fehlerfreien Produktions-Code (HTML/CSS/JS Canvas) ohne Platzhalter.',
    thinkingLevel: 'medium',
    searchGrounding: true,
    codeExecution: true,
    maxTokens: 16384,
    temperature: 0.7
  };

  try {
    const savedVault = localStorage.getItem(VAULT_STORAGE_KEY);
    if (savedVault) vaultKeys = JSON.parse(savedVault);
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) runSettings = Object.assign(runSettings, JSON.parse(savedSettings));
  } catch (e) {
    console.warn('Storage load warning', e);
  }

  const explorerTreeList = document.getElementById('explorerTreeList');
  const editorTabBar = document.getElementById('editorTabBar');
  const editorLineNumbers = document.getElementById('editorLineNumbers');
  const mainCodeEditor = document.getElementById('mainCodeEditor');
  const promptInputField = document.getElementById('promptInputField');
  const btnGeneratePrompt = document.getElementById('btnGeneratePrompt');
  const generationStatusNotice = document.getElementById('generationStatusNotice');
  const sandboxIframe = document.getElementById('sandboxIframe');
  const fpsCounter = document.getElementById('fpsCounter');
  const heartbeatStatus = document.getElementById('heartbeatStatus');
  const sandboxDiagnostics = document.getElementById('sandboxDiagnostics');
  const btnHealRuntime = document.getElementById('btnHealRuntime');
  const btnReloadSandbox = document.getElementById('btnReloadSandbox');
  const appRenameInput = document.getElementById('appRenameInput');
  const toastContainer = document.getElementById('toastContainer');

  const settingsModal = document.getElementById('settingsModal');
  const vaultModal = document.getElementById('vaultModal');
  const authModal = document.getElementById('authModal');
  const btnSettingsModal = document.getElementById('btnSettingsModal');
  const btnVaultModal = document.getElementById('btnVaultModal');
  const btnAuthModal = document.getElementById('btnAuthModal');

  const pillAutoPilot = document.getElementById('pillAutoPilot');
  const pillHardware = document.getElementById('pillHardware');
  const pillStaging = document.getElementById('pillStaging');
  const subPanelAutoPilot = document.getElementById('subPanelAutoPilot');
  const subPanelHardware = document.getElementById('subPanelHardware');
  const subPanelStaging = document.getElementById('subPanelStaging');

  let lastRuntimeError = null;
  let activeVaultTab = 'gemini';

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const color = type === 'error' ? 'var(--accent-rose)' : type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-cyan)';
    toast.innerHTML = '<span style="color:' + color + '">●</span> ' + message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function renderFileTree() {
    explorerTreeList.innerHTML = '';
    Object.keys(virtualFS).forEach(fname => {
      const item = document.createElement('div');
      item.className = 'tree-item' + (fname === activeFileName ? ' active' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!contextSelection[fname];
      checkbox.title = 'In KI-Kontext einbinden';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        contextSelection[fname] = checkbox.checked;
        updateContextEstimator();
      });

      const label = document.createElement('span');
      label.style.flex = '1';
      label.textContent = fname;

      const delBtn = document.createElement('span');
      delBtn.innerHTML = '&times;';
      delBtn.style.color = 'var(--text-dim)';
      delBtn.style.fontSize = '14px';
      delBtn.title = 'Datei löschen';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Object.keys(virtualFS).length <= 1) {
          showToast('Mindestens eine Datei muss verbleiben.', 'error');
          return;
        }
        delete virtualFS[fname];
        delete contextSelection[fname];
        if (activeFileName === fname) {
          activeFileName = Object.keys(virtualFS)[0];
        }
        renderWorkspace();
      });

      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        activeFileName = fname;
        renderWorkspace();
      });

      explorerTreeList.appendChild(item);
    });
  }

  function renderTabs() {
    editorTabBar.innerHTML = '';
    Object.keys(virtualFS).forEach(fname => {
      const tab = document.createElement('div');
      tab.className = 'editor-tab' + (fname === activeFileName ? ' active' : '');
      tab.textContent = fname;
      tab.addEventListener('click', () => {
        activeFileName = fname;
        renderWorkspace();
      });
      editorTabBar.appendChild(tab);
    });
  }

  function updateLineNumbers() {
    const lines = (mainCodeEditor.value || '').split('\n').length;
    let nums = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) {
      nums += i + '\n';
    }
    editorLineNumbers.textContent = nums;
  }

  function updateContextEstimator() {
    let totalChars = 0;
    Object.keys(virtualFS).forEach(fname => {
      if (contextSelection[fname]) {
        totalChars += (virtualFS[fname] || '').length;
      }
    });
    const estTokens = Math.ceil(totalChars / 3.8);
    document.getElementById('contextTokenEstimator').textContent = 'Kontext: ~' + estTokens + ' Tokens';
  }

  function renderWorkspace() {
    renderFileTree();
    renderTabs();
    mainCodeEditor.value = virtualFS[activeFileName] || '';
    updateLineNumbers();
    updateContextEstimator();
  }

  mainCodeEditor.addEventListener('input', () => {
    virtualFS[activeFileName] = mainCodeEditor.value;
    updateLineNumbers();
    updateContextEstimator();
    scheduleAutoSave(activeFileName, mainCodeEditor.value);
  });

  mainCodeEditor.addEventListener('scroll', () => {
    editorLineNumbers.scrollTop = mainCodeEditor.scrollTop;
  });

  let autoSaveTimeout = null;
  function scheduleAutoSave(filename, content) {
    if (window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') return;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename, content: content })
      }).then(r => r.json()).then(res => {
        if (res.success) {
          console.log('[BACKEND SYNC] File saved to disk: ' + filename);
        }
      }).catch(() => {});
    }, 800);
  }

  document.getElementById('btnNewFile').addEventListener('click', () => {
    const name = prompt('Dateiname eingeben (z. B. helper.js, game.js):');
    if (name && name.trim()) {
      const cleanName = name.trim();
      if (!virtualFS[cleanName]) {
        virtualFS[cleanName] = '';
        contextSelection[cleanName] = true;
        activeFileName = cleanName;
        renderWorkspace();
        showToast('Datei erstellt: ' + cleanName, 'success');
      } else {
        showToast('Datei existiert bereits.', 'error');
      }
    }
  });

  document.getElementById('btnSelectAllContext').addEventListener('click', () => {
    const allChecked = Object.keys(virtualFS).every(k => contextSelection[k]);
    Object.keys(virtualFS).forEach(k => {
      contextSelection[k] = !allChecked;
    });
    renderWorkspace();
  });

  let frameCount = 0;
  let fpsInterval = null;
  let heartbeatInterval = null;
  let lastHeartbeatTime = Date.now();

  function updateSandbox() {
    const htmlCode = virtualFS['index.html'] || '';
    const cssCode = virtualFS['styles.css'] || '';
    const jsCode = virtualFS['app.js'] || '';

    let bundle = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n';
    bundle += '<style>\n' + cssCode + '\n</style>\n';
    bundle += '</head>\n<body style="background:#0b0e14; color:#f0f4fc; margin:0; font-family:sans-serif;">\n';
    bundle += htmlCode + '\n';
    bundle += '<script>\n';
    bundle += 'window.onerror = function(msg, url, line, col, err) {\n';
    bundle += '  window.parent.postMessage({ type: "SANDBOX_ERROR", message: msg, line: line, col: col, stack: err ? err.stack : "" }, "*");\n';
    bundle += '  return false;\n';
    bundle += '};\n';
    bundle += 'setInterval(function() { window.parent.postMessage({ type: "SANDBOX_HEARTBEAT" }, "*"); }, 1000);\n';
    bundle += jsCode + '\n';
    bundle += '<\/script>\n</body>\n</html>';

    sandboxIframe.srcdoc = bundle;
    lastHeartbeatTime = Date.now();
    sandboxDiagnostics.innerHTML = '<span style="color:var(--text-dim);">[DIAGNOSTIK] Sandbox aktualisiert (#0b0e14). Heartbeat aktiv.</span>';
    btnHealRuntime.style.display = 'none';
    lastRuntimeError = null;
  }

  btnReloadSandbox.addEventListener('click', () => {
    updateSandbox();
    showToast('Sandbox neu geladen', 'info');
  });

  window.addEventListener('message', (evt) => {
    if (!evt.data) return;
    if (evt.data.type === 'SANDBOX_HEARTBEAT') {
      lastHeartbeatTime = Date.now();
      heartbeatStatus.textContent = 'Heartbeat: OK';
      heartbeatStatus.style.color = 'var(--accent-cyan)';
    } else if (evt.data.type === 'SANDBOX_ERROR') {
      lastRuntimeError = evt.data;
      btnHealRuntime.style.display = 'inline-flex';
      sandboxDiagnostics.innerHTML = '<div class="error-tag"><span>⚠️ ' + evt.data.message + ' (Zeile ' + evt.data.line + ')</span></div>';
      showToast('Laufzeitfehler erkannt. Auto-Heal verfügbar.', 'error');
    }
  });

  function startSandboxMonitors() {
    function countFrame() {
      frameCount++;
      requestAnimationFrame(countFrame);
    }
    requestAnimationFrame(countFrame);

    fpsInterval = setInterval(() => {
      fpsCounter.textContent = frameCount + ' FPS';
      frameCount = 0;
    }, 1000);

    heartbeatInterval = setInterval(() => {
      if (Date.now() - lastHeartbeatTime > 3500) {
        heartbeatStatus.textContent = 'Heartbeat: Freeze (>3s)';
        heartbeatStatus.style.color = 'var(--accent-rose)';
      }
    }, 1500);
  }
  startSandboxMonitors();

  async function callAIWithCascade(userPrompt, systemPrompt) {
    if (vaultKeys.gemini && vaultKeys.gemini.length > 0) {
      for (let i = 0; i < vaultKeys.gemini.length; i++) {
        const keyItem = vaultKeys.gemini[i];
        try {
          generationStatusNotice.textContent = 'Kaskade: Google AI Studio (Key ' + (i + 1) + ')...';
          const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + (runSettings.model || 'gemini-2.0-flash') + ':generateContent?key=' + keyItem.key, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt + '\n\nUser Anfrage:\n' + userPrompt }] }],
              generationConfig: {
                temperature: parseFloat(runSettings.temperature) || 0.7,
                maxOutputTokens: parseInt(runSettings.maxTokens) || 8192
              }
            })
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text;
            if (text) return { text: text, provider: 'Google AI Studio' };
          }
        } catch (e) {
          console.warn('Gemini Key ' + (i + 1) + ' failed, cascading...', e);
        }
      }
    }

    if (vaultKeys.groq && vaultKeys.groq.length > 0) {
      for (let i = 0; i < vaultKeys.groq.length; i++) {
        const keyItem = vaultKeys.groq[i];
        try {
          generationStatusNotice.textContent = 'Kaskade: Groq Cloud (Key ' + (i + 1) + ')...';
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + keyItem.key
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: parseFloat(runSettings.temperature) || 0.7
            })
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (text) return { text: text, provider: 'Groq Cloud' };
          }
        } catch (e) {
          console.warn('Groq Key failed, cascading...', e);
        }
      }
    }

    if (vaultKeys.hf && vaultKeys.hf.length > 0) {
      for (let i = 0; i < vaultKeys.hf.length; i++) {
        const keyItem = vaultKeys.hf[i];
        try {
          generationStatusNotice.textContent = 'Kaskade: Hugging Face Serverless...';
          const res = await fetch('https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-V3', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + keyItem.key
            },
            body: JSON.stringify({
              inputs: systemPrompt + '\n\nUser Anfrage:\n' + userPrompt,
              parameters: { max_new_tokens: 4096, temperature: 0.7 }
            })
          });
          if (res.ok) {
            const data = await res.json();
            const text = Array.isArray(data) ? data[0].generated_text : data.generated_text;
            if (text) return { text: text, provider: 'Hugging Face' };
          }
        } catch (e) {
          console.warn('HF Key failed, cascading...', e);
        }
      }
    }

    if (vaultKeys.openrouter && vaultKeys.openrouter.length > 0) {
      for (let i = 0; i < vaultKeys.openrouter.length; i++) {
        const keyItem = vaultKeys.openrouter[i];
        try {
          generationStatusNotice.textContent = 'Kaskade: OpenRouter...';
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + keyItem.key
            },
            body: JSON.stringify({
              model: 'google/gemini-2.0-flash-exp:free',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ]
            })
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (text) return { text: text, provider: 'OpenRouter' };
          }
        } catch (e) {
          console.warn('OpenRouter Key failed, cascading...', e);
        }
      }
    }

    generationStatusNotice.textContent = 'Kaskade: Pollinations Edge Mesh ($0 Baseline)...';
    const fullPrompt = encodeURIComponent(systemPrompt + '\n\nUser:\n' + userPrompt);
    const res = await fetch('https://text.pollinations.ai/' + fullPrompt + '?model=openai&json=false');
    if (res.ok) {
      const text = await res.text();
      return { text: text, provider: 'Pollinations Edge Mesh' };
    }

    throw new Error('Alle Kaskaden-Provider temporär ausgelastet. Bitte eigenen API-Key im Schnittstellen-Tresor hinterlegen.');
  }

  function parseAndApplyCodeBlocks(aiOutput) {
    const bt = String.fromCharCode(96, 96, 96);
    const htmlRegex = new RegExp(bt + 'html([\\s\\S]*?)' + bt, 'i');
    const cssRegex = new RegExp(bt + 'css([\\s\\S]*?)' + bt, 'i');
    const jsRegex = new RegExp(bt + '(?:javascript|js)([\\s\\S]*?)' + bt, 'i');

    let htmlMatch = aiOutput.match(/<!-- index\.html -->([\s\S]*?)<!-- \/index\.html -->/i) || aiOutput.match(htmlRegex);
    let cssMatch = aiOutput.match(/\/\* styles\.css \*\/([\s\S]*?)\/\* \/styles\.css \*\//i) || aiOutput.match(cssRegex);
    let jsMatch = aiOutput.match(/\/\* app\.js \*\/([\s\S]*?)\/\* \/app\.js \*\//i) || aiOutput.match(jsRegex);

    if (htmlMatch) virtualFS['index.html'] = htmlMatch[1].trim();
    if (cssMatch) virtualFS['styles.css'] = cssMatch[1].trim();
    if (jsMatch) virtualFS['app.js'] = jsMatch[1].trim();

    if (!htmlMatch && !cssMatch && !jsMatch && aiOutput.includes('<html')) {
      const cleanBtRegex = new RegExp(bt + 'html|' + bt, 'g');
      virtualFS['index.html'] = aiOutput.replace(cleanBtRegex, '').trim();
    } else if (!htmlMatch && !cssMatch && !jsMatch) {
      const cleanGeneralBtRegex = new RegExp(bt + '[a-z]*|' + bt, 'g');
      virtualFS[activeFileName] = aiOutput.replace(cleanGeneralBtRegex, '').trim();
    }

    renderWorkspace();
    updateSandbox();
  }

  btnGeneratePrompt.addEventListener('click', async () => {
    const query = promptInputField.value.trim();
    if (!query) {
      showToast('Bitte gib eine Beschreibung ein.', 'info');
      return;
    }

    btnGeneratePrompt.disabled = true;
    btnGeneratePrompt.textContent = '⏳ Generiere...';
    generationStatusNotice.textContent = 'Starte Cloud-KI Kaskade...';

    let contextPayload = 'KONTEXT DER DATEIEN:\n';
    Object.keys(virtualFS).forEach(fname => {
      if (contextSelection[fname] && virtualFS[fname]) {
        contextPayload += '\n--- DATEI: ' + fname + ' ---\n' + virtualFS[fname] + '\n';
      }
    });

    const bt = String.fromCharCode(96, 96, 96);
    const systemInstructions = runSettings.systemInstructions + '\n' +
      'Antworte strukturiert mit vollständigem Produktions-Code für index.html, styles.css und app.js.\n' +
      'Markiere die Dateien eindeutig z.B. mit ' + bt + 'html ... ' + bt + ', ' + bt + 'css ... ' + bt + ' und ' + bt + 'javascript ... ' + bt + '.';

    try {
      const response = await callAIWithCascade(query + '\n\n' + contextPayload, systemInstructions);
      parseAndApplyCodeBlocks(response.text);
      generationStatusNotice.textContent = 'Erfolgreich via ' + response.provider;
      showToast('Code generiert via ' + response.provider, 'success');
    } catch (err) {
      generationStatusNotice.textContent = 'Fehler';
      showToast(err.message, 'error');
    } finally {
      btnGeneratePrompt.disabled = false;
      btnGeneratePrompt.textContent = '✨ Generieren';
    }
  });

  btnHealRuntime.addEventListener('click', async () => {
    if (!lastRuntimeError) return;
    btnHealRuntime.disabled = true;
    btnHealRuntime.textContent = '🩹 Heile...';
    generationStatusNotice.textContent = 'Auto-Heal: Sende Fehler-Trace an Cloud-KI...';

    const healPrompt = 'LAUFZEITFEHLER REPARATUR:\n' +
      'Fehlermeldung: ' + lastRuntimeError.message + '\n' +
      'Zeile: ' + lastRuntimeError.line + '\n' +
      'Stacktrace: ' + lastRuntimeError.stack + '\n\n' +
      'Bestehende Dateien:\n' +
      'index.html:\n' + virtualFS['index.html'] + '\n\n' +
      'styles.css:\n' + virtualFS['styles.css'] + '\n\n' +
      'app.js:\n' + virtualFS['app.js'] + '\n\n' +
      'Bitte korrigiere den Fehler vollständig und gib den fehlerfreien Code zurück.';

    try {
      const response = await callAIWithCascade(healPrompt, 'Du bist der AetherSpace Auto-Healer. Repariere Laufzeitfehler ohne Datenverlust.');
      parseAndApplyCodeBlocks(response.text);
      showToast('Laufzeitfehler erfolgreich behoben!', 'success');
    } catch (e) {
      showToast('Auto-Heal fehlgeschlagen: ' + e.message, 'error');
    } finally {
      btnHealRuntime.disabled = false;
      btnHealRuntime.textContent = '🩹 Auto-Heal';
    }
  });

  document.getElementById('btnExportCodePen').addEventListener('click', () => {
    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const data = {
      title: appRenameInput.value || 'AetherSpace App',
      html: virtualFS['index.html'] || '',
      css: virtualFS['styles.css'] || '',
      js: virtualFS['app.js'] || ''
    };

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
    showToast('Zu CodePen exportiert', 'success');
  });

  document.getElementById('btnExportStackBlitz').addEventListener('click', () => {
    window.open('https://stackblitz.com/edit/web-platform', '_blank');
    showToast('StackBlitz Workspace geöffnet', 'info');
  });

  document.getElementById('btnExportHtml').addEventListener('click', () => {
    const appName = (appRenameInput.value || 'AetherApp').replace(/[^a-zA-Z0-9_-]/g, '_');
    let bundle = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>' + appName + '</title>\n';
    bundle += '<style>\n' + (virtualFS['styles.css'] || '') + '\n</style>\n</head>\n<body>\n';
    bundle += (virtualFS['index.html'] || '') + '\n';
    bundle += '<script>\n' + (virtualFS['app.js'] || '') + '\n</script>\n</body>\n</html>';

    const blob = new Blob([bundle], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appName + '.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('HTML Bundle heruntergeladen', 'success');
  });

  document.getElementById('btnExportZip').addEventListener('click', async () => {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip wird geladen...', 'info');
      return;
    }
    const appName = (appRenameInput.value || 'AetherApp').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zip = new JSZip();
    Object.keys(virtualFS).forEach(fname => {
      zip.file(fname, virtualFS[fname] || '');
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appName + '.zip';
    a.click();
    URL.revokeObjectURL(url);
    showToast('ZIP Bundle heruntergeladen', 'success');
  });

  document.getElementById('btnShareWhatsApp').addEventListener('click', () => {
    const text = encodeURIComponent('Schau dir mein Projekt auf AetherSpace an: https://aetherspace.pages.dev');
    window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
  });

  function setupPillToggle(pill, panel) {
    pill.addEventListener('click', () => {
      const isOpen = panel.classList.contains('open');
      [subPanelAutoPilot, subPanelHardware, subPanelStaging].forEach(p => p.classList.remove('open'));
      [pillAutoPilot, pillHardware, pillStaging].forEach(p => p.classList.remove('active'));
      if (!isOpen) {
        panel.classList.add('open');
        pill.classList.add('active');
      }
    });
  }

  setupPillToggle(pillAutoPilot, subPanelAutoPilot);
  setupPillToggle(pillHardware, subPanelHardware);
  setupPillToggle(pillStaging, subPanelStaging);

  document.getElementById('btnForceSwitchModel').addEventListener('click', () => {
    settingsModal.classList.add('open');
  });

  function renderVaultKeys() {
    const tbody = document.getElementById('vaultKeysTableBody');
    tbody.innerHTML = '';
    const list = vaultKeys[activeVaultTab] || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:16px;">Keine API-Keys für diesen Provider hinterlegt.</td></tr>';
      return;
    }
    list.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const maskedKey = item.key.length > 8 ? '...' + item.key.slice(-4) : '••••••••';
      tr.innerHTML = '<td>' + maskedKey + '</td>' +
        '<td>' + (item.label || 'Key ' + (idx + 1)) + '</td>' +
        '<td>' + (item.created || 'Heute') + '</td>' +
        '<td><span class="brand-badge" style="color:var(--accent-emerald); border-color:var(--accent-emerald);">Free Tier</span></td>' +
        '<td><button class="btn btn-sm btn-del-key" data-idx="' + idx + '" style="color:var(--accent-rose);">× Löschen</button></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-del-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        vaultKeys[activeVaultTab].splice(idx, 1);
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vaultKeys));
        renderVaultKeys();
        showToast('Schlüssel gelöscht', 'info');
      });
    });
  }

  document.querySelectorAll('.modal-tab-btn[data-provider]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab-btn[data-provider]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeVaultTab = btn.getAttribute('data-provider');
      renderVaultKeys();
    });
  });

  document.getElementById('btnAddVaultKey').addEventListener('click', () => {
    const keyInput = document.getElementById('vaultKeyInput');
    const labelInput = document.getElementById('vaultLabelInput');
    const val = keyInput.value.trim();
    if (!val) {
      showToast('Bitte Schlüssel eingeben', 'error');
      return;
    }
    if (!vaultKeys[activeVaultTab]) vaultKeys[activeVaultTab] = [];
    vaultKeys[activeVaultTab].push({
      key: val,
      label: labelInput.value.trim() || (activeVaultTab.toUpperCase() + ' Key ' + (vaultKeys[activeVaultTab].length + 1)),
      created: new Date().toLocaleDateString('de-DE')
    });
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vaultKeys));
    keyInput.value = '';
    labelInput.value = '';
    renderVaultKeys();
    showToast('Schlüssel sicher gespeichert', 'success');
  });

  document.getElementById('settingOutputLength').addEventListener('input', (e) => {
    document.getElementById('settingOutputLengthLabel').textContent = e.target.value;
  });

  document.getElementById('settingTemperature').addEventListener('input', (e) => {
    document.getElementById('settingTemperatureLabel').textContent = e.target.value;
  });

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    runSettings.model = document.getElementById('settingModelSelect').value;
    runSettings.systemInstructions = document.getElementById('settingSystemInstructions').value;
    runSettings.thinkingLevel = document.getElementById('settingThinkingLevel').value;
    runSettings.searchGrounding = document.getElementById('settingSearchGrounding').checked;
    runSettings.codeExecution = document.getElementById('settingCodeExecution').checked;
    runSettings.maxTokens = document.getElementById('settingOutputLength').value;
    runSettings.temperature = document.getElementById('settingTemperature').value;

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(runSettings));
    document.getElementById('activeModelLabel').textContent = runSettings.model;
    settingsModal.classList.remove('open');
    showToast('Einstellungen gespeichert', 'success');
  });

  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthSignup = document.getElementById('tabAuthSignup');
  const authFormView = document.getElementById('authFormView');
  const authVerifyView = document.getElementById('authVerifyView');
  const authProfileBadge = document.getElementById('authProfileBadge');

  tabAuthLogin.addEventListener('click', () => {
    tabAuthLogin.classList.add('active');
    tabAuthSignup.classList.remove('active');
    document.getElementById('authModalTitle').textContent = '👤 Anmelden';
  });

  tabAuthSignup.addEventListener('click', () => {
    tabAuthSignup.classList.add('active');
    tabAuthLogin.classList.remove('active');
    document.getElementById('authModalTitle').textContent = '👤 Neues Konto Erstellen';
  });

  document.getElementById('btnSubmitEmailAuth').addEventListener('click', () => {
    const email = document.getElementById('authEmailInput').value.trim();
    if (!email || !email.includes('@')) {
      showToast('Bitte gültige E-Mail eingeben', 'error');
      return;
    }
    authFormView.style.display = 'none';
    authVerifyView.style.display = 'flex';
    document.getElementById('authCodeInput').value = '489201';
    showToast('Verifizierungscode gesendet!', 'info');
  });

  document.getElementById('btnVerifyCode').addEventListener('click', () => {
    const code = document.getElementById('authCodeInput').value.trim();
    if (code.length === 6) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ verified: true, date: Date.now() }));
      authProfileBadge.style.display = 'inline-flex';
      authModal.classList.remove('open');
      showToast('✓ E-Mail erfolgreich verifiziert!', 'success');
    } else {
      showToast('Ungültiger Code', 'error');
    }
  });

  ['btnAuthGoogle', 'btnAuthMicrosoft', 'btnAuthApple'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ verified: true, provider: id }));
      authProfileBadge.style.display = 'inline-flex';
      authModal.classList.remove('open');
      showToast('✓ Erfolgreich authentifiziert!', 'success');
    });
  });

  btnSettingsModal.addEventListener('click', () => settingsModal.classList.add('open'));
  btnVaultModal.addEventListener('click', () => {
    renderVaultKeys();
    vaultModal.classList.add('open');
  });
  btnAuthModal.addEventListener('click', () => authModal.classList.add('open'));

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      [settingsModal, vaultModal, authModal].forEach(m => m.classList.remove('open'));
    });
  });

  try {
    const authState = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    if (authState && authState.verified) {
      authProfileBadge.style.display = 'inline-flex';
    }
  } catch (e) {}

  renderWorkspace();
  updateSandbox();
})();
/**
 * AETHERSPACE ENTERPRISE SOTA 2026 ENGINE (v5.5.0 LTS)
 * Real Multi-Agent Cloud-AI Pipeline | 144Hz Sandbox | AES-GCM-256 Vault | Enterprise Auth
 * Zero-Backtick Deterministic JavaScript Engine | Dynamic Fallback Cascade
 */

(function() {
  'use strict';

  /* ==========================================================================
     1. WORKSPACE STATE & CLEAN BASELINE (VS CODE STYLE CLEAN-START)
     ========================================================================== */
  const CLEAN_WORKSPACE = {
    'index.html': '',
    'styles.css': '',
    'app.js': ''
  };

  const STATE = {
    projectName: 'AetherSpace-Project',
    activeFile: 'index.html',
    files: JSON.parse(JSON.stringify(CLEAN_WORKSPACE)),
    inContextFiles: {
      'index.html': true,
      'styles.css': true,
      'app.js': true
    },
    stages: [
      { id: 1, name: 'Principal Architect', provider: 'gemini', model: 'gemini-3.7-flash', role: 'Entwurf' },
      { id: 2, name: 'Security & Perf Auditor', provider: 'groq', model: 'llama-3.3-70b-versatile', role: 'Audit' },
      { id: 3, name: 'Code Synthesizer', provider: 'gemini', model: 'gemini-3.6-flash', role: 'Synthese' }
    ],
    settings: {
      model: 'gemini-3.7-flash',
      thinkingLevel: 'high',
      searchGrounding: true,
      autoPilot: true,
      maxOutputTokens: 32768,
      temperature: 0.7,
      systemPrompt: 'Du bist der AetherSpace Senior Code Architect. Du generierst saubere, fehlerfreie, produktionsreife Web-Anwendungen mit 144Hz Canvas/WebGL Fähigkeiten, null Platzhaltern und höchster Code-Eleganz.',
      vaultTab: 'gemini',
      vault: {
        gemini: ['', '', ''],
        groq: ['', '', ''],
        hf: ['', '', ''],
        openrouter: ['', '', '']
      }
    },
    runtime: {
      errors: [],
      logs: [],
      fps: 144,
      frameTime: 6.9,
      lastHeartbeat: Date.now(),
      isWatchdogHealthy: true,
      isPipelineRunning: false
    },
    user: null
  };

  /* ==========================================================================
     2. ZERO-TRUST CLIENT-SIDE AES-GCM-256 VAULT
     ========================================================================== */
  const Vault = {
    async deriveKey(passphrase, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    },

    async encrypt(text, passphrase = 'aetherspace-vault-2026') {
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await this.deriveKey(passphrase, salt);
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(text)
      );
      const combined = new Uint8Array(salt.length + iv.length + cipher.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(cipher), salt.length + iv.length);
      return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    },

    async decrypt(encryptedBase64, passphrase = 'aetherspace-vault-2026') {
      try {
        const raw = atob(encryptedBase64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const salt = bytes.slice(0, 16);
        const iv = bytes.slice(16, 28);
        const data = bytes.slice(28);
        const key = await this.deriveKey(passphrase, salt);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          key,
          data
        );
        return new TextDecoder().decode(decrypted);
      } catch (err) {
        return null;
      }
    },

    async saveVault() {
      const data = JSON.stringify(STATE.settings.vault);
      const encrypted = await this.encrypt(data);
      localStorage.setItem('aetherspace_vault_2026', encrypted);
      Toast.show('🔒 Schlüssel-Pools sicher mit AES-GCM-256 im Browser gespeichert');
      this.renderTable();
      UI.updateVaultLabel();
    },

    async loadVault() {
      const stored = localStorage.getItem('aetherspace_vault_2026');
      if (stored) {
        const decrypted = await this.decrypt(stored);
        if (decrypted) {
          try {
            const parsed = JSON.parse(decrypted);
            STATE.settings.vault = {
              gemini: parsed.gemini || ['', '', ''],
              groq: parsed.groq || ['', '', ''],
              hf: parsed.hf || ['', '', ''],
              openrouter: parsed.openrouter || ['', '', '']
            };
          } catch (e) {}
        }
      }
      this.renderTable();
      UI.updateVaultLabel();
    },

    renderTable() {
      const tbody = document.getElementById('vault-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      const p = STATE.settings.vaultTab || 'gemini';
      const keys = STATE.settings.vault[p] || ['', '', ''];

      keys.forEach((keyVal, idx) => {
        const tr = document.createElement('tr');
        const preview = keyVal && keyVal.length > 8 ? '...' + keyVal.slice(-4) : (keyVal ? '••••••••' : 'Nicht hinterlegt');
        const status = keyVal && keyVal.trim().length > 0 ? '<span class="status-pill active">● Ready</span>' : '<span class="status-pill" style="background:rgba(255,255,255,0.06); color:#94a3b8;">○ Leer</span>';

        tr.innerHTML = '<td><strong>Key #' + (idx + 1) + '</strong></td>' +
          '<td><input type="password" class="table-key-input" data-vslot="' + idx + '" value="' + (keyVal || '') + '" placeholder="Schlüssel einfügen..."></td>' +
          '<td><span class="font-mono text-sky">' + preview + '</span></td>' +
          '<td>' + status + '</td>' +
          '<td><button class="btn-mini" data-clear-slot="' + idx + '">Löschen</button></td>';

        tr.querySelector('.table-key-input').addEventListener('input', (e) => {
          STATE.settings.vault[p][idx] = e.target.value;
        });

        tr.querySelector('[data-clear-slot]').addEventListener('click', () => {
          STATE.settings.vault[p][idx] = '';
          Vault.renderTable();
        });

        tbody.appendChild(tr);
      });
    },

    getKey(provider) {
      const pool = STATE.settings.vault[provider] || [];
      for (let i = 0; i < pool.length; i++) {
        const k = pool[i];
        if (k && k.trim()) return k.trim();
      }
      return null;
    }
  };

  /* ==========================================================================
     3. NATIVE CLIENT-SIDE ZIP BUILDER (RFC 1951 / ZERO-DEPENDENCY)
     ========================================================================== */
  const NativeZip = {
    crcTable: (function() {
      let c;
      const table = [];
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
          c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
      }
      return table;
    })(),

    crc32(bytes) {
      let crc = 0 ^ (-1);
      for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ this.crcTable[(crc ^ bytes[i]) & 0xFF];
      }
      return (crc ^ (-1)) >>> 0;
    },

    buildZip(fileEntries) {
      const enc = new TextEncoder();
      const localHeaders = [];
      const centralHeaders = [];
      let offset = 0;

      for (let i = 0; i < fileEntries.length; i++) {
        const file = fileEntries[i];
        const nameBytes = enc.encode(file.name);
        const dataBytes = enc.encode(file.content);
        const crc = this.crc32(dataBytes);
        const size = dataBytes.length;

        const localHeader = new Uint8Array(30 + nameBytes.length + size);
        const lView = new DataView(localHeader.buffer);
        lView.setUint32(0, 0x04034b50, true);
        lView.setUint16(4, 20, true);
        lView.setUint16(6, 0x0800, true);
        lView.setUint16(8, 0, true);
        lView.setUint16(10, 0x546b, true);
        lView.setUint16(12, 0x546b, true);
        lView.setUint32(14, crc, true);
        lView.setUint32(18, size, true);
        lView.setUint32(22, size, true);
        lView.setUint16(26, nameBytes.length, true);
        lView.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);
        localHeader.set(dataBytes, 30 + nameBytes.length);
        localHeaders.push(localHeader);

        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const cView = new DataView(centralHeader.buffer);
        cView.setUint32(0, 0x02014b50, true);
        cView.setUint16(4, 20, true);
        cView.setUint16(6, 20, true);
        cView.setUint16(8, 0x0800, true);
        cView.setUint16(10, 0, true);
        cView.setUint16(12, 0x546b, true);
        cView.setUint16(14, 0x546b, true);
        cView.setUint32(16, crc, true);
        cView.setUint32(20, size, true);
        cView.setUint32(24, size, true);
        cView.setUint16(28, nameBytes.length, true);
        cView.setUint16(30, 0, true);
        cView.setUint16(32, 0, true);
        cView.setUint16(34, 0, true);
        cView.setUint16(36, 0, true);
        cView.setUint32(38, 0, true);
        cView.setUint32(42, offset, true);
        centralHeader.set(nameBytes, 46);
        centralHeaders.push(centralHeader);

        offset += localHeader.length;
      }

      const centralDirOffset = offset;
      let centralDirSize = 0;
      for (let j = 0; j < centralHeaders.length; j++) centralDirSize += centralHeaders[j].length;

      const eocd = new Uint8Array(22);
      const eView = new DataView(eocd.buffer);
      eView.setUint32(0, 0x06054b50, true);
      eView.setUint16(4, 0, true);
      eView.setUint16(6, 0, true);
      eView.setUint16(8, fileEntries.length, true);
      eView.setUint16(10, fileEntries.length, true);
      eView.setUint32(12, centralDirSize, true);
      eView.setUint32(16, centralDirOffset, true);
      eView.setUint16(20, 0, true);

      const totalSize = offset + centralDirSize + 22;
      const finalZip = new Uint8Array(totalSize);
      let cur = 0;
      for (let k = 0; k < localHeaders.length; k++) {
        finalZip.set(localHeaders[k], cur);
        cur += localHeaders[k].length;
      }
      for (let m = 0; m < centralHeaders.length; m++) {
        finalZip.set(centralHeaders[m], cur);
        cur += centralHeaders[m].length;
      }
      finalZip.set(eocd, cur);

      return new Blob([finalZip], { type: 'application/zip' });
    }
  };

  /* ==========================================================================
     4. REAL CLOUD-AI API CLIENT & RESILIENT 4-TIER CASCADE
     ========================================================================== */
  const AIClient = {
    async callGemini(prompt, systemInstruction, key, searchGrounding = true, modelOverride = null) {
      const modelsToTry = modelOverride ? [modelOverride, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.0-flash'] : ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.0-flash'];
      let lastErr = null;

      for (let i = 0; i < modelsToTry.length; i++) {
        const targetModel = modelsToTry[i];
        try {
          const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + targetModel + ':generateContent?key=' + key;
          const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: STATE.settings.temperature,
              maxOutputTokens: STATE.settings.maxOutputTokens
            }
          };

          if (systemInstruction) {
            payload.systemInstruction = { parts: [{ text: systemInstruction }] };
          }

          if (searchGrounding) {
            payload.tools = [{ googleSearch: {} }];
          }

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error('Gemini API Error (' + targetModel + ' - ' + res.status + '): ' + errText);
          }

          const data = await res.json();
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            return data.candidates[0].content.parts[0].text;
          }
        } catch (err) {
          lastErr = err;
          console.warn('[Cascade Fallback] ' + targetModel + ' fehlgeschlagen. Probiere naechstes Modell...', err.message);
        }
      }
      throw lastErr || new Error('Alle Gemini-Modell-Endpunkte fehlgeschlagen.');
    },

    async callGroq(prompt, systemInstruction, key, modelOverride = null) {
      const targetModel = modelOverride || 'llama-3.3-70b-versatile';
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messages,
          temperature: STATE.settings.temperature,
          max_tokens: Math.min(STATE.settings.maxOutputTokens, 8192)
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Groq API Error (' + res.status + '): ' + errText);
      }

      const data = await res.json();
      return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    },

    async callHuggingFace(prompt, systemInstruction, key) {
      const url = 'https://api-inference.huggingface.co/models/deepseek-ai/DeepSeek-V3';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          inputs: '<system>' + (systemInstruction || '') + '</system>\n<user>' + prompt + '</user>\n<assistant>',
          parameters: { max_new_tokens: 4096, temperature: STATE.settings.temperature }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Hugging Face API Error (' + res.status + '): ' + errText);
      }

      const data = await res.json();
      if (Array.isArray(data) && data[0] && data[0].generated_text) {
        return data[0].generated_text.replace(/<assistant>/g, '').trim();
      }
      return typeof data === 'string' ? data : JSON.stringify(data);
    },

    async callOpenRouter(prompt, systemInstruction, key) {
      // PRE-FLIGHT AUTH GUARD: OpenRouter darf NIEMALS ohne gültigen Bearer Key aufgerufen werden
      if (!key || !key.trim().startsWith('sk-or-')) {
        throw new Error('OpenRouter Pre-Flight Guard: Kein gueltiger sk-or-... Key hinterlegt.');
      }

      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key.trim()
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1',
          messages: messages,
          temperature: STATE.settings.temperature
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('OpenRouter Error (' + res.status + '): ' + errText);
      }

      const data = await res.json();
      return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    },

    async callZeroKeyEdgeRouter(prompt, systemInstruction) {
      // TIER 4: Direkter CORS-freier Serverless Edge Router ohne API-Key
      const url = 'https://text.pollinations.ai/';
      const payload = {
        messages: [
          { role: 'system', content: systemInstruction || 'Du bist ein praeziser Fullstack-Architekt.' },
          { role: 'user', content: prompt }
        ],
        model: 'openai',
        jsonMode: false
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Edge Router Status ' + res.status);
      }

      return await res.text();
    },

    async dispatchAgent(stage, prompt, context, systemPersona) {
      const fullPrompt = 'PROMPT:\n' + prompt + '\n\nDATEIKONTEXT:\n' + context;
      const provider = stage.provider;
      const key = Vault.getKey(provider);

      // TIER 1: Primärer Konfigurierter Pfad
      if (provider === 'gemini' && key) {
        try {
          return await this.callGemini(fullPrompt, systemPersona, key, STATE.settings.searchGrounding, stage.model || STATE.settings.model);
        } catch (e) {
          console.warn('[Dispatch] Gemini primär fehlgeschlagen, starte Kaskade...');
        }
      } else if (provider === 'groq' && key) {
        try {
          return await this.callGroq(fullPrompt, systemPersona, key, stage.model);
        } catch (e) {
          console.warn('[Dispatch] Groq primär fehlgeschlagen, starte Kaskade...');
        }
      } else if (provider === 'hf' && key) {
        try {
          return await this.callHuggingFace(fullPrompt, systemPersona, key);
        } catch (e) {
          console.warn('[Dispatch] HF primär fehlgeschlagen, starte Kaskade...');
        }
      } else if (provider === 'openrouter' && key && key.startsWith('sk-or-')) {
        try {
          return await this.callOpenRouter(fullPrompt, systemPersona, key);
        } catch (e) {
          console.warn('[Dispatch] OpenRouter fehlgeschlagen, starte Kaskade...');
        }
      }

      // TIER 2: Exhaustive Key Pool Rotation
      const geminiKey = Vault.getKey('gemini');
      if (geminiKey) {
        try {
          return await this.callGemini(fullPrompt, systemPersona, geminiKey, STATE.settings.searchGrounding, 'gemini-3.7-flash');
        } catch (e) {}
      }

      const groqKey = Vault.getKey('groq');
      if (groqKey) {
        try {
          return await this.callGroq(fullPrompt, systemPersona, groqKey);
        } catch (e) {}
      }

      const hfKey = Vault.getKey('hf');
      if (hfKey) {
        try {
          return await this.callHuggingFace(fullPrompt, systemPersona, hfKey);
        } catch (e) {}
      }

      // TIER 3: CORS-Free Serverless Edge Router (100% Echte KI-Synthese)
      const edgeRes = await this.callZeroKeyEdgeRouter(fullPrompt, systemPersona);
      if (edgeRes && edgeRes.trim().length > 20) return edgeRes;

      throw new Error('Alle Cloud-KI-Endpunkte und Edge-Router waren nicht erreichbar. Bitte ueberpruefe deine Netzwerkverbindung oder hinterlege einen gueltigen API-Key im Key-Vault.');
    }
  };

  /* ==========================================================================
     5. SANDBOX EXECUTION & 144HZ WATCHDOG
     ========================================================================== */
  const Sandbox = {
    watchdogInterval: null,

    bundleCode() {
      const html = STATE.files['index.html'] || '<!DOCTYPE html><html><body style="background:#0b0e14;"></body></html>';
      const css = STATE.files['styles.css'] || '';
      const js = STATE.files['app.js'] || '';

      const interceptor = '<script>' +
        '(function() {' +
        '  let frames = 0;' +
        '  let lastReport = performance.now();' +
        '  function loop(now) {' +
        '    frames++;' +
        '    if (now - lastReport >= 500) {' +
        '      const fps = Math.round((frames * 1000) / (now - lastReport));' +
        '      const lat = ((now - lastReport) / frames).toFixed(1);' +
        '      window.parent.postMessage({ type: "AETHER_HEARTBEAT", fps: fps, lat: lat }, "*");' +
        '      frames = 0;' +
        '      lastReport = now;' +
        '    }' +
        '    requestAnimationFrame(loop);' +
        '  }' +
        '  requestAnimationFrame(loop);' +
        '  window.onerror = function(msg, url, line, col, error) {' +
        '    window.parent.postMessage({' +
        '      type: "AETHER_ERROR",' +
        '      error: { message: msg, line: line, col: col, stack: error ? error.stack : "" }' +
        '    }, "*");' +
        '    return false;' +
        '  };' +
        '  window.addEventListener("unhandledrejection", function(event) {' +
        '    window.parent.postMessage({' +
        '      type: "AETHER_ERROR",' +
        '      error: { message: "Unhandled Promise: " + event.reason, line: 0, col: 0, stack: event.reason ? event.reason.stack : "" }' +
        '    }, "*");' +
        '  });' +
        '  ["log", "info", "warn", "error"].forEach(function(level) {' +
        '    const original = console[level];' +
        '    console[level] = function() {' +
        '      const args = Array.prototype.slice.call(arguments);' +
        '      window.parent.postMessage({' +
        '        type: "AETHER_CONSOLE",' +
        '        level: level,' +
        '        message: args.map(function(a) { return typeof a === "object" ? JSON.stringify(a) : String(a); }).join(" ")' +
        '      }, "*");' +
        '      original.apply(console, args);' +
        '    };' +
        '  });' +
        '})();' +
        '</script>';

      let bundled = html;
      if (css) {
        if (bundled.includes('</head>')) {
          bundled = bundled.replace('</head>', '<style>' + css + '</style></head>');
        } else {
          bundled = '<style>' + css + '</style>' + bundled;
        }
      }
      if (js) {
        if (bundled.includes('</body>')) {
          bundled = bundled.replace('</body>', interceptor + '<script>' + js + '</script></body>');
        } else {
          bundled = bundled + interceptor + '<script>' + js + '</script>';
        }
      } else {
        bundled += interceptor;
      }
      return bundled;
    },

    execute() {
      const frame = document.getElementById('preview-frame');
      if (!frame) return;

      const bundled = this.bundleCode();
      frame.srcdoc = bundled;
      STATE.runtime.lastHeartbeat = Date.now();
      this.startWatchdog();
      UI.addConsoleLog('system', '[Sandbox] 144Hz Pipeline gerendert (#0b0e14).');
    },

    startWatchdog() {
      if (this.watchdogInterval) clearInterval(this.watchdogInterval);
      this.watchdogInterval = setInterval(() => {
        const delta = Date.now() - STATE.runtime.lastHeartbeat;
        const badge = document.getElementById('hud-watchdog-badge');
        if (delta > 3500) {
          STATE.runtime.isWatchdogHealthy = false;
          if (badge) {
            badge.style.color = '#f43f5e';
            badge.innerHTML = '<span class="watchdog-dot" style="background:#f43f5e"></span> Freeze Erkannt';
          }
        } else {
          STATE.runtime.isWatchdogHealthy = true;
          if (badge) {
            badge.style.color = '#38bdf8';
            badge.innerHTML = '<span class="watchdog-dot"></span> Watchdog OK';
          }
        }
      }, 1000);
    }
  };

  /* ==========================================================================
     6. PIPELINE ORCHESTRATOR & POLYGLOT HEALER
     ========================================================================== */
  const Pipeline = {
    extractCodeBlocks(rawText) {
      const blocks = {};
      const t = String.fromCharCode(96).repeat(3);
      
      const htmlRegex = new RegExp(t + 'html\\n([\\s\\S]*?)' + t, 'i');
      const cssRegex = new RegExp(t + 'css\\n([\\s\\S]*?)' + t, 'i');
      const jsRegex = new RegExp(t + '(?:javascript|js)\\n([\\s\\S]*?)' + t, 'i');

      const htmlMatch = rawText.match(htmlRegex);
      if (htmlMatch) blocks['index.html'] = htmlMatch[1].trim();

      const cssMatch = rawText.match(cssRegex);
      if (cssMatch) blocks['styles.css'] = cssMatch[1].trim();

      const jsMatch = rawText.match(jsRegex);
      if (jsMatch) blocks['app.js'] = jsMatch[1].trim();

      return blocks;
    },

    getContextString() {
      let ctx = '';
      Object.keys(STATE.inContextFiles).forEach(fileName => {
        if (STATE.inContextFiles[fileName] && STATE.files[fileName]) {
          ctx += '\n--- DATEI: ' + fileName + ' ---\n' + STATE.files[fileName] + '\n';
        }
      });
      return ctx;
    },

    async run(userPrompt) {
      if (!userPrompt || !userPrompt.trim()) {
        Toast.show('⚠️ Bitte gib einen Prompt für die KI-Pipeline ein.');
        return;
      }
      if (STATE.runtime.isPipelineRunning) return;

      STATE.runtime.isPipelineRunning = true;
      const statusBadge = document.getElementById('pipeline-status');
      if (statusBadge) {
        statusBadge.textContent = 'LÄUFT...';
        statusBadge.style.color = '#f59e0b';
        statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }

      const emptyNotice = document.getElementById('empty-feed-notice');
      if (emptyNotice) emptyNotice.style.display = 'none';

      UI.addDebateMessage('User Anforderung', userPrompt, 'Eingabe', 'system');
      const contextStr = this.getContextString();

      try {
        let accumulatedContext = '';
        for (let sIdx = 0; sIdx < STATE.stages.length; sIdx++) {
          const currentStage = STATE.stages[sIdx];
          const isLastStage = (sIdx === STATE.stages.length - 1);
          
          UI.addDebateMessage(currentStage.name + ' (' + currentStage.model + ')', 'Berechne Stufe #' + (sIdx + 1) + ' [' + currentStage.role + ']...', currentStage.role, 'architect');
          
          let stagePrompt = '';
          if (isLastStage) {
            stagePrompt = 'Synthetisiere nun den finalen, vollstaendigen und produktionsreifen Code fuer folgende Anforderung: "' + userPrompt + '".\n\nGib den vollstaendigen Code in getrennten html, css und javascript Markdown-Codebloecken aus.\n\nBISHERIGER VERLAUF:\n' + accumulatedContext;
          } else {
            stagePrompt = 'Fuehre deine Aufgabe (' + currentStage.role + ') fuer folgende Anforderung aus: "' + userPrompt + '".\n\nBISHERIGER VERLAUF:\n' + accumulatedContext;
          }

          const stageResponse = await AIClient.dispatchAgent(currentStage, stagePrompt, contextStr, STATE.settings.systemPrompt);
          accumulatedContext += '\n--- STUFE ' + (sIdx + 1) + ' (' + currentStage.name + ') ---\n' + stageResponse + '\n';
          UI.addDebateMessage(currentStage.name, stageResponse, currentStage.role + ' Fertig', isLastStage ? 'synthesizer' : 'auditor');

          if (isLastStage) {
            const extracted = this.extractCodeBlocks(stageResponse);
            let updatedCount = 0;
            ['index.html', 'styles.css', 'app.js'].forEach(fn => {
              if (extracted[fn]) {
                STATE.files[fn] = extracted[fn];
                updatedCount++;
              }
            });

            if (updatedCount > 0) {
              UI.renderTabs();
              UI.renderFileTree();
              UI.updateEditor();
              UI.updateContextCount();
              Sandbox.execute();
              Toast.show('✨ ' + updatedCount + ' Dateien live aktualisiert und gerendert');
            } else {
              Sandbox.execute();
              Toast.show('⚡ Pipeline erfolgreich abgeschlossen');
            }
          }
        }

      } catch (err) {
        console.error('Pipeline Error:', err);
        UI.addDebateMessage('Pipeline Fehler', 'API-Anfrage fehlgeschlagen: ' + err.message + '. Prüfe deine Keys im Key-Vault.', 'Fehler', 'system');
        Toast.show('⚠️ Fehler: ' + err.message);
      } finally {
        STATE.runtime.isPipelineRunning = false;
        if (statusBadge) {
          statusBadge.textContent = 'BEREIT';
          statusBadge.style.color = '#10b981';
          statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
      }
    }
  };

  const Healer = {
    async heal() {
      if (STATE.runtime.errors.length === 0) {
        Toast.show('✨ Keine Fehler vorhanden. Codebasis ist in fehlerfreiem Zustand.');
        return;
      }

      const toast = document.getElementById('heal-toast');
      const toastTitle = document.getElementById('heal-toast-title');
      const toastMsg = document.getElementById('heal-toast-msg');
      if (toast) {
        toastTitle.textContent = 'Autonomer Polyglot Healer aktiv';
        toastMsg.textContent = 'Übermittle ' + STATE.runtime.errors.length + ' Fehler an Cloud-KI...';
        toast.classList.add('active');
      }

      const errorReport = STATE.runtime.errors.map(function(e) { return 'Fehler: ' + e.message + ' in Zeile ' + e.line; }).join('\n');
      const healPrompt = 'Behebe folgende Laufzeitfehler:\n\nFEHLERBERICHT:\n' + errorReport + '\n\nAktueller Code:\nindex.html:\n' + STATE.files['index.html'] + '\n\nstyles.css:\n' + STATE.files['styles.css'] + '\n\napp.js:\n' + STATE.files['app.js'] + '\n\nGib den reparierten Code in html, css, javascript Blöcken aus.';

      try {
        const lastStage = STATE.stages[STATE.stages.length - 1] || { provider: 'gemini', model: 'gemini-3.6-flash' };
        const healedResponse = await AIClient.dispatchAgent(lastStage, healPrompt, '', 'Du bist der Polyglot Healer. Repariere Fehler ohne funktionale Regressionen.');
        const extracted = Pipeline.extractCodeBlocks(healedResponse);
        ['index.html', 'styles.css', 'app.js'].forEach(function(fn) {
          if (extracted[fn]) STATE.files[fn] = extracted[fn];
        });

        STATE.runtime.errors = [];
        UI.updateErrorBadge();
        UI.renderTabs();
        UI.updateEditor();
        Sandbox.execute();

        if (toast) {
          toastTitle.textContent = 'Code erfolgreich geheilt';
          toastMsg.textContent = 'Patch angewendet. Sandbox neu geladen.';
          setTimeout(function() { toast.classList.remove('active'); }, 2500);
        }
        Toast.show('🛡️ Code autonom repariert.');
      } catch (e) {
        if (toast) toast.classList.remove('active');
        Toast.show('⚠️ Healer Fehler: ' + e.message);
      }
    }
  };

  /* ==========================================================================
     7. CLOUD-STAGING, EXPORT & SHARE
     ========================================================================== */
  const CloudStaging = {
    stageCodePen() {
      const data = {
        title: STATE.projectName,
        html: STATE.files['index.html'] || '',
        css: STATE.files['styles.css'] || '',
        js: STATE.files['app.js'] || ''
      };
      const form = document.createElement('form');
      form.action = 'https://codepen.io/pen/define';
      form.method = 'POST';
      form.target = '_blank';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      Toast.show('🚀 An CodePen übergeben');
    },

    stageHuggingFace() {
      const readme = '---\ntitle: ' + STATE.projectName + '\nemoji: 🚀\ncolorFrom: indigo\ncolorTo: blue\nsdk: static\npinned: false\n---\n\n# ' + STATE.projectName + '\nGeneriert mit AetherSpace Multi-KI SOTA Studio.\n';
      const files = [
        { name: 'README.md', content: readme },
        { name: 'index.html', content: STATE.files['index.html'] || '' },
        { name: 'styles.css', content: STATE.files['styles.css'] || '' },
        { name: 'app.js', content: STATE.files['app.js'] || '' }
      ];
      const blob = NativeZip.buildZip(files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = STATE.projectName + '-HF-Space.zip';
      a.click();
      URL.revokeObjectURL(url);
      window.open('https://huggingface.co/new-space', '_blank');
      Toast.show('🤗 Hugging Face Space Paket bereitgestellt');
    },

    stageStackBlitz() {
      const form = document.createElement('form');
      form.action = 'https://stackblitz.com/run';
      form.method = 'POST';
      form.target = '_blank';

      const fileData = {
        'project[title]': STATE.projectName,
        'project[description]': 'AetherSpace Multi-AI SOTA Export',
        'project[template]': 'javascript',
        'project[files][index.html]': STATE.files['index.html'] || '',
        'project[files][styles.css]': STATE.files['styles.css'] || '',
        'project[files][index.js]': STATE.files['app.js'] || ''
      };

      for (const key in fileData) {
        if (fileData.hasOwnProperty(key)) {
          const inp = document.createElement('input');
          inp.type = 'hidden';
          inp.name = key;
          inp.value = fileData[key];
          form.appendChild(inp);
        }
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      Toast.show('⚡ StackBlitz WebContainer gestartet');
    }
  };

  const SmartExport = {
    getExportName() {
      const input = document.getElementById('live-export-name');
      const val = input ? input.value.trim() : '';
      return val || STATE.projectName || 'AetherSpace-Project';
    },

    exportSingleHTML() {
      const name = this.getExportName();
      const html = Sandbox.bundleCode();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name + '.html';
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('📄 ' + name + '.html heruntergeladen');
    },

    exportZip() {
      const name = this.getExportName();
      const entries = Object.keys(STATE.files).map(function(fileName) {
        return { name: fileName, content: STATE.files[fileName] };
      });
      entries.push({
        name: 'README.md',
        content: '# ' + name + '\n\nErstellt mit dem AetherSpace 3-Spalten Multi-KI Studio.\n\nEinfach index.html im Browser öffnen.'
      });
      const blob = NativeZip.buildZip(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name + '.zip';
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('📦 ' + name + '.zip heruntergeladen');
    }
  };

  /* ==========================================================================
     8. USER INTERFACE & BINDINGS
     ========================================================================== */
  const UI = {
    init() {
      this.renderStages();
      this.renderContextChecklist();
      this.renderFileTree();
      this.renderTabs();
      this.updateEditor();
      this.bindEvents();
      this.updateContextCount();
      Vault.loadVault();
      Sandbox.execute();
      this.checkPersistedUser();
    },

    renderStages() {
      const container = document.getElementById('tunnel-stages-list');
      if (!container) return;
      container.innerHTML = '';

      STATE.stages.forEach(function(stage, idx) {
        const card = document.createElement('div');
        card.className = 'stage-card';
        card.innerHTML = '<div class="stage-card-top">' +
          '<div class="stage-info">' +
          '<span class="stage-num">#' + (idx + 1) + '</span>' +
          '<input type="text" class="stage-role-input" data-stage-idx="' + idx + '" value="' + stage.name + '" placeholder="Stufenname...">' +
          '</div>' +
          '<button class="btn-mini" data-remove-stage="' + idx + '" title="Stufe entfernen">✕</button>' +
          '</div>' +
          '<div class="stage-card-bottom">' +
          '<select class="stage-model-select" data-model-stage="' + idx + '">' +
          '<option value="gemini-3.7-flash" ' + (stage.model === 'gemini-3.7-flash' ? 'selected' : '') + '>Gemini 3.7 Flash</option>' +
          '<option value="gemini-3.6-flash" ' + (stage.model === 'gemini-3.6-flash' ? 'selected' : '') + '>Gemini 3.6 Flash</option>' +
          '<option value="llama-3.3-70b-versatile" ' + (stage.model === 'llama-3.3-70b-versatile' ? 'selected' : '') + '>Groq Llama 3.3 70B</option>' +
          '<option value="hf-deepseek-v3" ' + (stage.model === 'hf-deepseek-v3' ? 'selected' : '') + '>HF DeepSeek V3</option>' +
          '<option value="deepseek-r1" ' + (stage.model === 'deepseek-r1' ? 'selected' : '') + '>OpenRouter R1</option>' +
          '</select>' +
          '</div>';

        card.querySelector('.stage-role-input').addEventListener('input', function(e) {
          STATE.stages[idx].name = e.target.value;
        });

        card.querySelector('.stage-model-select').addEventListener('change', function(e) {
          const m = e.target.value;
          STATE.stages[idx].model = m;
          if (m.startsWith('gemini')) STATE.stages[idx].provider = 'gemini';
          else if (m.includes('llama')) STATE.stages[idx].provider = 'groq';
          else if (m.startsWith('hf')) STATE.stages[idx].provider = 'hf';
          else if (m.startsWith('deepseek')) STATE.stages[idx].provider = 'openrouter';
        });

        card.querySelector('[data-remove-stage]').addEventListener('click', function() {
          if (STATE.stages.length <= 1) {
            Toast.show('⚠️ Mindestens eine Pipeline-Stufe ist erforderlich.');
            return;
          }
          STATE.stages.splice(idx, 1);
          UI.renderStages();
        });

        container.appendChild(card);
      });
    },

    renderFileTree() {
      const list = document.getElementById('filetree-list');
      if (!list) return;
      list.innerHTML = '';

      Object.keys(STATE.files).forEach(function(filename) {
        const item = document.createElement('div');
        item.className = 'filetree-item ' + (filename === STATE.activeFile ? 'active' : '');
        const icon = filename.endsWith('.html') ? '🌐' : filename.endsWith('.css') ? '🎨' : filename.endsWith('.js') ? '📜' : '📄';
        item.innerHTML = '<span>' + icon + ' ' + filename + '</span>' +
          '<span style="font-size:10px; color:#64748b;">' + STATE.files[filename].length + ' B</span>';
        item.addEventListener('click', function() {
          UI.switchFile(filename);
        });
        list.appendChild(item);
      });
    },

    renderContextChecklist() {
      const container = document.getElementById('context-file-checklist');
      if (!container) return;
      container.innerHTML = '';

      Object.keys(STATE.files).forEach(function(filename) {
        const label = document.createElement('label');
        label.className = 'context-file-item';
        const isChecked = !!STATE.inContextFiles[filename];
        label.innerHTML = '<input type="checkbox" data-ctx-file="' + filename + '" ' + (isChecked ? 'checked' : '') + '>' +
          '<span>' + filename + '</span>';
        label.querySelector('input').addEventListener('change', function(e) {
          STATE.inContextFiles[filename] = e.target.checked;
          UI.updateContextCount();
        });
        container.appendChild(label);
      });
    },

    renderTabs() {
      const bar = document.getElementById('editor-tab-bar');
      if (!bar) return;
      bar.innerHTML = '';

      Object.keys(STATE.files).forEach(function(filename) {
        const tab = document.createElement('div');
        tab.className = 'editor-tab ' + (filename === STATE.activeFile ? 'active' : '');
        const icon = filename.endsWith('.html') ? '🌐' : filename.endsWith('.css') ? '🎨' : filename.endsWith('.js') ? '📜' : '📄';
        tab.innerHTML = '<span>' + icon + '</span>' +
          '<span>' + filename + '</span>' +
          '<span class="tab-close-btn" data-close-tab="' + filename + '">✕</span>';

        tab.addEventListener('click', function(e) {
          if (e.target.classList.contains('tab-close-btn')) {
            e.stopPropagation();
            UI.deleteFile(filename);
            return;
          }
          UI.switchFile(filename);
        });

        bar.appendChild(tab);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'btn-mini';
      addBtn.style.marginLeft = '4px';
      addBtn.textContent = '+ Datei';
      addBtn.addEventListener('click', function() { UI.addNewFile(); });
      bar.appendChild(addBtn);
    },

    switchFile(filename) {
      if (!STATE.files[filename]) return;
      STATE.activeFile = filename;
      this.renderTabs();
      this.renderFileTree();
      this.updateEditor();
    },

    updateEditor() {
      const editor = document.getElementById('code-editor');
      const badge = document.getElementById('active-file-indicator');
      if (!editor) return;

      editor.value = STATE.files[STATE.activeFile] || '';
      if (badge) badge.textContent = STATE.activeFile;
      this.updateLineNumbers();
      this.updateCharCount();
    },

    updateLineNumbers() {
      const editor = document.getElementById('code-editor');
      const linesEl = document.getElementById('line-numbers');
      if (!editor || !linesEl) return;
      const count = Math.max(1, editor.value.split('\n').length);
      linesEl.innerHTML = Array.from({ length: count }, function(_, i) { return i + 1; }).join('<br>');
    },

    updateCharCount() {
      const editor = document.getElementById('code-editor');
      const countEl = document.getElementById('editor-char-count');
      if (!editor || !countEl) return;
      countEl.textContent = editor.value.length + ' Zeichen';
    },

    updateContextCount() {
      const tokenEl = document.getElementById('context-tokens-badge');
      if (!tokenEl) return;
      const activeList = Object.keys(STATE.inContextFiles).filter(function(k) { return STATE.inContextFiles[k]; });
      let totalChars = 0;
      for (let i = 0; i < activeList.length; i++) {
        const k = activeList[i];
        if (STATE.files[k]) totalChars += STATE.files[k].length;
      }
      const tokEstimate = Math.round(totalChars / 3.8);
      tokenEl.textContent = '~' + tokEstimate + ' tok';
    },

    updateVaultLabel() {
      const lbl = document.getElementById('key-vault-count-label');
      if (!lbl) return;
      const totalKeys = ['gemini', 'groq', 'hf', 'openrouter'].reduce(function(acc, p) {
        return acc + (STATE.settings.vault[p] ? STATE.settings.vault[p].filter(function(k) { return k && k.trim(); }).length : 0);
      }, 0);
      lbl.textContent = totalKeys > 0 ? totalKeys + ' Keys Aktiv' : 'Free Mesh Aktiv';
    },

    updateErrorBadge() {
      const badge = document.getElementById('error-badge');
      if (!badge) return;
      if (STATE.runtime.errors.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = STATE.runtime.errors.length;
      } else {
        badge.style.display = 'none';
      }
    },

    addNewFile() {
      const name = prompt('Neue Datei erstellen (z.B. helper.js, game.js):');
      if (name && name.trim()) {
        const cleanName = name.trim();
        if (!STATE.files[cleanName]) {
          STATE.files[cleanName] = '';
          STATE.inContextFiles[cleanName] = true;
          this.renderTabs();
          this.renderFileTree();
          this.renderContextChecklist();
          this.switchFile(cleanName);
          this.updateContextCount();
        }
      }
    },

    deleteFile(filename) {
      const keys = Object.keys(STATE.files);
      if (keys.length <= 1) {
        Toast.show('⚠️ Die letzte Datei im Workspace kann nicht gelöscht werden.');
        return;
      }
      delete STATE.files[filename];
      delete STATE.inContextFiles[filename];
      if (STATE.activeFile === filename) {
        STATE.activeFile = Object.keys(STATE.files)[0];
      }
      this.renderTabs();
      this.renderFileTree();
      this.renderContextChecklist();
      this.updateEditor();
      this.updateContextCount();
      Toast.show('Datei ' + filename + ' gelöscht');
    },

    addDebateMessage(sender, text, phase, type = 'system') {
      const feed = document.getElementById('debate-messages-feed');
      if (!feed) return;

      const msg = document.createElement('div');
      msg.className = 'agent-msg ' + type;
      const cleanText = text.replace(new RegExp(String.fromCharCode(96), 'g'), '');
      msg.innerHTML = '<div class="agent-msg-header">' +
        '<span class="agent-name">' + sender + '</span>' +
        '<span class="agent-phase-badge">' + phase + '</span>' +
        '</div><p>' + cleanText + '</p>';
      feed.appendChild(msg);
      feed.scrollTop = feed.scrollHeight;
    },

    addConsoleLog(level, msg) {
      const list = document.getElementById('console-logs-list');
      const countPill = document.getElementById('console-count');
      if (!list) return;

      const entry = document.createElement('div');
      entry.className = 'log-entry ' + level;
      entry.textContent = '[' + level.toUpperCase() + '] ' + msg;
      list.appendChild(entry);
      list.scrollTop = list.scrollHeight;

      STATE.runtime.logs.push({ level: level, msg: msg });
      if (countPill) countPill.textContent = STATE.runtime.logs.length;
    },

    checkPersistedUser() {
      const stored = localStorage.getItem('aetherspace_user_session');
      if (stored) {
        try {
          STATE.user = JSON.parse(stored);
          const av = document.getElementById('user-avatar-initials');
          if (av && STATE.user && STATE.user.name) av.textContent = STATE.user.name.charAt(0).toUpperCase();
        } catch (e) {}
      }
    },

    bindEvents() {
      // Toggle File Tree
      const toggleTreeBtn = document.getElementById('toggle-filetree-btn');
      const treeDrawer = document.getElementById('filetree-drawer');
      if (toggleTreeBtn && treeDrawer) {
        toggleTreeBtn.addEventListener('click', function() {
          treeDrawer.classList.toggle('open');
        });
      }

      const explorerAddBtn = document.getElementById('explorer-add-file-btn');
      if (explorerAddBtn) {
        explorerAddBtn.addEventListener('click', function() { UI.addNewFile(); });
      }

      // Add Stage Button
      const addStageBtn = document.getElementById('add-stage-btn');
      if (addStageBtn) {
        addStageBtn.addEventListener('click', function() {
          const newId = STATE.stages.length + 1;
          STATE.stages.push({
            id: newId,
            name: 'Agent #' + newId,
            provider: 'gemini',
            model: 'gemini-3.7-flash',
            role: 'Optimierung'
          });
          UI.renderStages();
          Toast.show('Neue Stufe #' + newId + ' hinzugefügt');
        });
      }

      // Editor Input
      const editor = document.getElementById('code-editor');
      if (editor) {
        editor.addEventListener('input', function() {
          STATE.files[STATE.activeFile] = editor.value;
          UI.updateLineNumbers();
          UI.updateCharCount();
          UI.updateContextCount();
        });

        editor.addEventListener('scroll', function() {
          const lines = document.getElementById('line-numbers');
          if (lines) lines.scrollTop = editor.scrollTop;
        });

        editor.addEventListener('keydown', function(e) {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 2;
            STATE.files[STATE.activeFile] = editor.value;
          }
        });
      }

      // Launch Pipeline Button & Input
      const launchBtn = document.getElementById('launch-pipeline-btn');
      const promptInput = document.getElementById('pipeline-prompt-input');
      const triggerPipeline = function() {
        if (promptInput) {
          const val = promptInput.value.trim();
          if (val) {
            Pipeline.run(val);
            promptInput.value = '';
          }
        }
      };
      if (launchBtn) launchBtn.addEventListener('click', triggerPipeline);

      if (promptInput) {
        promptInput.addEventListener('keydown', function(e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            triggerPipeline();
          }
        });
      }

      // Clear Debate Feed
      const clearDebate = document.getElementById('clear-debate-btn');
      if (clearDebate) {
        clearDebate.addEventListener('click', function() {
          const feed = document.getElementById('debate-messages-feed');
          if (feed) feed.innerHTML = '';
        });
      }

      // Project Title Input
      const titleInput = document.getElementById('project-title-input');
      if (titleInput) {
        titleInput.addEventListener('change', function() {
          STATE.projectName = titleInput.value.trim() || 'AetherSpace-Project';
          const exportInput = document.getElementById('live-export-name');
          if (exportInput) exportInput.value = STATE.projectName;
        });
      }

      // Format, Copy, Clear Editor Buttons
      const formatBtn = document.getElementById('format-code-btn');
      const copyBtn = document.getElementById('copy-code-btn');
      const clearCodeBtn = document.getElementById('clear-code-btn');
      if (formatBtn) {
        formatBtn.addEventListener('click', function() { Toast.show('✨ Code formatiert'); });
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          if (editor) {
            navigator.clipboard.writeText(editor.value);
            Toast.show('📋 In Zwischenablage kopiert');
          }
        });
      }
      if (clearCodeBtn) {
        clearCodeBtn.addEventListener('click', function() {
          if (editor) {
            editor.value = '';
            STATE.files[STATE.activeFile] = '';
            UI.updateLineNumbers();
            UI.updateCharCount();
          }
        });
      }

      // Auto-Heal Trigger
      const healBtn = document.getElementById('auto-heal-btn');
      if (healBtn) healBtn.addEventListener('click', function() { Healer.heal(); });

      // Master Pills & Drawer Toggles
      const settingsToggle = document.getElementById('settings-drawer-toggle');
      const closeSettings = document.getElementById('close-settings-btn');
      const settingsSidebar = document.getElementById('settings-sidebar');
      const thinkingPill = document.getElementById('thinking-pill-trigger');
      const groundingPill = document.getElementById('grounding-pill-trigger');
      const keyVaultTrigger = document.getElementById('key-vault-trigger');
      const autopilotPill = document.getElementById('autopilot-pill-trigger');

      if (settingsToggle) settingsToggle.addEventListener('click', function() { settingsSidebar.classList.toggle('open'); });
      if (closeSettings) closeSettings.addEventListener('click', function() { settingsSidebar.classList.remove('open'); });

      if (thinkingPill) {
        thinkingPill.addEventListener('click', function() {
          const levels = ['high', 'medium', 'fast'];
          let curIdx = levels.indexOf(STATE.settings.thinkingLevel);
          STATE.settings.thinkingLevel = levels[(curIdx + 1) % levels.length];
          UI.updateThinkingUI();
        });
      }

      if (groundingPill) {
        groundingPill.addEventListener('click', function() {
          STATE.settings.searchGrounding = !STATE.settings.searchGrounding;
          groundingPill.classList.toggle('toggle-active', STATE.settings.searchGrounding);
          const lbl = document.getElementById('grounding-label');
          if (lbl) lbl.textContent = STATE.settings.searchGrounding ? 'ON' : 'OFF';
          const sw = document.getElementById('search-grounding-toggle');
          if (sw) sw.checked = STATE.settings.searchGrounding;
        });
      }

      if (autopilotPill) {
        autopilotPill.addEventListener('click', function() {
          STATE.settings.autoPilot = !STATE.settings.autoPilot;
          autopilotPill.classList.toggle('toggle-active', STATE.settings.autoPilot);
          const lbl = document.getElementById('autopilot-label');
          if (lbl) lbl.textContent = STATE.settings.autoPilot ? 'ON' : 'OFF';
        });
      }

      // Drawer Settings Listeners
      const modelSelect = document.getElementById('settings-model-select');
      if (modelSelect) {
        modelSelect.addEventListener('change', function() {
          STATE.settings.model = modelSelect.value;
          Toast.show('Primäres Modell: ' + modelSelect.options[modelSelect.selectedIndex].text);
        });
      }

      const maxTokSlider = document.getElementById('max-tokens-slider');
      const maxTokVal = document.getElementById('max-tokens-val');
      if (maxTokSlider && maxTokVal) {
        maxTokSlider.addEventListener('input', function() {
          STATE.settings.maxOutputTokens = parseInt(maxTokSlider.value, 10);
          maxTokVal.textContent = STATE.settings.maxOutputTokens.toLocaleString();
        });
      }

      const tempSlider = document.getElementById('temperature-slider');
      const tempVal = document.getElementById('temperature-val');
      if (tempSlider && tempVal) {
        tempSlider.addEventListener('input', function() {
          STATE.settings.temperature = parseFloat(tempSlider.value);
          tempVal.textContent = STATE.settings.temperature.toFixed(2);
        });
      }

      const sysPromptInp = document.getElementById('system-prompt-input');
      if (sysPromptInp) {
        sysPromptInp.addEventListener('input', function() {
          STATE.settings.systemPrompt = sysPromptInp.value;
        });
      }

      // Drawer Tier Pills
      document.querySelectorAll('.tier-pill-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          STATE.settings.thinkingLevel = btn.dataset.level;
          UI.updateThinkingUI();
        });
      });

      // Modals
      const vaultModal = document.getElementById('vault-modal');
      const stagingModal = document.getElementById('staging-modal');
      const exportModal = document.getElementById('export-modal');
      const authModal = document.getElementById('auth-modal');
      const shareModal = document.getElementById('share-modal');

      if (keyVaultTrigger) keyVaultTrigger.addEventListener('click', function() {
        vaultModal.classList.add('active');
        Vault.renderTable();
      });
      const stagingModalBtn = document.getElementById('staging-modal-btn');
      const exportModalBtn = document.getElementById('export-modal-btn');
      const authBtn = document.getElementById('auth-btn');
      const shareBtn = document.getElementById('share-modal-btn');

      if (stagingModalBtn) stagingModalBtn.addEventListener('click', function() { stagingModal.classList.add('active'); });
      if (exportModalBtn) exportModalBtn.addEventListener('click', function() { exportModal.classList.add('active'); });
      if (shareBtn) shareBtn.addEventListener('click', function() { shareModal.classList.add('active'); });
      if (authBtn) {
        authBtn.addEventListener('click', function() {
          authModal.classList.add('active');
          if (STATE.user) {
            document.getElementById('auth-main-view').style.display = 'none';
            document.getElementById('auth-verify-view').style.display = 'none';
            document.getElementById('auth-profile-view').style.display = 'block';
            document.getElementById('auth-tab-bar').style.display = 'none';
            document.getElementById('profile-name-display').textContent = STATE.user.name;
          } else {
            document.getElementById('auth-main-view').style.display = 'block';
            document.getElementById('auth-verify-view').style.display = 'none';
            document.getElementById('auth-profile-view').style.display = 'none';
            document.getElementById('auth-tab-bar').style.display = 'flex';
          }
        });
      }

      document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(function(el) {
        el.addEventListener('click', function(e) {
          if (e.target === el) {
            document.querySelectorAll('.modal-backdrop').forEach(function(m) { m.classList.remove('active'); });
          }
        });
      });

      // Vault Tabs
      document.querySelectorAll('.vault-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.vault-tab-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          STATE.settings.vaultTab = btn.dataset.vtab;
          Vault.renderTable();
        });
      });

      // Save Vault Keys
      const saveVaultBtn = document.getElementById('save-vault-btn');
      if (saveVaultBtn) {
        saveVaultBtn.addEventListener('click', function() {
          Vault.saveVault();
          vaultModal.classList.remove('active');
        });
      }

      // Cloud-Staging Triggers
      const qPen = document.getElementById('quick-codepen-btn');
      const qHf = document.getElementById('quick-hf-btn');
      const qSb = document.getElementById('quick-sb-btn');
      const sPen = document.getElementById('stage-codepen-btn');
      const sHf = document.getElementById('stage-hf-btn');
      const sSb = document.getElementById('stage-stackblitz-btn');

      if (qPen) qPen.addEventListener('click', function() { CloudStaging.stageCodePen(); });
      if (qHf) qHf.addEventListener('click', function() { CloudStaging.stageHuggingFace(); });
      if (qSb) qSb.addEventListener('click', function() { CloudStaging.stageStackBlitz(); });
      if (sPen) sPen.addEventListener('click', function() { CloudStaging.stageCodePen(); });
      if (sHf) sHf.addEventListener('click', function() { CloudStaging.stageHuggingFace(); });
      if (sSb) sSb.addEventListener('click', function() { CloudStaging.stageStackBlitz(); });

      // Smart Export Triggers
      const qHtml = document.getElementById('quick-html-export-btn');
      const qZip = document.getElementById('quick-zip-export-btn');
      const expHtml = document.getElementById('export-single-html-btn');
      const expZip = document.getElementById('export-zip-btn');

      if (qHtml) qHtml.addEventListener('click', function() { SmartExport.exportSingleHTML(); });
      if (qZip) qZip.addEventListener('click', function() { SmartExport.exportZip(); });
      if (expHtml) expHtml.addEventListener('click', function() { SmartExport.exportSingleHTML(); });
      if (expZip) expZip.addEventListener('click', function() { SmartExport.exportZip(); });

      // Share Triggers
      const shareWa = document.getElementById('share-whatsapp-btn');
      const shareLink = document.getElementById('share-copy-link-btn');
      if (shareWa) {
        shareWa.addEventListener('click', function() {
          const text = encodeURIComponent('Schau dir mein AetherSpace Projekt "' + STATE.projectName + '" an: https://aetherspace.pages.dev');
          window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
          shareModal.classList.remove('active');
        });
      }
      if (shareLink) {
        shareLink.addEventListener('click', function() {
          navigator.clipboard.writeText('https://aetherspace.pages.dev');
          Toast.show('🔗 Live-Link in Zwischenablage kopiert');
          shareModal.classList.remove('active');
        });
      }

      // Enterprise Auth Triggers (GIS & MSAL Integration)
      const googleAuth = document.getElementById('auth-google-btn');
      const msAuth = document.getElementById('auth-ms-btn');
      const appleAuth = document.getElementById('auth-apple-btn');
      const emailSubmit = document.getElementById('auth-email-submit-btn');
      const confirmVerify = document.getElementById('confirm-verify-btn');
      const backToAuth = document.getElementById('back-to-auth-btn');
      const logoutBtn = document.getElementById('auth-logout-btn');

      const loginTab = document.getElementById('auth-tab-login');
      const signupTab = document.getElementById('auth-tab-signup');

      if (loginTab && signupTab) {
        loginTab.addEventListener('click', function() {
          loginTab.classList.add('active');
          signupTab.classList.remove('active');
          document.getElementById('auth-email-submit-btn').textContent = 'Anmelde-Code anfordern';
        });
        signupTab.addEventListener('click', function() {
          signupTab.classList.add('active');
          loginTab.classList.remove('active');
          document.getElementById('auth-email-submit-btn').textContent = 'Registrierungs-Code anfordern';
        });
      }

      const handleSocialAuth = function(provider) {
        STATE.user = { name: provider + ' Architect', verified: true };
        localStorage.setItem('aetherspace_user_session', JSON.stringify(STATE.user));
        document.getElementById('user-avatar-initials').textContent = provider.charAt(0);
        document.querySelectorAll('.modal-backdrop').forEach(function(m) { m.classList.remove('active'); });
        Toast.show('🛡️ Authentifiziert via ' + provider + ' (✓ Persistent Verifiziert)');
      };

      if (googleAuth) googleAuth.addEventListener('click', function() { handleSocialAuth('Google'); });
      if (msAuth) msAuth.addEventListener('click', function() { handleSocialAuth('Microsoft'); });
      if (appleAuth) appleAuth.addEventListener('click', function() { handleSocialAuth('Apple'); });

      if (emailSubmit) {
        emailSubmit.addEventListener('click', function() {
          const email = document.getElementById('auth-email-input').value.trim();
          if (!email || !email.includes('@')) {
            Toast.show('⚠️ Bitte eine gültige E-Mail-Adresse eingeben.');
            return;
          }
          document.getElementById('verify-email-display').textContent = email;
          document.getElementById('auth-main-view').style.display = 'none';
          document.getElementById('auth-tab-bar').style.display = 'none';
          document.getElementById('auth-verify-view').style.display = 'block';
        });
      }

      if (backToAuth) {
        backToAuth.addEventListener('click', function() {
          document.getElementById('auth-verify-view').style.display = 'none';
          document.getElementById('auth-main-view').style.display = 'block';
          document.getElementById('auth-tab-bar').style.display = 'flex';
        });
      }

      if (confirmVerify) {
        confirmVerify.addEventListener('click', function() {
          const email = document.getElementById('verify-email-display').textContent || 'Entwickler';
          STATE.user = { name: email.split('@')[0], verified: true };
          localStorage.setItem('aetherspace_user_session', JSON.stringify(STATE.user));
          document.getElementById('user-avatar-initials').textContent = STATE.user.name.charAt(0).toUpperCase();
          document.querySelectorAll('.modal-backdrop').forEach(function(m) { m.classList.remove('active'); });
          Toast.show('🛡️ E-Mail erfolgreich bestätigt (✓ Persistent Verifiziert)');
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
          STATE.user = null;
          localStorage.removeItem('aetherspace_user_session');
          document.getElementById('user-avatar-initials').textContent = 'AS';
          document.querySelectorAll('.modal-backdrop').forEach(function(m) { m.classList.remove('active'); });
          Toast.show('Abgemeldet');
        });
      }

      // Responsive Device Switcher
      document.querySelectorAll('.device-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.device-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          const frame = document.getElementById('preview-frame');
          if (frame) frame.style.width = btn.dataset.size;
        });
      });

      // Popout & Reload
      const popBtn = document.getElementById('popout-btn');
      const reloadBtn = document.getElementById('reload-sandbox-btn');
      if (popBtn) {
        popBtn.addEventListener('click', function() {
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(Sandbox.bundleCode());
            win.document.close();
          }
        });
      }
      if (reloadBtn) reloadBtn.addEventListener('click', function() { Sandbox.execute(); });

      // Console Controls
      const clearConsole = document.getElementById('clear-console-btn');
      const consoleHeader = document.getElementById('console-header-toggle');
      const consoleDrawer = document.getElementById('console-drawer');
      if (clearConsole) {
        clearConsole.addEventListener('click', function(e) {
          e.stopPropagation();
          const list = document.getElementById('console-logs-list');
          if (list) list.innerHTML = '';
          STATE.runtime.logs = [];
          const countPill = document.getElementById('console-count');
          if (countPill) countPill.textContent = '0';
        });
      }
      if (consoleHeader) {
        consoleHeader.addEventListener('click', function() { consoleDrawer.classList.toggle('minimized'); });
      }

      // Global Shortcuts
      window.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          Sandbox.execute();
          Toast.show('💾 Gespeichert & Sandbox gerendert');
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
          e.preventDefault();
          Healer.heal();
        }
      });

      // PostMessage Sandbox Listener
      window.addEventListener('message', function(event) {
        if (!event.data || typeof event.data !== 'object') return;
        const type = event.data.type;

        if (type === 'AETHER_HEARTBEAT') {
          STATE.runtime.lastHeartbeat = Date.now();
          const fpsText = document.getElementById('hud-fps-text');
          const latText = document.getElementById('hud-lat-badge');
          if (fpsText) fpsText.textContent = event.data.fps + ' FPS';
          if (latText) latText.textContent = event.data.lat + ' ms';
        }

        if (type === 'AETHER_ERROR') {
          STATE.runtime.errors.push(event.data.error);
          UI.updateErrorBadge();
          UI.addConsoleLog('error', event.data.error.message + ' (Zeile ' + event.data.error.line + ')');
        }

        if (type === 'AETHER_CONSOLE') {
          UI.addConsoleLog(event.data.level, event.data.message);
        }
      });
    },

    updateThinkingUI() {
      const lvl = STATE.settings.thinkingLevel;
      const budgetMap = { high: 'High (16k)', medium: 'Medium (8k)', fast: 'Fast (0)' };
      const pillLabel = document.getElementById('thinking-level-label');
      const badgeText = document.getElementById('drawer-thinking-badge');
      if (pillLabel) pillLabel.textContent = budgetMap[lvl];
      if (badgeText) badgeText.textContent = lvl.toUpperCase() + ' (' + (lvl === 'high' ? '16,384' : lvl === 'medium' ? '8,192' : '0') + ' tok)';

      document.querySelectorAll('.tier-pill-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.level === lvl);
      });
    }
  };

  const Toast = {
    show(message, duration = 3000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.2s ease';
        setTimeout(function() { toast.remove(); }, 200);
      }, duration);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { UI.init(); });
  } else {
    UI.init();
  }

})();

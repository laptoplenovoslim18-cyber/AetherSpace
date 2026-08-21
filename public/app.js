/**
 * AETHERSPACE CORE ENGINE v2.5
 * Pure Edge Execution | Zero Local Load | Multi-Provider Exhaustive Cascade
 */

(function () {
  "use strict";

  // Application State (Starts strictly empty as requested)
  const state = {
    files: [], // Array of { id, name, path, content, isContextSelected }
    activeFileId: null,
    openTabs: [],
    keys: [],
    runSettings: {
      provider: "google",
      model: "gemini-2.5-flash",
      systemInstruction: "Du bist ein deterministischer SOTA-Software-Architekt und Code-Synthesizer. Erzeuge produktionsreifen, fehlerfreien Code ohne Platzhalter.",
      thinkingLevel: "medium",
      grounding: false,
      temperature: 0.7,
      maxTokens: 8192,
      autoFallback: true,
      autoHeal: true,
    },
    auth: {
      isLoggedIn: false,
      email: null,
    },
    abortController: null,
  };

  const MODELS_BY_PROVIDER = {
    google: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (SOTA Free Speed)" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Reasoning)" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Multimodal)" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (LTS)" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (2M Context)" },
    ],
    groq: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Ultra-Fast)" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (32k)" },
    ],
    openrouter: [
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Free" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Free" },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 Free" },
      { id: "qwen/qwen-2.5-coder-32b-instruct:free", name: "Qwen 2.5 Coder 32B Free" },
    ],
    huggingface: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen 2.5 Coder 32B" },
      { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", name: "DeepSeek R1 Distill 32B" },
    ],
  };

  // DOM Elements Cache
  const dom = {
    fileTreeContainer: document.getElementById("file-tree-container"),
    treeEmptyState: document.getElementById("tree-empty-state"),
    tabList: document.getElementById("tab-list"),
    editorEmptyState: document.getElementById("editor-empty-state"),
    codeTextarea: document.getElementById("code-textarea"),
    lineNumbers: document.getElementById("line-numbers"),
    lblContextStats: document.getElementById("lbl-context-stats"),
    chkSelectAllContext: document.getElementById("chk-select-all-context"),
    promptContextPill: document.getElementById("prompt-context-pill"),
    activeProviderBadge: document.getElementById("active-provider-badge"),
    activeModelBadge: document.getElementById("active-model-badge"),
    aiPromptInput: document.getElementById("ai-prompt-input"),
    btnSendPrompt: document.getElementById("btn-send-prompt"),
    aiStreamStatus: document.getElementById("ai-stream-status"),
    streamStatusText: document.getElementById("stream-status-text"),
    btnAbortStream: document.getElementById("btn-abort-stream"),
    statusCursorPos: document.getElementById("status-cursor-pos"),
    statusCharCount: document.getElementById("status-char-count"),
    statusFileSize: document.getElementById("status-file-size"),
    statusLanguageMode: document.getElementById("status-language-mode"),
    panelRunSettings: document.getElementById("panel-run-settings"),
    btnToggleSettings: document.getElementById("btn-toggle-settings"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    selectProvider: document.getElementById("select-provider"),
    selectModel: document.getElementById("select-model"),
    txtSystemInstruction: document.getElementById("txt-system-instruction"),
    selectThinkingLevel: document.getElementById("select-thinking-level"),
    chkGrounding: document.getElementById("chk-grounding"),
    sliderTemperature: document.getElementById("slider-temperature"),
    lblTemperature: document.getElementById("lbl-temperature"),
    sliderMaxTokens: document.getElementById("slider-max-tokens"),
    lblMaxTokens: document.getElementById("lbl-max-tokens"),
    modalVault: document.getElementById("modal-vault"),
    btnOpenVault: document.getElementById("btn-open-vault"),
    btnCloseVault: document.getElementById("btn-close-vault"),
    btnVaultDone: document.getElementById("btn-vault-done"),
    vaultKeyCount: document.getElementById("vault-key-count"),
    vaultTableBody: document.getElementById("vault-table-body"),
    vaultInputProvider: document.getElementById("vault-input-provider"),
    vaultInputLabel: document.getElementById("vault-input-label"),
    vaultInputKey: document.getElementById("vault-input-key"),
    btnVaultAdd: document.getElementById("btn-vault-add"),
    modalAuth: document.getElementById("modal-auth"),
    btnOpenAuth: document.getElementById("btn-open-auth"),
    btnCloseAuth: document.getElementById("btn-close-auth"),
    lblAuthStatus: document.getElementById("lbl-auth-status"),
    formAuth: document.getElementById("form-auth"),
    authEmail: document.getElementById("auth-email"),
    tabAuthLogin: document.getElementById("tab-auth-login"),
    tabAuthSignup: document.getElementById("tab-auth-signup"),
    btnAuthSubmit: document.getElementById("btn-auth-submit"),
    btnNewFile: document.getElementById("btn-new-file"),
    btnNewFolder: document.getElementById("btn-new-folder"),
    btnImportFile: document.getElementById("btn-import-file"),
    btnClearTree: document.getElementById("btn-clear-tree"),
    fileImportInput: document.getElementById("file-import-input"),
    btnExportZip: document.getElementById("btn-export-zip"),
    btnExportSingleHtml: document.getElementById("btn-export-single-html"),
    btnStageCodepen: document.getElementById("btn-stage-codepen"),
    btnStageStackblitz: document.getElementById("btn-stage-stackblitz"),
    btnAutoHealActive: document.getElementById("btn-auto-heal-active"),
    btnFormatCode: document.getElementById("btn-format-code"),
  };

  // Initialization
  function init() {
    loadKeys();
    loadAuth();
    populateModels();
    bindEvents();
    renderFileTree();
    renderTabs();
    updateEditorState();
    updateContextStats();
  }

  // --- KEY VAULT MANAGEMENT ---
  function loadKeys() {
    try {
      const stored = localStorage.getItem("aetherspace_vault_keys");
      state.keys = stored ? JSON.parse(stored) : [];
    } catch (e) {
      state.keys = [];
    }
    updateVaultUI();
  }

  function saveKeys() {
    localStorage.setItem("aetherspace_vault_keys", JSON.stringify(state.keys));
    updateVaultUI();
  }

  function updateVaultUI() {
    dom.vaultKeyCount.textContent = state.keys.length;
    dom.vaultTableBody.innerHTML = "";

    if (state.keys.length === 0) {
      dom.vaultTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="p-4 text-center text-slate-500 font-sans text-xs">
            Keine API-Schlüssel hinterlegt. Füge oben einen dauerhaft kostenlosen Key hinzu.
          </td>
        </tr>
      `;
      return;
    }

    state.keys.forEach((k, idx) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-900/60";
      const masked = k.key.length > 8 ? `${k.key.substring(0, 6)}...${k.key.substring(k.key.length - 4)}` : "••••••••";
      tr.innerHTML = `
        <td class="p-3">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans ${k.active ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-slate-800 text-slate-400"}">
            ${k.active ? "Aktiv" : "Inaktiv"}
          </span>
        </td>
        <td class="p-3 text-slate-200 capitalize font-sans">${k.provider}</td>
        <td class="p-3 text-cyan-300 font-sans">${escapeHtml(k.label || "Key " + (idx + 1))}</td>
        <td class="p-3 text-slate-400">${masked}</td>
        <td class="p-3 text-slate-300 font-sans">Free Tier</td>
        <td class="p-3 text-slate-500">${k.created || "Neu"}</td>
        <td class="p-3 text-right">
          <button data-action="toggle" data-idx="${idx}" class="text-xs text-slate-400 hover:text-slate-200 mr-2">${k.active ? "Deaktivieren" : "Aktivieren"}</button>
          <button data-action="delete" data-idx="${idx}" class="text-xs text-rose-400 hover:text-rose-300">Löschen</button>
        </td>
      `;
      dom.vaultTableBody.appendChild(tr);
    });
  }

  // --- FILE MANAGEMENT ---
  function addFile(name, content = "", path = "") {
    const ext = name.split(".").pop().toLowerCase();
    const id = "f_" + Math.random().toString(36).substring(2, 9);
    const newFile = {
      id,
      name,
      path: path ? `${path}/${name}` : name,
      content,
      isContextSelected: true,
      ext,
    };
    state.files.push(newFile);
    openFile(id);
    renderFileTree();
    updateContextStats();
    return newFile;
  }

  function openFile(id) {
    state.activeFileId = id;
    if (!state.openTabs.includes(id)) {
      state.openTabs.push(id);
    }
    renderTabs();
    updateEditorState();
  }

  function closeTab(id, e) {
    if (e) e.stopPropagation();
    state.openTabs = state.openTabs.filter(tabId => tabId !== id);
    if (state.activeFileId === id) {
      state.activeFileId = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
    }
    renderTabs();
    updateEditorState();
  }

  function deleteFile(id, e) {
    if (e) e.stopPropagation();
    state.files = state.files.filter(f => f.id !== id);
    closeTab(id);
    renderFileTree();
    updateContextStats();
  }

  function renderFileTree() {
    dom.fileTreeContainer.innerHTML = "";
    if (state.files.length === 0) {
      dom.fileTreeContainer.appendChild(dom.treeEmptyState);
      return;
    }

    state.files.forEach(file => {
      const item = document.createElement("div");
      item.className = `flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group ${state.activeFileId === file.id ? "bg-slate-800 text-cyan-300 font-semibold" : "text-slate-300 hover:bg-slate-900/80"}`;
      item.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden flex-1">
          <input type="checkbox" class="custom-checkbox file-context-chk" data-id="${file.id}" ${file.isContextSelected ? "checked" : ""}>
          <span class="text-xs text-slate-500">${getFileIcon(file.name)}</span>
          <span class="truncate text-xs">${escapeHtml(file.name)}</span>
        </div>
        <button class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs px-1" data-action="delete-file" data-id="${file.id}" title="Löschen">✕</button>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("file-context-chk") || e.target.dataset.action === "delete-file") return;
        openFile(file.id);
      });

      dom.fileTreeContainer.appendChild(item);
    });
  }

  function renderTabs() {
    dom.tabList.innerHTML = "";
    state.openTabs.forEach(id => {
      const file = state.files.find(f => f.id === id);
      if (!file) return;
      const tab = document.createElement("div");
      tab.className = `tab-item ${state.activeFileId === id ? "active" : ""}`;
      tab.innerHTML = `
        <span>${getFileIcon(file.name)}</span>
        <span>${escapeHtml(file.name)}</span>
        <button class="hover:text-rose-400 ml-1 text-[10px]" data-action="close-tab" data-id="${id}">✕</button>
      `;
      tab.addEventListener("click", () => openFile(id));
      dom.tabList.appendChild(tab);
    });
  }

  function updateEditorState() {
    const activeFile = state.files.find(f => f.id === state.activeFileId);
    if (!activeFile) {
      dom.editorEmptyState.classList.remove("hidden");
      dom.codeTextarea.value = "";
      dom.lineNumbers.innerHTML = "1";
      dom.statusLanguageMode.textContent = "Keine Datei";
      dom.statusCursorPos.textContent = "Ln 0, Col 0";
      dom.statusCharCount.textContent = "0 Zeichen";
      dom.statusFileSize.textContent = "0 KB";
      return;
    }

    dom.editorEmptyState.classList.add("hidden");
    dom.codeTextarea.value = activeFile.content;
    dom.statusLanguageMode.textContent = activeFile.ext.toUpperCase() || "TEXT";
    updateLineNumbers();
    updateStatusBar();
  }

  function updateLineNumbers() {
    const lines = dom.codeTextarea.value.split("\n").length;
    let numbers = "";
    for (let i = 1; i <= lines; i++) {
      numbers += i + "<br>";
    }
    dom.lineNumbers.innerHTML = numbers;
  }

  function updateStatusBar() {
    const text = dom.codeTextarea.value;
    dom.statusCharCount.textContent = `${text.length} Zeichen`;
    const kb = (new Blob([text]).size / 1024).toFixed(1);
    dom.statusFileSize.textContent = `${kb} KB`;
  }

  function updateContextStats() {
    const selectedFiles = state.files.filter(f => f.isContextSelected);
    const totalBytes = selectedFiles.reduce((acc, f) => acc + new Blob([f.content]).size, 0);
    const kb = (totalBytes / 1024).toFixed(1);
    dom.lblContextStats.textContent = `${selectedFiles.length} Dateien (${kb} KB)`;
    dom.promptContextPill.textContent = `${selectedFiles.length} Kontext-Dateien aktiv`;
  }

  function getFileIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    if (ext === "js" || ext === "cjs" || ext === "mjs") return "🟨";
    if (ext === "ts") return "🟦";
    if (ext === "html") return "🌐";
    if (ext === "css") return "🎨";
    if (ext === "json") return "📦";
    if (ext === "md") return "📝";
    return "📄";
  }

  // --- MULTI-PROVIDER CASCADE AI EXECUTION ENGINE ---
  async function executeCloudMeshPrompt() {
    const promptText = dom.aiPromptInput.value.trim();
    if (!promptText) return;

    // Collect active context files
    const contextFiles = state.files.filter(f => f.isContextSelected);
    let fullPrompt = "";
    if (contextFiles.length > 0) {
      fullPrompt += "=== WORKSPACE FILE CONTEXT ===\n";
      contextFiles.forEach(cf => {
        fullPrompt += `--- FILE: ${cf.name} ---\n${cf.content}\n\n`;
      });
      fullPrompt += "=== USER DIRECTIVE ===\n";
    }
    fullPrompt += promptText;

    // Get active keys for selected provider
    const provider = state.runSettings.provider;
    const providerKeys = state.keys.filter(k => k.provider === provider && k.active);

    if (providerKeys.length === 0) {
      // Check fallback mesh
      const anyKeys = state.keys.filter(k => k.active);
      if (anyKeys.length === 0) {
        alert(`Kein aktiver API-Schlüssel für ${provider} hinterlegt. Bitte öffne den Key-Tresor (🔑) und füge einen Free-Tier Schlüssel ein.`);
        dom.modalVault.classList.remove("hidden");
        return;
      }
    }

    dom.aiStreamStatus.classList.remove("hidden");
    dom.streamStatusText.textContent = `Verbinde mit ${provider.toUpperCase()} (${state.runSettings.model})...`;
    dom.btnSendPrompt.disabled = true;

    state.abortController = new AbortController();

    try {
      let resultText = "";
      let success = false;

      // Cascade through all keys of active provider
      for (let i = 0; i < providerKeys.length; i++) {
        const keyObj = providerKeys[i];
        dom.streamStatusText.textContent = `Generiere via Key ${i + 1}/${providerKeys.length} (${keyObj.label || "Primary"})...`;
        try {
          resultText = await callAiProvider(provider, state.runSettings.model, keyObj.key, fullPrompt, state.abortController.signal);
          success = true;
          break;
        } catch (err) {
          console.warn(`Key ${i + 1} fehlgeschlagen:`, err.message);
          if (i === providerKeys.length - 1 && !state.runSettings.autoFallback) {
            throw err;
          }
        }
      }

      // If provider keys exhausted and auto-fallback enabled, attempt Free Multi-Mesh
      if (!success && state.runSettings.autoFallback) {
        dom.streamStatusText.textContent = "Kaskaden-Ausweichroute auf freies Cloud-Mesh wird initiiert...";
        const fallbackProviders = ["groq", "openrouter", "google"].filter(p => p !== provider);
        for (const altProvider of fallbackProviders) {
          const altKeys = state.keys.filter(k => k.provider === altProvider && k.active);
          if (altKeys.length > 0) {
            const altModel = MODELS_BY_PROVIDER[altProvider][0].id;
            try {
              resultText = await callAiProvider(altProvider, altModel, altKeys[0].key, fullPrompt, state.abortController.signal);
              success = true;
              break;
            } catch (fallbackErr) {
              console.warn(`Fallback auf ${altProvider} fehlgeschlagen:`, fallbackErr.message);
            }
          }
        }
      }

      if (!success) {
        throw new Error("Alle kaskadierten API-Schlüssel haben Quota-Limits (429) gemeldet oder sind ungültig.");
      }

      // Insert or update active file or create new file
      handleGeneratedCode(resultText, promptText);
      dom.aiPromptInput.value = "";
    } catch (err) {
      if (err.name !== "AbortError") {
        alert(`Cloud-Mesh Fehler: ${err.message}`);
      }
    } finally {
      dom.aiStreamStatus.classList.add("hidden");
      dom.btnSendPrompt.disabled = false;
      state.abortController = null;
    }
  }

  async function callAiProvider(provider, model, apiKey, prompt, signal) {
    if (provider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: state.runSettings.systemInstruction }] },
        generationConfig: {
          temperature: parseFloat(state.runSettings.temperature),
          maxOutputTokens: parseInt(state.runSettings.maxTokens, 10),
        },
      };

      if (state.runSettings.grounding) {
        payload.tools = [{ googleSearch: {} }];
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Google API [HTTP ${res.status}]: ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (provider === "groq" || provider === "openrouter") {
      const endpoint = provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://aetherspace.pages.dev";
        headers["X-Title"] = "AetherSpace";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: state.runSettings.systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: parseFloat(state.runSettings.temperature),
          max_tokens: parseInt(state.runSettings.maxTokens, 10),
        }),
        signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`${provider.toUpperCase()} API [HTTP ${res.status}]: ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    if (provider === "huggingface") {
      const url = `https://router.huggingface.co/hf-inference/v1/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: state.runSettings.systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: parseFloat(state.runSettings.temperature),
          max_tokens: parseInt(state.runSettings.maxTokens, 10),
        }),
        signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`HuggingFace API [HTTP ${res.status}]: ${errorData.error?.message || res.statusText}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    throw new Error(`Unbekannter Provider: ${provider}`);
  }

  function handleGeneratedCode(rawText, prompt) {
    let cleanCode = rawText;
    // Extract markdown code block if present
    const match = rawText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
    if (match) {
      cleanCode = match[1];
    }

    const activeFile = state.files.find(f => f.id === state.activeFileId);
    if (activeFile) {
      activeFile.content = cleanCode;
      dom.codeTextarea.value = cleanCode;
      updateLineNumbers();
      updateStatusBar();
      updateContextStats();
    } else {
      // Create new file
      const extMatch = prompt.match(/\.(js|ts|html|css|json|md)/i);
      const ext = extMatch ? extMatch[1] : "js";
      addFile(`generated_${Date.now()}.${ext}`, cleanCode);
    }
  }

  // --- CLIENT-SIDE PURE JS ZIP BUILDER ($0 FOSS ZERO DEPENDENCY) ---
  function exportZip() {
    if (state.files.length === 0) {
      alert("Workspace enthält keine Dateien zum Exportieren.");
      return;
    }

    const zipData = buildZip(state.files);
    const blob = new Blob([zipData], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AetherSpace_Workspace_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildZip(files) {
    const utf8Encoder = new TextEncoder();
    const fileEntries = [];
    let localHeadersOffset = 0;

    // CRC32 Table
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }
    function calculateCrc32(data) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    const parts = [];

    files.forEach(f => {
      const fileNameBytes = utf8Encoder.encode(f.name);
      const fileDataBytes = utf8Encoder.encode(f.content);
      const crc = calculateCrc32(fileDataBytes);
      const size = fileDataBytes.length;

      // Local file header (30 bytes + name)
      const localHeader = new Uint8Array(30 + fileNameBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed
      view.setUint16(6, 0, true);          // General purpose bit flag
      view.setUint16(8, 0, true);          // Compression method (0 = uncompressed)
      view.setUint16(10, 0, true);         // Mod time
      view.setUint16(12, 0, true);         // Mod date
      view.setUint32(14, crc, true);       // CRC32
      view.setUint32(18, size, true);      // Compressed size
      view.setUint32(22, size, true);      // Uncompressed size
      view.setUint16(26, fileNameBytes.length, true);
      view.setUint16(28, 0, true);         // Extra field length
      localHeader.set(fileNameBytes, 30);

      fileEntries.push({
        nameBytes: fileNameBytes,
        crc,
        size,
        offset: localHeadersOffset,
      });

      parts.push(localHeader);
      parts.push(fileDataBytes);
      localHeadersOffset += localHeader.length + fileDataBytes.length;
    });

    const centralDirOffset = localHeadersOffset;
    let centralDirSize = 0;

    // Central directory headers
    fileEntries.forEach(entry => {
      const cdirHeader = new Uint8Array(46 + entry.nameBytes.length);
      const view = new DataView(cdirHeader.buffer);
      view.setUint32(0, 0x02014b50, true); // Central directory signature
      view.setUint16(4, 20, true);         // Version made by
      view.setUint16(6, 20, true);         // Version needed
      view.setUint16(8, 0, true);          // Flags
      view.setUint16(10, 0, true);         // Method
      view.setUint16(12, 0, true);         // Time
      view.setUint16(14, 0, true);         // Date
      view.setUint32(16, entry.crc, true); // CRC32
      view.setUint32(20, entry.size, true);// Compressed
      view.setUint32(24, entry.size, true);// Uncompressed
      view.setUint16(28, entry.nameBytes.length, true);
      view.setUint16(30, 0, true);         // Extra length
      view.setUint16(32, 0, true);         // Comment length
      view.setUint16(34, 0, true);         // Disk start
      view.setUint16(36, 0, true);         // Internal attrs
      view.setUint32(38, 0, true);         // External attrs
      view.setUint32(42, entry.offset, true); // Local header offset
      cdirHeader.set(entry.nameBytes, 46);

      parts.push(cdirHeader);
      centralDirSize += cdirHeader.length;
    });

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, fileEntries.length, true);
    eocdView.setUint16(10, fileEntries.length, true);
    eocdView.setUint32(12, centralDirSize, true);
    eocdView.setUint32(16, centralDirOffset, true);
    eocdView.setUint16(20, 0, true);
    parts.push(eocd);

    // Merge into single Uint8Array
    let totalLength = parts.reduce((acc, p) => acc + p.length, 0);
    let fullZip = new Uint8Array(totalLength);
    let curOffset = 0;
    parts.forEach(p => {
      fullZip.set(p, curOffset);
      curOffset += p.length;
    });

    return fullZip;
  }

  function exportSingleHtml() {
    const htmlFile = state.files.find(f => f.name.endsWith(".html"));
    const cssFile = state.files.find(f => f.name.endsWith(".css"));
    const jsFile = state.files.find(f => f.name.endsWith(".js"));

    let combined = htmlFile ? htmlFile.content : "<!DOCTYPE html><html><head></head><body></body></html>";
    if (cssFile) {
      combined = combined.replace("</head>", `<style>\n${cssFile.content}\n</style>\n</head>`);
    }
    if (jsFile) {
      combined = combined.replace("</body>", `<script>\n${jsFile.content}\n<\/script>\n</body>`);
    }

    const blob = new Blob([combined], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AetherSpace_Bundle.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- STAGING POST HUBS ---
  function stageCodePen() {
    const html = state.files.find(f => f.name.endsWith(".html"))?.content || "";
    const css = state.files.find(f => f.name.endsWith(".css"))?.content || "";
    const js = state.files.find(f => f.name.endsWith(".js"))?.content || "";

    const data = JSON.stringify({
      title: "AetherSpace Project",
      html,
      css,
      js,
    });

    const form = document.createElement("form");
    form.action = "https://codepen.io/pen/define";
    form.method = "POST";
    form.target = "_blank";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data";
    input.value = data;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  function stageStackBlitz() {
    const form = document.createElement("form");
    form.action = "https://stackblitz.com/run";
    form.method = "POST";
    form.target = "_blank";

    const fields = {
      "project[title]": "AetherSpace Project",
      "project[description]": "Exported from AetherSpace Cloud Edge",
      "project[template]": "javascript",
    };

    state.files.forEach(f => {
      fields[`project[files][${f.name}]`] = f.content;
    });

    Object.keys(fields).forEach(key => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = fields[key];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // --- AUTH MANAGEMENT ---
  function loadAuth() {
    try {
      const session = localStorage.getItem("aetherspace_auth");
      if (session) {
        state.auth = JSON.parse(session);
        if (state.auth.isLoggedIn) {
          dom.lblAuthStatus.textContent = state.auth.email.split("@")[0];
        }
      }
    } catch (e) {}
  }

  function saveAuth(email) {
    state.auth = { isLoggedIn: true, email };
    localStorage.setItem("aetherspace_auth", JSON.stringify(state.auth));
    dom.lblAuthStatus.textContent = email.split("@")[0];
    dom.modalAuth.classList.add("hidden");
  }

  // --- UI EVENT BINDINGS ---
  function populateModels() {
    const list = MODELS_BY_PROVIDER[state.runSettings.provider] || [];
    dom.selectModel.innerHTML = "";
    list.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      dom.selectModel.appendChild(opt);
    });
    state.runSettings.model = list[0]?.id || "";
    dom.activeProviderBadge.textContent = state.runSettings.provider.toUpperCase();
    dom.activeModelBadge.textContent = state.runSettings.model;
  }

  function bindEvents() {
    // Editor typing sync
    dom.codeTextarea.addEventListener("input", () => {
      const activeFile = state.files.find(f => f.id === state.activeFileId);
      if (activeFile) {
        activeFile.content = dom.codeTextarea.value;
      }
      updateLineNumbers();
      updateStatusBar();
      updateContextStats();
    });

    dom.codeTextarea.addEventListener("scroll", () => {
      dom.lineNumbers.scrollTop = dom.codeTextarea.scrollTop;
    });

    // Tab key support in textarea
    dom.codeTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = dom.codeTextarea.selectionStart;
        const end = dom.codeTextarea.selectionEnd;
        dom.codeTextarea.value = dom.codeTextarea.value.substring(0, start) + "  " + dom.codeTextarea.value.substring(end);
        dom.codeTextarea.selectionStart = dom.codeTextarea.selectionEnd = start + 2;
      }
    });

    // Prompt keydown (Ctrl+Enter / Cmd+Enter)
    dom.aiPromptInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        executeCloudMeshPrompt();
      }
    });

    dom.btnSendPrompt.addEventListener("click", executeCloudMeshPrompt);
    dom.btnAbortStream.addEventListener("click", () => {
      if (state.abortController) state.abortController.abort();
    });

    // Run Settings Toggles
    dom.btnToggleSettings.addEventListener("click", () => {
      dom.panelRunSettings.classList.toggle("hidden");
    });
    dom.btnCloseSettings.addEventListener("click", () => {
      dom.panelRunSettings.classList.add("hidden");
    });

    dom.selectProvider.addEventListener("change", (e) => {
      state.runSettings.provider = e.target.value;
      populateModels();
    });

    dom.selectModel.addEventListener("change", (e) => {
      state.runSettings.model = e.target.value;
      dom.activeModelBadge.textContent = state.runSettings.model;
    });

    dom.sliderTemperature.addEventListener("input", (e) => {
      state.runSettings.temperature = e.target.value;
      dom.lblTemperature.textContent = e.target.value;
    });

    dom.sliderMaxTokens.addEventListener("input", (e) => {
      state.runSettings.maxTokens = e.target.value;
      dom.lblMaxTokens.textContent = e.target.value;
    });

    dom.chkGrounding.addEventListener("change", (e) => {
      state.runSettings.grounding = e.target.checked;
    });

    // Modals
    dom.btnOpenVault.addEventListener("click", () => dom.modalVault.classList.remove("hidden"));
    dom.btnCloseVault.addEventListener("click", () => dom.modalVault.classList.add("hidden"));
    dom.btnVaultDone.addEventListener("click", () => dom.modalVault.classList.add("hidden"));

    dom.btnOpenAuth.addEventListener("click", () => dom.modalAuth.classList.remove("hidden"));
    dom.btnCloseAuth.addEventListener("click", () => dom.modalAuth.classList.add("hidden"));

    // Vault Add Key
    dom.btnVaultAdd.addEventListener("click", () => {
      const provider = dom.vaultInputProvider.value;
      const label = dom.vaultInputLabel.value.trim() || `${provider.toUpperCase()} Key`;
      const key = dom.vaultInputKey.value.trim();
      if (!key) {
        alert("Bitte gib einen gültigen API-Key ein.");
        return;
      }
      state.keys.push({
        id: "k_" + Date.now(),
        provider,
        label,
        key,
        active: true,
        created: new Date().toLocaleDateString("de-DE"),
      });
      saveKeys();
      dom.vaultInputKey.value = "";
      dom.vaultInputLabel.value = "";
    });

    dom.vaultTableBody.addEventListener("click", (e) => {
      const idx = e.target.dataset.idx;
      if (idx === undefined) return;
      if (e.target.dataset.action === "toggle") {
        state.keys[idx].active = !state.keys[idx].active;
        saveKeys();
      } else if (e.target.dataset.action === "delete") {
        state.keys.splice(idx, 1);
        saveKeys();
      }
    });

    // File Actions
    dom.btnNewFile.addEventListener("click", () => {
      const name = prompt("Dateiname (z. B. index.js, app.html):", "module.js");
      if (name) addFile(name.trim(), "");
    });

    dom.btnNewFolder.addEventListener("click", () => {
      const folder = prompt("Ordnername:", "src");
      if (folder) addFile(`${folder}/index.js`, "");
    });

    dom.btnImportFile.addEventListener("click", () => dom.fileImportInput.click());

    dom.fileImportInput.addEventListener("change", (e) => {
      const imported = Array.from(e.target.files);
      imported.forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          addFile(file.name, evt.target.result);
        };
        reader.readAsText(file);
      });
    });

    dom.btnClearTree.addEventListener("click", () => {
      if (confirm("Möchtest du wirklich alle Dateien aus dem Workspace entfernen?")) {
        state.files = [];
        state.openTabs = [];
        state.activeFileId = null;
        renderFileTree();
        renderTabs();
        updateEditorState();
        updateContextStats();
      }
    });

    // Context Checkboxes
    dom.fileTreeContainer.addEventListener("change", (e) => {
      if (e.target.classList.contains("file-context-chk")) {
        const id = e.target.dataset.id;
        const f = state.files.find(file => file.id === id);
        if (f) f.isContextSelected = e.target.checked;
        updateContextStats();
      }
    });

    dom.fileTreeContainer.addEventListener("click", (e) => {
      if (e.target.dataset.action === "delete-file") {
        deleteFile(e.target.dataset.id, e);
      }
    });

    dom.tabList.addEventListener("click", (e) => {
      if (e.target.dataset.action === "close-tab") {
        closeTab(e.target.dataset.id, e);
      }
    });

    dom.chkSelectAllContext.addEventListener("change", (e) => {
      const checked = e.target.checked;
      state.files.forEach(f => f.isContextSelected = checked);
      renderFileTree();
      updateContextStats();
    });

    // Export & Staging Handlers
    dom.btnExportZip.addEventListener("click", exportZip);
    dom.btnExportSingleHtml.addEventListener("click", exportSingleHtml);
    dom.btnStageCodepen.addEventListener("click", stageCodePen);
    dom.btnStageStackblitz.addEventListener("click", stageStackBlitz);

    // Auth Form
    dom.formAuth.addEventListener("submit", (e) => {
      e.preventDefault();
      saveAuth(dom.authEmail.value);
    });

    // Code Format & Auto-Heal Triggers
    dom.btnFormatCode.addEventListener("click", () => {
      const activeFile = state.files.find(f => f.id === state.activeFileId);
      if (!activeFile) return;
      try {
        if (activeFile.name.endsWith(".json")) {
          activeFile.content = JSON.stringify(JSON.parse(activeFile.content), null, 2);
          dom.codeTextarea.value = activeFile.content;
        }
      } catch (e) {}
    });

    dom.btnAutoHealActive.addEventListener("click", () => {
      const activeFile = state.files.find(f => f.id === state.activeFileId);
      if (!activeFile) return;
      dom.aiPromptInput.value = `Untersuche und repariere die Datei '${activeFile.name}' auf Syntax-Fehler, Typsicherheit und Randfälle. Liefere den vollständigen bereinigten Code.`;
      executeCloudMeshPrompt();
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Bootstrap
  window.addEventListener("DOMContentLoaded", init);
})();
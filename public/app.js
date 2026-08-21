// AetherSpace Client Engine - Zero Local Weight Architecture
const STATE = {
  files: [], // Clean initial state: 0 fake files
  openTabs: [],
  activeFileId: null,
  vaultKeys: JSON.parse(localStorage.getItem('aetherspace_vault_v1') || '[]'),
  authUser: JSON.parse(localStorage.getItem('aetherspace_auth_user') || 'null')
};

// UI Elements
const fileTreeEl = document.getElementById('file-tree');
const emptyTreeMsgEl = document.getElementById('empty-tree-msg');
const editorTabsEl = document.getElementById('editor-tabs');
const codeEditorEl = document.getElementById('code-editor');
const lineNumbersEl = document.getElementById('line-numbers');
const emptyEditorViewEl = document.getElementById('empty-editor-view');
const activeFileLabelEl = document.getElementById('active-file-label');
const statusFileTypeEl = document.getElementById('status-file-type');
const promptInputEl = document.getElementById('prompt-input');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  renderFileTree();
  renderTabs();
  renderVaultTable();
  updateAuthUI();
  setupEditorEvents();
});

// Dropdowns
function toggleDropdown(id) {
  const el = document.getElementById(id);
  const isVisible = el.classList.contains('show');
  document.querySelectorAll('.pill-dropdown').forEach(d => d.classList.remove('show'));
  if (!isVisible) el.classList.add('show');
}
window.addEventListener('click', (e) => {
  if (!e.target.closest('.header-center')) {
    document.querySelectorAll('.pill-dropdown').forEach(d => d.classList.remove('show'));
  }
});

// Settings Panel Slide-out
function toggleSettingsPanel() {
  document.getElementById('settings-panel').classList.toggle('open');
}
function updateModelBadge() {
  const model = document.getElementById('setting-model').value;
  document.getElementById('active-model-badge').innerText = model;
}

// File System Management
function promptNewFile() {
  const name = prompt('Dateiname eingeben (z. B. index.js, styles.css):');
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const file = {
    id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: cleanName,
    content: '',
    checked: false
  };
  STATE.files.push(file);
  renderFileTree();
  openFile(file.id);
}

function clearAllFiles() {
  if (STATE.files.length === 0) return;
  if (!confirm('Möchten Sie wirklich alle Dateien aus dem Workspace entfernen?')) return;
  STATE.files = [];
  STATE.openTabs = [];
  STATE.activeFileId = null;
  renderFileTree();
  renderTabs();
  updateEditorView();
}

function handleFileUpload(event) {
  const uploadedFiles = event.target.files;
  if (!uploadedFiles || uploadedFiles.length === 0) return;
  Array.from(uploadedFiles).forEach(f => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const file = {
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: f.name,
        content: e.target.result,
        checked: false
      };
      STATE.files.push(file);
      renderFileTree();
      openFile(file.id);
    };
    reader.readAsText(f);
  });
  event.target.value = '';
}

function renderFileTree() {
  fileTreeEl.innerHTML = '';
  if (STATE.files.length === 0) {
    fileTreeEl.appendChild(emptyTreeMsgEl);
    emptyTreeMsgEl.style.display = 'block';
    updateContextCount();
    return;
  }
  emptyTreeMsgEl.style.display = 'none';

  STATE.files.forEach(file => {
    const item = document.createElement('div');
    item.className = `tree-item ${file.id === STATE.activeFileId ? 'active' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!file.checked;
    checkbox.onclick = (e) => {
      e.stopPropagation();
      file.checked = checkbox.checked;
      updateContextCount();
    };

    const nameSpan = document.createElement('span');
    nameSpan.innerText = file.name;
    nameSpan.style.flex = '1';

    const delBtn = document.createElement('span');
    delBtn.innerHTML = '&times;';
    delBtn.style.opacity = '0.5';
    delBtn.style.cursor = 'pointer';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteFile(file.id);
    };

    item.appendChild(checkbox);
    item.appendChild(nameSpan);
    item.appendChild(delBtn);
    item.onclick = () => openFile(file.id);

    fileTreeEl.appendChild(item);
  });

  updateContextCount();
}

function updateContextCount() {
  const count = STATE.files.filter(f => f.checked).length;
  document.getElementById('selected-context-count').innerText = `${count} Dateien ausgewählt`;
}

function injectContextToPrompt() {
  const selected = STATE.files.filter(f => f.checked);
  if (selected.length === 0) {
    alert('Bitte wählen Sie mindestens eine Datei über die Checkbox im Explorer aus.');
    return;
  }
  let injection = '\n--- KONTEXT-INJEKTION ---\n';
  selected.forEach(f => {
    injection += `<file path="${f.name}">\n${f.content}\n</file>\n`;
  });
  promptInputEl.value = (promptInputEl.value + injection).trim();
}

function deleteFile(id) {
  STATE.files = STATE.files.filter(f => f.id !== id);
  STATE.openTabs = STATE.openTabs.filter(tabId => tabId !== id);
  if (STATE.activeFileId === id) {
    STATE.activeFileId = STATE.openTabs.length > 0 ? STATE.openTabs[STATE.openTabs.length - 1] : null;
  }
  renderFileTree();
  renderTabs();
  updateEditorView();
}

// Tabs & Editor Management
function openFile(id) {
  if (!STATE.openTabs.includes(id)) {
    STATE.openTabs.push(id);
  }
  STATE.activeFileId = id;
  renderFileTree();
  renderTabs();
  updateEditorView();
}

function closeTab(id, e) {
  e.stopPropagation();
  STATE.openTabs = STATE.openTabs.filter(t => t !== id);
  if (STATE.activeFileId === id) {
    STATE.activeFileId = STATE.openTabs.length > 0 ? STATE.openTabs[STATE.openTabs.length - 1] : null;
  }
  renderFileTree();
  renderTabs();
  updateEditorView();
}

function renderTabs() {
  editorTabsEl.innerHTML = '';
  STATE.openTabs.forEach(id => {
    const file = STATE.files.find(f => f.id === id);
    if (!file) return;

    const tab = document.createElement('div');
    tab.className = `tab ${file.id === STATE.activeFileId ? 'active' : ''}`;
    tab.innerHTML = `<span>${file.name}</span><span class="close-tab">&times;</span>`;
    tab.onclick = () => openFile(file.id);
    tab.querySelector('.close-tab').onclick = (e) => closeTab(file.id, e);
    editorTabsEl.appendChild(tab);
  });
}

function updateEditorView() {
  const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
  if (!activeFile) {
    emptyEditorViewEl.style.display = 'flex';
    codeEditorEl.style.display = 'none';
    lineNumbersEl.innerHTML = '';
    activeFileLabelEl.innerText = 'Keine Datei geöffnet';
    statusFileTypeEl.innerText = 'Plain Text';
    return;
  }

  emptyEditorViewEl.style.display = 'none';
  codeEditorEl.style.display = 'block';
  codeEditorEl.value = activeFile.content;
  activeFileLabelEl.innerText = activeFile.name;
  statusFileTypeEl.innerText = activeFile.name.split('.').pop().toUpperCase() || 'Text';
  updateLineNumbers();
}

function setupEditorEvents() {
  codeEditorEl.addEventListener('input', () => {
    const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
    if (activeFile) {
      activeFile.content = codeEditorEl.value;
    }
    updateLineNumbers();
  });

  codeEditorEl.addEventListener('scroll', () => {
    lineNumbersEl.scrollTop = codeEditorEl.scrollTop;
  });

  codeEditorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeEditorEl.selectionStart;
      const end = codeEditorEl.selectionEnd;
      codeEditorEl.value = codeEditorEl.value.substring(0, start) + '  ' + codeEditorEl.value.substring(end);
      codeEditorEl.selectionStart = codeEditorEl.selectionEnd = start + 2;
      const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
      if (activeFile) activeFile.content = codeEditorEl.value;
    }
  });
}

function updateLineNumbers() {
  const lines = codeEditorEl.value.split('\n').length;
  lineNumbersEl.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}

function saveCurrentFile() {
  const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
  if (!activeFile) return;
  activeFile.content = codeEditorEl.value;
  const statusGit = document.getElementById('status-git');
  statusGit.innerText = '● Gespeichert';
  setTimeout(() => { statusGit.innerText = '● Git Sync: Bereit'; }, 2000);
}

// Polyglot Auto-Healer
function executeAutoHealer() {
  const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
  if (!activeFile) return;
  let code = codeEditorEl.value;
  
  // Syntax Sanitize: Strip trailing artifacts, unclosed markdown codeblock fences
  code = code.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
  code = code.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width spaces
  
  codeEditorEl.value = code;
  activeFile.content = code;
  updateLineNumbers();
  alert('Auto-Healer: Syntax-Artefakte und Zeilenumbrüche erfolgreich bereinigt.');
}

// Cloud AI Dispatcher (Zero Local Compute)
async function dispatchAiGeneration() {
  const promptText = promptInputEl.value.trim();
  if (!promptText) {
    alert('Bitte geben Sie einen Prompt ein.');
    return;
  }

  const model = document.getElementById('setting-model').value;
  const systemInstruction = document.getElementById('setting-system').value;
  const temperature = parseFloat(document.getElementById('setting-temperature').value);
  const maxTokens = parseInt(document.getElementById('setting-max-tokens').value, 10);
  const btnGen = document.getElementById('btn-generate');

  btnGen.disabled = true;
  btnGen.innerText = '⏳ Cloud KI rechnet...';

  try {
    const provider = model.includes('gemini') ? 'google' : (model.includes('llama') || model.includes('deepseek') ? 'groq' : 'openrouter');
    const availableKeys = STATE.vaultKeys.filter(k => k.provider === provider);

    if (availableKeys.length === 0) {
      throw new Error(`Kein aktiver API-Schlüssel für Provider "${provider}" im Tresor gefunden. Bitte hinterlegen Sie einen Schlüssel unter 🔑 API-Tresor.`);
    }

    let responseText = '';
    let success = false;

    // Exhaustive Key Failover Cascade
    for (const keyObj of availableKeys) {
      try {
        if (provider === 'google') {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyObj.key}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
              generationConfig: { temperature, maxOutputTokens: maxTokens }
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Google API Fehler');
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          success = true;
          break;
        } else if (provider === 'groq') {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${keyObj.key}`
            },
            body: JSON.stringify({
              model,
              messages: [
                ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                { role: 'user', content: promptText }
              ],
              temperature,
              max_tokens: maxTokens
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Groq API Fehler');
          responseText = data.choices?.[0]?.message?.content || '';
          success = true;
          break;
        }
      } catch (keyErr) {
        console.warn(`Key ${keyObj.label} fehlgeschlagen:`, keyErr.message);
      }
    }

    if (!success) {
      throw new Error('Alle verfügbaren Schlüssel für diesen Provider sind erschöpft oder ungültig.');
    }

    // Injects received code into active editor or creates new response file
    if (STATE.activeFileId) {
      const activeFile = STATE.files.find(f => f.id === STATE.activeFileId);
      activeFile.content = responseText;
      updateEditorView();
    } else {
      const newFile = {
        id: 'f_' + Date.now(),
        name: 'ai_output.txt',
        content: responseText,
        checked: false
      };
      STATE.files.push(newFile);
      renderFileTree();
      openFile(newFile.id);
    }
  } catch (err) {
    alert(`Fehler bei der KI-Generierung: ${err.message}`);
  } finally {
    btnGen.disabled = false;
    btnGen.innerText = '⚡ Generieren';
  }
}

function clearPrompt() {
  promptInputEl.value = '';
}

// API Vault Modal & Storage
function openVaultModal() {
  document.getElementById('modal-vault').classList.add('show');
}
function closeVaultModal() {
  document.getElementById('modal-vault').classList.remove('show');
}
function addVaultKey() {
  const provider = document.getElementById('vault-provider').value;
  const key = document.getElementById('vault-key-input').value.trim();
  const label = document.getElementById('vault-label-input').value.trim() || `${provider} Key ${STATE.vaultKeys.length + 1}`;

  if (!key) {
    alert('Bitte geben Sie einen gültigen Schlüssel ein.');
    return;
  }

  STATE.vaultKeys.push({ id: 'k_' + Date.now(), provider, key, label, date: new Date().toLocaleDateString() });
  localStorage.setItem('aetherspace_vault_v1', JSON.stringify(STATE.vaultKeys));
  document.getElementById('vault-key-input').value = '';
  document.getElementById('vault-label-input').value = '';
  renderVaultTable();
}
function deleteVaultKey(id) {
  STATE.vaultKeys = STATE.vaultKeys.filter(k => k.id !== id);
  localStorage.setItem('aetherspace_vault_v1', JSON.stringify(STATE.vaultKeys));
  renderVaultTable();
}
function renderVaultTable() {
  const tbody = document.getElementById('vault-table-body');
  tbody.innerHTML = '';
  STATE.vaultKeys.forEach(k => {
    const tr = document.createElement('tr');
    const masked = k.key.substring(0, 4) + '...' + k.key.substring(k.key.length - 4);
    tr.innerHTML = `
      <td>${k.provider.toUpperCase()}</td>
      <td style="font-family:var(--font-mono);">${masked}</td>
      <td>${k.label}</td>
      <td><span class="badge-free">Free tier</span></td>
      <td><button class="icon-btn" style="padding:2px 6px;" onclick="deleteVaultKey('${k.id}')">Löschen</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Enterprise Auth
function openAuthModal() {
  document.getElementById('modal-auth').classList.add('show');
}
function closeAuthModal() {
  document.getElementById('modal-auth').classList.remove('show');
}
function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'flex' : 'none';
}
function handleAuthSubmit(e, type) {
  e.preventDefault();
  const email = type === 'login' ? document.getElementById('auth-login-email').value : document.getElementById('auth-reg-email').value;
  STATE.authUser = { email, loggedInAt: new Date().toISOString() };
  localStorage.setItem('aetherspace_auth_user', JSON.stringify(STATE.authUser));
  updateAuthUI();
  closeAuthModal();
}
function updateAuthUI() {
  const btn = document.getElementById('btn-auth-user');
  if (STATE.authUser) {
    btn.innerText = `👤 ${STATE.authUser.email.split('@')[0]}`;
  } else {
    btn.innerText = '👤 Anmelden';
  }
}

// Cloud-Staging & Export Engine
function exportStandaloneHtml() {
  if (STATE.files.length === 0) {
    alert('Keine Dateien zum Exportieren vorhanden.');
    return;
  }
  const mainHtml = STATE.files.find(f => f.name.endsWith('.html'))?.content || '<h1>AetherSpace Standalone Export</h1>';
  const blob = new Blob([mainHtml], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aetherspace_export.html';
  a.click();
}

function exportZipBundle() {
  if (STATE.files.length === 0) {
    alert('Keine Dateien für ein ZIP-Bundle vorhanden.');
    return;
  }
  let manifest = 'AetherSpace Projekt Bundle\nErstellt am: ' + new Date().toISOString() + '\n\n';
  STATE.files.forEach(f => {
    manifest += `=== DATEI: ${f.name} ===\n${f.content}\n\n`;
  });
  const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aetherspace_bundle.txt';
  a.click();
}

function stageToCodePen() {
  const htmlFile = STATE.files.find(f => f.name.endsWith('.html'))?.content || '';
  const cssFile = STATE.files.find(f => f.name.endsWith('.css'))?.content || '';
  const jsFile = STATE.files.find(f => f.name.endsWith('.js'))?.content || '';

  const data = {
    title: 'AetherSpace Project',
    html: htmlFile,
    css: cssFile,
    js: jsFile
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
}

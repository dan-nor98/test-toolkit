/**
 * DevToolkit Pro - Popup Controller
 */

class PopupController {
  constructor(pageId) {
    this.db = null;
    this.currentTab = 'generator';
    this.clipboardEntries = [];
    this.isAutoCopy = localStorage.getItem('dt_auto_copy') === 'true';
    
    if (pageId === 'popup-body') {
      this.initPopup();
    } else if (pageId === 'api-tester-body') {
      this.initApiTester();
    }
  }

  async initPopup() {
    await this.initDatabase();
    this.setupPopupEventListeners();
    this.loadClipboardHistory();
    this.listenForUpdates();

    const toggle = document.getElementById('autoCopyToggle');
    if (toggle) {
      toggle.checked = this.isAutoCopy;
    }
  }

  initApiTester() {
    this.setupApiTesterEventListeners();
    this.renderApiLists(); 
  }

  // Database Management
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ClipboardDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('logs')) {
          const store = db.createObjectStore('logs', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Event Listeners
  setupPopupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('clearClipboard')?.addEventListener('click', () => {
      this.clearClipboard();
    });

    document.getElementById('clipboardSearch')?.addEventListener('input', (e) => {
      this.renderClipboardList(this.clipboardEntries, e.target.value);
    });

    document.querySelectorAll('.gen-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.generateData(e));
    });

    // Auto Copy Toggle
    document.getElementById('autoCopyToggle')?.addEventListener('change', (e) => {
      this.isAutoCopy = e.target.checked;
      localStorage.setItem('dt_auto_copy', this.isAutoCopy);
    });

    document.querySelectorAll('.gen-item__toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panelId = btn.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        
        if (panel) {
          const isExpanded = btn.getAttribute('aria-expanded') === 'true';
          if (isExpanded) {
            panel.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
          } else {
            panel.removeAttribute('hidden');
            btn.setAttribute('aria-expanded', 'true');
          }
        }
      });
    });

    document.getElementById('formatJsonBtn')?.addEventListener('click', () => {
      this.formatJSON();
    });
    
    document.getElementById('copyJsonOutput')?.addEventListener('click', () => {
      const text = document.getElementById('jsonOutput').textContent;
      if (text) this.copyToClipboard(text);
      else this.showToast('Nothing to copy', 'error');
     });

    document.getElementById('copyOutput')?.addEventListener('click', () => {
      this.copyOutputToClipboard();
    });

    document.getElementById('openApiTab')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('api-tester.html') });
      window.close(); 
    });
  }

  setupApiTesterEventListeners() {
    document.getElementById('executeCurl')?.addEventListener('click', () => {
      this.executeCurl();
    });

    document.getElementById('saveRequestBtn')?.addEventListener('click', () => {
      this.saveToCollections();
    });
  }

  // Tab Management
  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.currentTab = tabName;
  }

  // Clipboard Management
  listenForUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_COPY_SAVED') {
        this.loadClipboardHistory();
      }
    });
  }

  async loadClipboardHistory() {
    if (!this.db) return;

    const tx = this.db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.getAll();

    request.onsuccess = () => {
      const entries = request.result.reverse();
      this.clipboardEntries = entries;
      this.renderClipboardList(entries);
    };
  }

  renderClipboardList(entries, filterText = '') {
    if (filterText) {
      filterText = filterText.toLowerCase();
      entries = entries.filter(entry => entry.text.toLowerCase().includes(filterText));
    }

    const container = document.getElementById('clipboardList');
    
    if (!entries || entries.length === 0) {
      const emptyState = filterText ? `<div class="empty-state"><p>No matches found</p></div>` : `
        <div class="empty-state">
          <p style="opacity:0.5;">No clipboard entries yet</p>
        </div>
      `;
      container.innerHTML = emptyState;
      return;
    }

    container.innerHTML = entries.map(entry => {
      return `
      <div class="clipboard-item"> 
        <div class="clipboard-time">${entry.time || entry.date || new Date(entry.timestamp).toLocaleString()}</div>
        <div class="clipboard-text">${this.escapeHtml(entry.text)}</div>
      </div>
    `;}).join('');
    
    // Add click listeners programmatically
    const items = container.querySelectorAll('.clipboard-item');
    items.forEach((item, index) => {
      item.addEventListener('click', () => {
        if (entries[index]) {
          this.copyToClipboard(entries[index].text);
        }
      });
    });
  }

  async clearClipboard() {
    if (!this.db) return;
    const tx = this.db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    store.clear().onsuccess = () => {
      this.loadClipboardHistory();
      this.showToast('Clipboard history cleared');
    };
  }

  // Generator Logic
  generateData(e) {
    const btn = e.currentTarget;
    const type = btn.dataset.type;
    const group = btn.closest('.gen-item-group'); 

    let value = '';
    let formatted = '';

    try {
      switch (type) {
        case 'name':
          value = DataGenerators.generateName();
          break;
        case 'phone':
          value = DataGenerators.generatePhoneNumber();
          formatted = this.formatPhoneNumber(value);
          break;
        case 'nationalCode':
          value = DataGenerators.generateNationalCode();
          formatted = this.formatNationalCode(value);
          break;
        case 'bankCard':
          value = DataGenerators.generateBankCardNumber();
          formatted = DataGenerators.formatCardNumber(value);
          break;
        case 'sheba':
          value = DataGenerators.generateShebaNumber();
          formatted = DataGenerators.formatIBAN(value);
          break;
        case 'email':
          value = DataGenerators.generateEmail();
          break;
        case 'password':
          const options = this.getPasswordOptions(group);
          value = DataGenerators.generatePassword(options);
          break;
        case 'uuid':
          value = DataGenerators.generateUUID();
          break;
        default:
      }

      this.displayGeneratedData(formatted || value, value);
      
      if (this.isAutoCopy) {
        this.copyToClipboard(value);
      }
    } catch (error) {
      this.showToast('Generation failed: ' + error.message, 'error');
    }
  }

  getPasswordOptions(groupElement) {
    if (!groupElement) {
      throw new Error('Could not find password options container');
    }
    const optionsEl = groupElement.querySelector('.gen-item-group__options');
    if (!optionsEl) {
      throw new Error('Could not find password options');
    }
    return {
      length: parseInt(optionsEl.querySelector('.gen-opt-pass-len').value, 10),
      useUpper: optionsEl.querySelector('.gen-opt-pass-upper').checked,
      useLower: optionsEl.querySelector('.gen-opt-pass-lower').checked,
      useNumbers: optionsEl.querySelector('.gen-opt-pass-num').checked,
      useSymbols: optionsEl.querySelector('.gen-opt-pass-sym').checked,
    };
  }

  displayGeneratedData(displayValue, rawValue) {
    const container = document.getElementById('generatorOutput');
    const valueElement = document.getElementById('outputValue');
    valueElement.textContent = displayValue;
    valueElement.dataset.raw = rawValue;
    container.style.display = 'block';
  }

  copyOutputToClipboard() {
    const valueElement = document.getElementById('outputValue');
    const rawValue = valueElement.dataset.raw || valueElement.textContent;
    this.copyToClipboard(rawValue);
  }

  // --- API History & Collections Logic ---

  getApiStorage() {
    return {
      history: JSON.parse(localStorage.getItem('dt_api_history') || '[]'),
      collections: JSON.parse(localStorage.getItem('dt_api_collections') || '[]')
    };
  }

  saveToHistory(curl) {
    if (!curl) return;
    const { history } = this.getApiStorage();
    const newHistory = history.filter(item => item !== curl);
    newHistory.unshift(curl);
    if (newHistory.length > 10) newHistory.pop();
    
    localStorage.setItem('dt_api_history', JSON.stringify(newHistory));
    this.renderApiLists();
  }

  saveToCollections() {
    const curl = document.getElementById('curlInput').value.trim();
    if (!curl) {
      this.showToast('Enter a cURL command first', 'error');
      return;
    }
    const name = prompt('Name this request (e.g., "Prod Login"):');
    if (!name) return;

    const { collections } = this.getApiStorage();
    const newCollections = [...collections, { id: Date.now(), name, curl }];
    
    localStorage.setItem('dt_api_collections', JSON.stringify(newCollections));
    this.renderApiLists();
    this.showToast('Request Saved');
  }

  deleteCollectionItem(id) {
    const { collections } = this.getApiStorage();
    const newCollections = collections.filter(item => item.id !== id);
    localStorage.setItem('dt_api_collections', JSON.stringify(newCollections));
    this.renderApiLists();
  }

  loadCurlIntoInput(curl) {
    document.getElementById('curlInput').value = curl;
  }

  // REFACTORED: Create elements programmatically to avoid unsafe inline onclick
  renderApiLists() {
    const { history, collections } = this.getApiStorage();
    
    // --- Render Collections ---
    const colList = document.getElementById('collectionList');
    if (colList) {
      colList.innerHTML = '';
      if (collections.length === 0) {
        colList.innerHTML = '<li class="empty-msg">No saved requests</li>';
      } else {
        collections.forEach(item => {
          const li = document.createElement('li');
          li.className = 'req-item';
          
          const span = document.createElement('span');
          span.className = 'req-name';
          span.textContent = item.name;
          li.appendChild(span);

          const btn = document.createElement('button');
          btn.className = 'req-delete';
          btn.innerHTML = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
          
          // Delete Event
          btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop bubbling to li
            this.deleteCollectionItem(item.id);
          });
          li.appendChild(btn);

          // Load Event
          li.addEventListener('click', () => {
            this.loadCurlIntoInput(item.curl);
          });

          colList.appendChild(li);
        });
      }
    }

    // --- Render History ---
    const histList = document.getElementById('historyList');
    if (histList) {
      histList.innerHTML = '';
      if (history.length === 0) {
        histList.innerHTML = '<li class="empty-msg">No recent history</li>';
      } else {
        history.forEach(curl => {
          const li = document.createElement('li');
          li.className = 'req-item';
          
          const preview = curl.length > 30 ? curl.substring(0, 30) + '...' : curl;
          
          const span = document.createElement('span');
          span.className = 'req-name';
          span.style.fontFamily = 'monospace';
          span.style.fontSize = '11px';
          span.textContent = preview;
          li.appendChild(span);

          // Load Event
          li.addEventListener('click', () => {
            this.loadCurlIntoInput(curl);
          });

          histList.appendChild(li);
        });
      }
    }
  }

  // API Execution
  async executeCurl() {
    const input = document.getElementById('curlInput').value.trim();
    const responseContainer = document.getElementById('apiResponse');
    const responseBody = document.getElementById('responseBody');
    const statusBadge = document.getElementById('responseStatus');
    const timeBadge = document.getElementById('responseTime');
    const executeBtn = document.getElementById('executeCurl');

    if (!input) {
      this.showToast('Please enter a cURL command', 'error');
      return;
    }

    // Save to history first
    this.saveToHistory(input);

    try {
      executeBtn.disabled = true;
      executeBtn.innerHTML = 'Executing...';
      
      responseContainer.style.display = 'block';
      responseBody.textContent = 'Loading...';
      statusBadge.textContent = '';
      timeBadge.textContent = '';

      const startTime = performance.now();
      const { url, options } = CurlParser.parse(input);
      
      const response = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
        responseBody.innerHTML = this.syntaxHighlightJSON(responseData);
      } else {
        responseData = await response.text();
        responseBody.textContent = responseData;
      }

      statusBadge.textContent = `${response.status} ${response.statusText}`;
      statusBadge.style.color = response.ok ? 'var(--success)' : 'var(--danger)';
      timeBadge.textContent = `${duration}ms`;

    } catch (error) {
      responseBody.textContent = `Error: ${error.message}`;
      statusBadge.textContent = 'Error';
      statusBadge.style.color = 'var(--danger)';
      this.showToast('Request failed', 'error');
    } finally {
      executeBtn.disabled = false;
      executeBtn.innerHTML = `
        <svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Run
      `;
    }
  }

  // JSON Formatter
  formatJSON() {
    const input = document.getElementById('jsonInput').value;
    const responseContainer = document.getElementById('jsonResponse');
    const outputEl = document.getElementById('jsonOutput');

    if (!input) {
      this.showToast('Please enter JSON to format', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const highlighted = this.syntaxHighlightJSON(parsed);
      outputEl.innerHTML = highlighted;
      responseContainer.style.display = 'block';
    } catch (error) {
      outputEl.textContent = `Invalid JSON: ${error.message}`;
      responseContainer.style.display = 'block';
      this.showToast('Invalid JSON', 'error');
    }
  }

  // Utility Functions
  copyToClipboard(text) {
    if (!text) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();

    try {
      document.execCommand('copy');
      this.showToast('Copied to clipboard!');
      chrome.runtime.sendMessage({ type: 'SAVE_CLIPBOARD', text: text }).catch(() => {});
    } catch (err) {
      console.log('Failed to copy', err);
      this.showToast('Failed to copy', 'error');
    }
    document.body.removeChild(ta);
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toastMessage');
    messageEl.textContent = message;
    
    // Reset classes for animation
    toast.classList.remove('show');
    void toast.offsetWidth; // Trigger reflow
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  syntaxHighlightJSON(json) {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  formatPhoneNumber(phone) { return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3'); }
  formatNationalCode(code) { return code.replace(/(\d{3})(\d{6})(\d{1})/, '$1-$2-$3'); }
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  new PopupController(pageId); 
});
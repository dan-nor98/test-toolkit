/**
 * DevToolkit Pro - Popup Controller
 */

class PopupController {
  constructor(pageId) { // MODIFIED: Accept pageId
    this.db = null;
    this.currentTab = 'clipboard';
    this.clipboardEntries = [];
    
    // Route logic based on which page is loaded
    if (pageId === 'popup-body') {
      this.initPopup();
    } else if (pageId === 'api-tester-body') {
      this.initApiTester();
    }
  }

  // NEW: Method to run only popup logic
  async initPopup() {
    await this.initDatabase();
    this.setupPopupEventListeners(); // Renamed
    this.loadClipboardHistory();
    this.listenForUpdates();
  }

  // NEW: Method to run only API tester logic
  initApiTester() {
    this.setupApiTesterEventListeners(); // New specific method
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
  // MODIFIED: Rename setupEventListeners to setupPopupEventListeners
  setupPopupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Clipboard
    document.getElementById('clearClipboard')?.addEventListener('click', () => {
      this.clearClipboard();
    });

    // Generator buttons
    document.querySelectorAll('.gen-btn').forEach(btn => {
      btn.addEventListener('click', () => this.generateData(btn.dataset.type));
    });

    document.getElementById('copyOutput')?.addEventListener('click', () => {
      this.copyOutputToClipboard();
    });

    // API Tester (NEW BUTTON)
    document.getElementById('openApiTab')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('api-tester.html') });
      window.close(); // Optional: close popup after opening tab
    });
  }

  // NEW: Method for just API tester listeners
  setupApiTesterEventListeners() {
    document.getElementById('executeCurl')?.addEventListener('click', () => {
      this.executeCurl();
    });
  }

  // Tab Management
  switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
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
      this.renderClipboardList(entries);
    };
  }

  renderClipboardList(entries) {
    this.clipboardEntries = entries; // <-- ADDED: Save entries to class property
    const container = document.getElementById('clipboardList');
    
    if (!entries || entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
          <p>No clipboard entries yet</p>
          <small>Copy text anywhere to start logging</small>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.map((entry, index) => `
      <div class="clipboard-item" data-index="${index}"> <div class="clipboard-item-header">
          <span class="clipboard-time">${entry.time || entry.date || new Date(entry.timestamp).toLocaleString()}</span>
        </div>
        <div class="clipboard-text">${this.escapeHtml(entry.text)}</div>
      </div>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.clipboard-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = item.dataset.index; // <-- MODIFIED: Get index
        if (this.clipboardEntries[index]) {
          const text = this.clipboardEntries[index].text; // <-- MODIFIED: Get raw text from stored array
          this.copyToClipboard(text);
        }
      });
    });
  }

  async clearClipboard() {
    if (!this.db) return;

    // Removed confirm() as it is not ideal in extensions.
    // A custom modal would be a better UX improvement.
    // if (!confirm('Clear all clipboard history?')) return;

    const tx = this.db.transaction('logs', 'readwrite');
    const store = tx.objectStore('logs');
    
    store.clear().onsuccess = () => {
      this.loadClipboardHistory();
      this.showToast('Clipboard history cleared');
    };
  }

  // Data Generator
  generateData(type) {
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
        default:
          throw new Error('Unknown generator type');
      }

      this.displayGeneratedData(formatted || value, value);
    } catch (error) {
      this.showToast('Generation failed: ' + error.message, 'error');
    }
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

  // API Tester
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

    try {
      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';
      
      responseContainer.style.display = 'block';
      responseBody.textContent = 'Loading...';
      statusBadge.textContent = '';
      timeBadge.textContent = '';

      const startTime = performance.now();
      const { url, options } = CurlParser.parse(input);
      
      const response = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      // Parse response
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
        responseBody.innerHTML = this.syntaxHighlightJSON(responseData);
      } else {
        responseData = await response.text();
        responseBody.textContent = responseData;
      }

      // Update status
      statusBadge.textContent = `${response.status} ${response.statusText}`;
      statusBadge.className = `status-badge ${response.ok ? 'success' : 'error'}`;
      timeBadge.textContent = `${duration}ms`;

    } catch (error) {
      responseBody.textContent = `Error: ${error.message}`;
      statusBadge.textContent = 'Error';
      statusBadge.className = 'status-badge error';
      this.showToast('Request failed', 'error');
    } finally {
      executeBtn.disabled = false;
      executeBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Execute Request
      `;
    }
  }

  // Utility Functions
  copyToClipboard(text) {
    if (!text) return; // Don't copy empty text

    // Use the 'execCommand' method, which is more reliable in popups
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();

    try {
      document.execCommand('copy');
      this.showToast('Copied to clipboard!');
      
      // Send to background script to log this copy
      chrome.runtime.sendMessage({
        type: 'SAVE_CLIPBOARD',
        text: text
      }).catch((error) => {
        // Per your preference, logging for development
        console.log('DevToolkit: Failed to send copy log from popup', error);
      });

    } catch (err) {
      console.log('DevToolkit: Failed to copy text from popup', err); // Log for dev
      this.showToast('Failed to copy', 'error');
    }

    document.body.removeChild(ta);
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toastMessage');
    
    messageEl.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  syntaxHighlightJSON(json) {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, null, 2);
    }
    
    json = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
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

  formatPhoneNumber(phone) {
    // 0912 345 6789
    return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
  }

  formatNationalCode(code) {
    // 123-456789-0
    return code.replace(/(\d{3})(\d{6})(\d{1})/, '$1-$2-$3');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup controller when DOM is ready
// MODIFIED
document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  new PopupController(pageId); // Pass the ID
});
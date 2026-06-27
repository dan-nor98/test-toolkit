/**
 * DevToolkit Pro - Popup Controller
 */

const DEFAULT_CLIPBOARD_SETTINGS = {
  captureEnabled: true,
  maxHistorySize: 100,
  retentionDays: 0,
  blockedDomains: []
};

class PopupController {
  constructor(pageId) {
    this.db = null;
    this.currentTab = 'generator';
    this.clipboardEntries = [];
    this.clipboardSettings = { ...DEFAULT_CLIPBOARD_SETTINGS };
    this.settingsSaveTimer = null;
    this.isAutoCopy = localStorage.getItem('dt_auto_copy') === 'true';
    this.authConfig = null;
    this.authTimerInterval = null;
    this.activeCurlController = null;
    this.activeCurlTimedOut = false;
    this.apiRequestTimeoutMs = Number(localStorage.getItem('dt_api_request_timeout_ms')) || 30000;
    this.websiteNotes = {};
    this.currentWebsiteKey = '';
    this.currentWebsiteContext = null;
    this.notesSaveTimer = null;

    if (pageId === 'popup-body') {
      this.initPopup();
    } else if (pageId === 'api-tester-body') {
      this.initApiTester();
    }
  }

  async initPopup() {
    this.renderInitialLoadingStates();
    this.setupPopupEventListeners();
    this.listenForUpdates();
    this.setupAuthenticatorEventListeners();

    const toggle = document.getElementById('autoCopyToggle');
    if (toggle) {
      toggle.checked = this.isAutoCopy;
    }

    try {
      await this.initDatabase();
      await this.loadClipboardSettings();
      this.loadClipboardHistory();
      await this.loadWebsiteNotes();
    } catch (error) {
      console.log('Popup initialization failed', error);
      this.setInlineStatus('generatorStatus', 'Some data could not load.', 'error');
    }
  }

  initApiTester() {
    this.setupApiTesterEventListeners();
    this.setInlineStatus('apiRequestStatus', 'Loading saved requests...');
    window.requestAnimationFrame(() => {
      this.renderApiLists();
      this.setInlineStatus('apiRequestStatus', 'Ready');
    });
    this.updateParsedCurlPreview();
    this.setApiResponseState('idle');
  }

  renderInitialLoadingStates() {
    this.renderClipboardSkeleton();
    this.renderTodoSkeleton();
  }

  renderClipboardSkeleton() {
    const container = document.getElementById('clipboardList');
    if (!container) return;

    container.setAttribute('aria-busy', 'true');
    container.innerHTML = `
      <div class="skeleton-list" aria-label="Loading clipboard history">
        <div class="skeleton-row skeleton-row--clipboard"></div>
        <div class="skeleton-row skeleton-row--clipboard"></div>
        <div class="skeleton-row skeleton-row--clipboard"></div>
      </div>
    `;
  }

  renderTodoSkeleton() {
    const container = document.getElementById('todoList');
    if (!container) return;

    container.setAttribute('aria-busy', 'true');
    container.innerHTML = `
      <div class="skeleton-list" aria-label="Loading todos">
        <div class="skeleton-row skeleton-row--todo"></div>
        <div class="skeleton-row skeleton-row--todo"></div>
      </div>
    `;
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

    document.getElementById('commandSearch')?.addEventListener('input', (e) => {
      this.filterToolNavigation(e.target.value);
    });

    document.getElementById('commandSearch')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;

      const firstMatch = document.querySelector('.tab-btn:not(.is-hidden)');
      if (firstMatch?.dataset.tab) {
        this.switchTab(firstMatch.dataset.tab);
        e.preventDefault();
      }
    });
    this.updateCommandSearchStatus('');

    document.getElementById('clearClipboard')?.addEventListener('click', () => {
      this.clearClipboard();
    });

    document.getElementById('clipboardSearch')?.addEventListener('input', (e) => {
      this.renderClipboardList(this.clipboardEntries, e.target.value);
    });

    document.getElementById('captureEnabledToggle')?.addEventListener('change', (e) => {
      this.updateClipboardSettings({ captureEnabled: e.target.checked });
    });

    document.getElementById('maxHistorySize')?.addEventListener('input', (e) => {
      this.updateClipboardSettings({ maxHistorySize: e.target.value });
    });

    document.getElementById('retentionDays')?.addEventListener('input', (e) => {
      this.updateClipboardSettings({ retentionDays: e.target.value });
    });

    document.getElementById('blockedDomains')?.addEventListener('input', (e) => {
      this.updateClipboardSettings({ blockedDomains: e.target.value });
    });

    this.setupClipboardSettingsDisclosure();

    document.querySelectorAll('.gen-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.generateData(e));
    });

    document.addEventListener('keydown', (e) => this.handleGeneratorShortcut(e));

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

    document.getElementById('formatJsonBtn')?.addEventListener('click', (e) => {
      this.formatJSON(e.currentTarget);
    });

    document.getElementById('copyJsonOutput')?.addEventListener('click', (e) => {
      const text = document.getElementById('jsonOutput').textContent;
      if (text) this.copyToClipboard(text, { button: e.currentTarget, statusId: 'jsonCopyStatus' });
      else this.showToast('Nothing to copy', 'error');
     });

    document.getElementById('copyOutput')?.addEventListener('click', (e) => {
      this.copyOutputToClipboard(e.currentTarget);
    });

    document.getElementById('openApiTab')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('api-tester.html') });
      window.close();
    });

    document.getElementById('websiteNoteInput')?.addEventListener('input', (e) => {
      this.updateWebsiteNote(e.target.value);
    });

    document.getElementById('addTodoBtn')?.addEventListener('click', () => {
      this.addWebsiteTodo();
    });

    document.getElementById('todoInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addWebsiteTodo();
      }
    });

    document.getElementById('clearWebsiteNotes')?.addEventListener('click', () => {
      this.clearCurrentWebsiteNotes();
    });
  }

  setupAuthenticatorEventListeners() {
    document.getElementById('authQrInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await this.loadAuthFromQrFile(file);
      e.target.value = '';
    });

    document.getElementById('loadAuthUri')?.addEventListener('click', () => {
      const uri = document.getElementById('authManualUri')?.value?.trim();
      if (!uri) {
        this.showToast('Paste Google Authenticator secret key or otpauth URI first', 'error');
        return;
      }
      this.loadAuthenticatorFromUri(uri);
    });

    document.getElementById('copyAuthCode')?.addEventListener('click', () => {
      const code = document.getElementById('authToken')?.dataset?.raw;
      if (code) {
        this.copyToClipboard(code);
      }
    });
  }

  async loadAuthFromQrFile(file) {
    try {
      if (!('BarcodeDetector' in window)) {
        this.showToast('QR detection is not supported in this browser. Paste the manual otpauth:// URI or secret key instead.', 'error');
        return;
      }

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);

      if (!barcodes.length || !barcodes[0].rawValue) {
        this.showToast('No QR code found in image', 'error');
        return;
      }

      const uri = barcodes[0].rawValue.trim();
      document.getElementById('authManualUri').value = uri;
      this.loadAuthenticatorFromUri(uri);
    } catch (error) {
      this.showToast('Could not read QR code', 'error');
      console.log('QR decode failed', error);
    }
  }

  loadAuthenticatorFromUri(uri) {
    try {
      const config = this.parseOtpAuthUri(uri);
      this.authConfig = config;

      document.getElementById('authIssuer').textContent = config.issuer || '-';
      document.getElementById('authAccount').textContent = config.account || '-';
      document.getElementById('authDetails').style.display = 'block';
      const authEmptyState = document.getElementById('authEmptyState');
      if (authEmptyState) authEmptyState.style.display = 'none';

      this.startAuthTicker();
      this.showToast('Authenticator loaded');
    } catch (error) {
      this.showToast(error.message || 'Invalid otpauth URI', 'error');
    }
  }

  parseOtpAuthUri(inputValue) {
    const rawInput = (inputValue || '').trim();

    // 1) Support plain Google Authenticator-style secret keys directly.
    const directSecret = this.normalizeBase32Secret(rawInput);
    if (directSecret) {
      return this.createBase32Config(directSecret);
    }

    // 2) Support freeform text containing secret=... (e.g. copied setup snippets).
    const extractedSecret = this.extractBase32Secret(rawInput);
    if (extractedSecret) {
      return this.createBase32Config(extractedSecret);
    }

    // 3) Support otpauth://totp URI.
    let parsed;
    try {
      parsed = new URL(rawInput);
    } catch {
      throw new Error('Invalid input. Use Google Authenticator secret key or otpauth URI');
    }

    if (parsed.protocol !== 'otpauth:' || parsed.hostname !== 'totp') {
      throw new Error('Only otpauth://totp URIs are supported');
    }

    const label = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const issuerFromLabel = label.includes(':') ? label.split(':')[0] : '';
    const account = label.includes(':') ? label.split(':').slice(1).join(':') : label;

    const secret = this.normalizeBase32Secret(parsed.searchParams.get('secret') || '');
    if (!secret) {
      throw new Error('Missing or invalid Base32 secret in URI');
    }

    const issuer = parsed.searchParams.get('issuer') || issuerFromLabel;
    const digits = Number(parsed.searchParams.get('digits') || 6);
    const period = Number(parsed.searchParams.get('period') || 30);
    const algorithm = (parsed.searchParams.get('algorithm') || 'SHA1').toUpperCase();

    if (![6, 7, 8].includes(digits)) throw new Error('Unsupported digits (use 6-8)');
    if (!Number.isFinite(period) || period <= 0) throw new Error('Invalid period');
    if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) throw new Error('Unsupported algorithm');

    return { secret, issuer, account, digits, period, algorithm };
  }

  createBase32Config(secret) {
    return {
      secret,
      issuer: 'Imported Secret',
      account: 'Manual Entry',
      digits: 6,
      period: 30,
      algorithm: 'SHA1'
    };
  }

  normalizeBase32Secret(value) {
    const normalized = (value || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '')
      .replace(/=+$/g, '');

    if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
      return '';
    }

    return normalized;
  }

  extractBase32Secret(text) {
    if (!text) return '';

    const secretMatch = text.match(/(?:^|[?&\s])secret\s*=\s*([A-Z2-7\s\-=]+)/i);
    if (secretMatch?.[1]) {
      return this.normalizeBase32Secret(secretMatch[1]);
    }

    return '';
  }

  startAuthTicker() {
    if (this.authTimerInterval) {
      clearInterval(this.authTimerInterval);
    }

    this.updateAuthToken();
    this.authTimerInterval = setInterval(() => {
      this.updateAuthToken();
    }, 1000);
  }

  async updateAuthToken() {
    if (!this.authConfig) return;

    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = this.authConfig.period - (nowSec % this.authConfig.period);
      const code = await this.generateTotpCode(this.authConfig, nowSec);

      const tokenEl = document.getElementById('authToken');
      const timerEl = document.getElementById('authTimer');
      const progressEl = document.getElementById('authProgress');

      tokenEl.textContent = this.formatOtpCode(code);
      tokenEl.dataset.raw = code;
      timerEl.textContent = `Refreshing in ${remaining}s`;
      progressEl.style.width = `${((this.authConfig.period - remaining) / this.authConfig.period) * 100}%`;
    } catch (error) {
      this.showToast('Failed to generate OTP', 'error');
      console.log('OTP generation error', error);
    }
  }

  formatOtpCode(code) {
    if (code.length !== 6) return code;
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }

  async generateTotpCode(config, currentUnixSeconds) {
    const counter = Math.floor(currentUnixSeconds / config.period);
    const keyBytes = this.base32ToBytes(config.secret);
    const algo = config.algorithm.replace('SHA', 'SHA-');

    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: algo },
      false,
      ['sign']
    );

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    const high = Math.floor(counter / 0x100000000);
    const low = counter >>> 0;
    counterView.setUint32(0, high);
    counterView.setUint32(4, low);

    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuffer));
    const offset = signature[signature.length - 1] & 0x0f;

    const binaryCode = (
      ((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff)
    ) >>> 0;

    const otp = binaryCode % (10 ** config.digits);
    return otp.toString().padStart(config.digits, '0');
  }

  base32ToBytes(input) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = input.toUpperCase().replace(/=+$/g, '');

    let bits = '';
    for (const char of cleaned) {
      const val = alphabet.indexOf(char);
      if (val === -1) {
        throw new Error('Invalid Base32 secret');
      }
      bits += val.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    return new Uint8Array(bytes);
  }

  setupApiTesterEventListeners() {
    document.getElementById('executeCurl')?.addEventListener('click', (e) => {
      this.executeCurl(e.currentTarget);
    });

    document.getElementById('cancelCurl')?.addEventListener('click', () => {
      this.cancelCurlRequest();
    });

    document.getElementById('saveRequestBtn')?.addEventListener('click', (e) => {
      this.saveToCollections(e.currentTarget);
    });

    document.getElementById('curlInput')?.addEventListener('input', () => {
      this.updateParsedCurlPreview();
    });
  }

  // Tab Management
  filterToolNavigation(query) {
    const normalizedQuery = query.trim().toLowerCase();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const label = btn.textContent.trim().toLowerCase();
      const tabId = btn.dataset.tab || '';
      const keywords = btn.dataset.keywords || '';
      const searchableText = `${label} ${tabId} ${keywords}`.toLowerCase();
      const shouldHide = Boolean(normalizedQuery && !searchableText.includes(normalizedQuery));
      btn.classList.toggle('is-hidden', shouldHide);
    });

    document.querySelectorAll('.tab-group').forEach(group => {
      const hasVisibleTools = Boolean(group.querySelector('.tab-btn:not(.is-hidden)'));
      group.classList.toggle('is-empty', !hasVisibleTools);
    });

    this.updateCommandSearchStatus(normalizedQuery);
  }

  updateCommandSearchStatus(query) {
    const status = document.getElementById('commandSearchStatus');
    if (!status) return;

    const visibleTools = document.querySelectorAll('.tab-btn:not(.is-hidden)').length;
    const totalTools = document.querySelectorAll('.tab-btn').length;

    if (!query) {
      status.textContent = `Type to filter tools. ${totalTools} tools available.`;
      return;
    }

    if (visibleTools === 0) {
      status.textContent = 'No matching tools.';
      return;
    }

    const resultLabel = visibleTools === 1 ? 'tool' : 'tools';
    status.textContent = `${visibleTools} ${resultLabel} found. Enter opens first match.`;
  }

  switchTab(tabName) {
    if (tabName === 'notes') {
      this.loadWebsiteNotes();
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.currentTab = tabName;
  }

  // Clipboard Management
  getStorageLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  setStorageLocal(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  async loadClipboardSettings() {
    const stored = await this.getStorageLocal(['clipboardSettings']);
    this.clipboardSettings = this.normalizeClipboardSettings(stored.clipboardSettings);
    await this.setStorageLocal({ clipboardSettings: this.clipboardSettings });
    this.renderClipboardSettings();
  }

  normalizeClipboardSettings(settings = {}) {
    const maxHistorySize = Number.parseInt(settings.maxHistorySize, 10);
    const retentionDays = Number.parseInt(settings.retentionDays, 10);
    const blockedDomains = Array.isArray(settings.blockedDomains)
      ? settings.blockedDomains
      : this.parseBlockedDomains(settings.blockedDomains || '');

    return {
      captureEnabled: settings.captureEnabled !== false,
      maxHistorySize: Number.isFinite(maxHistorySize) ? Math.min(Math.max(maxHistorySize, 1), 1000) : DEFAULT_CLIPBOARD_SETTINGS.maxHistorySize,
      retentionDays: Number.isFinite(retentionDays) ? Math.min(Math.max(retentionDays, 0), 3650) : DEFAULT_CLIPBOARD_SETTINGS.retentionDays,
      blockedDomains: this.parseBlockedDomains(blockedDomains.join('\n'))
    };
  }

  parseBlockedDomains(value) {
    return (value || '')
      .split(/[\n,]+/)
      .map(domain => domain.trim().toLowerCase())
      .map(domain => domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
      .filter(Boolean)
      .filter((domain, index, domains) => domains.indexOf(domain) === index);
  }

  renderClipboardSettings() {
    const toggle = document.getElementById('captureEnabledToggle');
    const label = document.getElementById('captureEnabledLabel');
    const maxHistorySize = document.getElementById('maxHistorySize');
    const retentionDays = document.getElementById('retentionDays');
    const blockedDomains = document.getElementById('blockedDomains');

    if (toggle) toggle.checked = this.clipboardSettings.captureEnabled;
    if (label) label.textContent = this.clipboardSettings.captureEnabled ? 'Capture On' : 'Capture Paused';
    if (maxHistorySize) maxHistorySize.value = this.clipboardSettings.maxHistorySize;
    if (retentionDays) retentionDays.value = this.clipboardSettings.retentionDays || '';
    if (blockedDomains) blockedDomains.value = this.clipboardSettings.blockedDomains.join('\n');
  }

  updateClipboardSettings(changes) {
    const nextSettings = { ...this.clipboardSettings };

    if (Object.prototype.hasOwnProperty.call(changes, 'captureEnabled')) {
      nextSettings.captureEnabled = Boolean(changes.captureEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'maxHistorySize')) {
      nextSettings.maxHistorySize = changes.maxHistorySize;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'retentionDays')) {
      nextSettings.retentionDays = changes.retentionDays === '' ? 0 : changes.retentionDays;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'blockedDomains')) {
      nextSettings.blockedDomains = this.parseBlockedDomains(changes.blockedDomains);
    }

    this.clipboardSettings = this.normalizeClipboardSettings(nextSettings);
    this.renderClipboardSettings();
    this.queueClipboardSettingsSave();
  }

  setupClipboardSettingsDisclosure() {
    const settingsDisclosure = document.querySelector('.clipboard-settings');
    const settingsSummary = settingsDisclosure?.querySelector('.clipboard-settings-summary');

    if (!settingsDisclosure || !settingsSummary) return;

    const syncExpandedState = () => {
      settingsSummary.setAttribute('aria-expanded', String(settingsDisclosure.open));
    };

    syncExpandedState();
    settingsDisclosure.addEventListener('toggle', syncExpandedState);
  }

  queueClipboardSettingsSave() {
    clearTimeout(this.settingsSaveTimer);
    this.settingsSaveTimer = setTimeout(async () => {
      await this.setStorageLocal({ clipboardSettings: this.clipboardSettings });
      const status = document.getElementById('clipboardSettingsStatus');
      if (status) status.textContent = 'Settings saved locally.';
      this.showToast('Clipboard settings saved');
    }, 300);
  }

  listenForUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_COPY_SAVED') {
        this.loadClipboardHistory();
      }
    });
  }

  async loadClipboardHistory() {
    const container = document.getElementById('clipboardList');
    if (!this.db) {
      if (container) container.setAttribute('aria-busy', 'false');
      return;
    }

    if (container && !this.clipboardEntries.length) {
      this.renderClipboardSkeleton();
    }

    const tx = this.db.transaction('logs', 'readonly');
    const store = tx.objectStore('logs');
    const request = store.getAll();

    request.onsuccess = () => {
      const entries = request.result.reverse();
      this.clipboardEntries = entries;
      this.renderClipboardList(entries);
    };

    request.onerror = () => {
      if (container) {
        container.setAttribute('aria-busy', 'false');
        container.innerHTML = '<div class="empty-state">Clipboard history could not load.</div>';
      }
      this.showToast('Clipboard history failed to load', 'error');
    };
  }

  renderClipboardList(entries, filterText = '') {
    if (filterText) {
      filterText = filterText.toLowerCase();
      entries = entries.filter(entry => entry.text.toLowerCase().includes(filterText));
    }

    const container = document.getElementById('clipboardList');
    if (!container) return;
    container.setAttribute('aria-busy', 'false');

    if (!entries || entries.length === 0) {
      const emptyState = filterText ? `<div class="empty-state"><p>No matches found</p></div>` : `
        <div class="empty-state">
          <p>No clipboard entries yet</p>
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
      const status = document.getElementById('clipboardSettingsStatus');
      if (status) status.textContent = 'Clipboard history cleared.';
      this.showToast('Clipboard history cleared');
    };
  }

  handleGeneratorShortcut(e) {
    const activeElement = document.activeElement;
    const isTyping = activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');

    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTyping) {
      return;
    }

    const target = document.querySelector(`.gen-item[data-shortcut="${e.key}"]`);
    if (!target) {
      return;
    }

    e.preventDefault();
    target.click();
  }

  // Generator Logic
  generateData(e) {
    const btn = e.currentTarget;
    const type = btn.dataset.type;
    const group = btn.closest('.gen-item-group');

    let value = '';
    let formatted = '';

    this.setButtonBusy(btn, true);
    this.setInlineStatus('generatorStatus', 'Generating...');

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
      this.setInlineStatus('generatorStatus', 'Generated', 'success');

      if (this.isAutoCopy) {
        this.copyToClipboard(value, { statusId: 'generatorStatus' });
      }
    } catch (error) {
      this.setInlineStatus('generatorStatus', 'Generation failed', 'error');
      this.showToast('Generation failed: ' + error.message, 'error');
    } finally {
      window.setTimeout(() => this.setButtonBusy(btn, false), 180);
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
    const emptyState = document.getElementById('generatorEmptyState');
    if (emptyState) emptyState.style.display = 'none';
  }

  copyOutputToClipboard(button) {
    const valueElement = document.getElementById('outputValue');
    const rawValue = valueElement.dataset.raw || valueElement.textContent;
    this.copyToClipboard(rawValue, { button, statusId: 'generatorStatus' });
  }


  // Website Notes & Todos
  async loadWebsiteNotes() {
    if (!document.getElementById('tab-notes')) return;

    this.renderTodoSkeleton();
    const status = document.getElementById('notesSaveStatus');
    if (status) status.textContent = 'Loading website notes...';

    const context = await this.getCurrentWebsiteContext();
    this.currentWebsiteContext = context;
    this.currentWebsiteKey = context?.key || '';
    this.updateAppContextLabel(context);

    const stored = await this.getStorageLocal(['websiteNotes']);
    this.websiteNotes = this.normalizeWebsiteNotes(stored.websiteNotes);
    this.ensureCurrentWebsiteRecord();
    this.renderWebsiteNotes();
  }

  getCurrentWebsiteContext() {
    return new Promise((resolve) => {
      if (!chrome.tabs?.query) {
        resolve(null);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (!tab?.url) {
          resolve(null);
          return;
        }

        try {
          const parsed = new URL(tab.url);
          const host = parsed.hostname || parsed.protocol.replace(':', '');
          const key = parsed.origin && parsed.origin !== 'null' ? parsed.origin : tab.url.split('#')[0];
          resolve({
            key,
            url: tab.url,
            title: tab.title || host || 'Current page',
            hostname: host || key
          });
        } catch {
          resolve({
            key: tab.url.split('#')[0],
            url: tab.url,
            title: tab.title || 'Current page',
            hostname: tab.url
          });
        }
      });
    });
  }

  updateAppContextLabel(context) {
    const label = document.getElementById('appContextLabel');
    if (!label) return;

    label.textContent = context?.hostname || 'Current site';
    label.title = context?.url || 'Current website context';
  }

  normalizeWebsiteNotes(notes = {}) {
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) {
      return {};
    }

    return Object.entries(notes).reduce((normalized, [key, value]) => {
      if (!key || !value || typeof value !== 'object') return normalized;

      normalized[key] = {
        title: String(value.title || ''),
        url: String(value.url || ''),
        hostname: String(value.hostname || key),
        note: String(value.note || ''),
        updatedAt: Number(value.updatedAt) || Date.now(),
        todos: Array.isArray(value.todos)
          ? value.todos.map(todo => ({
              id: String(todo.id || `${Date.now()}-${Math.random()}`),
              text: String(todo.text || '').trim(),
              done: Boolean(todo.done),
              createdAt: Number(todo.createdAt) || Date.now()
            })).filter(todo => todo.text)
          : []
      };
      return normalized;
    }, {});
  }

  ensureCurrentWebsiteRecord() {
    if (!this.currentWebsiteKey || !this.currentWebsiteContext) return;

    const existing = this.websiteNotes[this.currentWebsiteKey] || {};
    this.websiteNotes[this.currentWebsiteKey] = {
      title: this.currentWebsiteContext.title,
      url: this.currentWebsiteContext.url,
      hostname: this.currentWebsiteContext.hostname,
      note: existing.note || '',
      todos: Array.isArray(existing.todos) ? existing.todos : [],
      updatedAt: existing.updatedAt || Date.now()
    };
  }

  getCurrentWebsiteRecord() {
    if (!this.currentWebsiteKey) return null;
    this.ensureCurrentWebsiteRecord();
    return this.websiteNotes[this.currentWebsiteKey];
  }

  renderWebsiteNotes() {
    const siteLabel = document.getElementById('notesSiteLabel');
    const noteInput = document.getElementById('websiteNoteInput');
    const status = document.getElementById('notesSaveStatus');
    const clearBtn = document.getElementById('clearWebsiteNotes');

    if (!this.currentWebsiteKey) {
      if (siteLabel) siteLabel.textContent = 'Open a website tab to save notes.';
      if (noteInput) {
        noteInput.value = '';
        noteInput.disabled = true;
      }
      if (status) status.textContent = 'Website notes are unavailable for this page.';
      if (clearBtn) clearBtn.disabled = true;
      this.renderWebsiteTodos([]);
      return;
    }

    const record = this.getCurrentWebsiteRecord();
    if (siteLabel) siteLabel.textContent = record.hostname || record.title || this.currentWebsiteKey;
    if (noteInput) {
      noteInput.disabled = false;
      noteInput.value = record.note || '';
    }
    if (status) status.textContent = 'Notes are saved locally per website.';
    if (clearBtn) clearBtn.disabled = false;
    this.renderWebsiteTodos(record.todos || []);
  }

  renderWebsiteTodos(todos) {
    const container = document.getElementById('todoList');
    if (!container) return;
    container.setAttribute('aria-busy', 'false');

    if (!this.currentWebsiteKey) {
      container.innerHTML = '<div class="empty-state">Todo list is unavailable for this page.</div>';
      return;
    }

    if (!todos.length) {
      container.innerHTML = '<div class="empty-state">No website todos yet.</div>';
      return;
    }

    container.innerHTML = '';
    todos.forEach((todo) => {
      const item = document.createElement('div');
      item.className = `todo-item${todo.done ? ' is-done' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.done;
      checkbox.setAttribute('aria-label', `Mark ${todo.text} as ${todo.done ? 'not done' : 'done'}`);
      checkbox.addEventListener('change', () => this.toggleWebsiteTodo(todo.id));
      item.appendChild(checkbox);

      const text = document.createElement('div');
      text.className = 'todo-text';
      text.textContent = todo.text;
      item.appendChild(text);

      const del = document.createElement('button');
      del.className = 'todo-delete';
      del.type = 'button';
      del.title = 'Delete todo';
      del.textContent = '×';
      del.addEventListener('click', () => this.deleteWebsiteTodo(todo.id));
      item.appendChild(del);

      container.appendChild(item);
    });
  }

  updateWebsiteNote(note) {
    const record = this.getCurrentWebsiteRecord();
    if (!record) return;

    record.note = note;
    record.updatedAt = Date.now();
    this.queueWebsiteNotesSave('Saving…');
  }

  addWebsiteTodo() {
    const input = document.getElementById('todoInput');
    const text = input?.value?.trim();
    const record = this.getCurrentWebsiteRecord();

    if (!record) {
      this.showToast('Open a website tab first', 'error');
      return;
    }
    if (!text) {
      this.showToast('Enter a todo first', 'error');
      return;
    }

    record.todos.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      done: false,
      createdAt: Date.now()
    });
    record.updatedAt = Date.now();
    if (input) input.value = '';
    this.renderWebsiteTodos(record.todos);
    this.queueWebsiteNotesSave('Todo added. Saving...');
  }

  toggleWebsiteTodo(id) {
    const record = this.getCurrentWebsiteRecord();
    if (!record) return;

    const todo = record.todos.find(item => item.id === id);
    if (!todo) return;

    todo.done = !todo.done;
    record.updatedAt = Date.now();
    this.renderWebsiteTodos(record.todos);
    this.queueWebsiteNotesSave('Saving todo...');
  }

  deleteWebsiteTodo(id) {
    const record = this.getCurrentWebsiteRecord();
    if (!record) return;

    record.todos = record.todos.filter(item => item.id !== id);
    record.updatedAt = Date.now();
    this.renderWebsiteTodos(record.todos);
    this.queueWebsiteNotesSave('Deleting todo...');
  }

  clearCurrentWebsiteNotes() {
    if (!this.currentWebsiteKey) return;

    delete this.websiteNotes[this.currentWebsiteKey];
    this.ensureCurrentWebsiteRecord();
    this.renderWebsiteNotes();
    this.queueWebsiteNotesSave('Clearing notes...');
  }

  queueWebsiteNotesSave(statusText = 'Saving...') {
    const status = document.getElementById('notesSaveStatus');
    if (status) status.textContent = statusText;

    clearTimeout(this.notesSaveTimer);
    this.notesSaveTimer = setTimeout(async () => {
      await this.setStorageLocal({ websiteNotes: this.websiteNotes });
      if (status) status.textContent = 'Saved locally for this website.';
    }, 250);
  }

  // --- API History & Collections Logic ---

  getApiStorage() {
    const canShowApiTesterToast = () => (
      document.body?.id === 'api-tester-body'
      && document.getElementById('toast')
      && document.getElementById('toastMessage')
    );

    const safeParseArrayStorage = (key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        console.log(`Failed to parse ${key} from localStorage`, error);
      }

      localStorage.removeItem(key);
      if (canShowApiTesterToast()) {
        this.showToast('Saved API tester data was reset', 'error');
      }
      return [];
    };

    return {
      history: safeParseArrayStorage('dt_api_history'),
      collections: safeParseArrayStorage('dt_api_collections')
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

  saveToCollections(button) {
    const curl = document.getElementById('curlInput').value.trim();
    if (!curl) {
      this.setInlineStatus('apiRequestStatus', 'Add a cURL command first.', 'error');
      this.showToast('Enter a cURL command first', 'error');
      return;
    }
    const name = prompt('Name this request (e.g., "Prod Login"):');
    if (!name) return;

    this.setButtonBusy(button, true, 'Saving...');
    this.setInlineStatus('apiRequestStatus', 'Saving request...');

    try {
      const { collections } = this.getApiStorage();
      const newCollections = [...collections, { id: Date.now(), name, curl }];

      localStorage.setItem('dt_api_collections', JSON.stringify(newCollections));
      this.renderApiLists();
      this.setInlineStatus('apiRequestStatus', 'Request saved', 'success');
      this.showToast('Request Saved');
    } finally {
      window.setTimeout(() => this.setButtonBusy(button, false), 180);
    }
  }

  deleteCollectionItem(id) {
    const { collections } = this.getApiStorage();
    const newCollections = collections.filter(item => item.id !== id);
    localStorage.setItem('dt_api_collections', JSON.stringify(newCollections));
    this.renderApiLists();
  }

  loadCurlIntoInput(curl) {
    document.getElementById('curlInput').value = curl;
    this.updateParsedCurlPreview();
  }

  // REFACTORED: Create elements programmatically to avoid unsafe inline onclick
  renderApiLists() {
    const { history, collections } = this.getApiStorage();

    // --- Render Collections ---
    const colList = document.getElementById('collectionList');
    if (colList) {
      colList.setAttribute('aria-busy', 'false');
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
      histList.setAttribute('aria-busy', 'false');
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
  updateParsedCurlPreview() {
    const input = document.getElementById('curlInput')?.value?.trim() || '';
    const methodPreview = document.getElementById('requestMethodPreview');
    const urlPreview = document.getElementById('requestUrlPreview');

    if (!methodPreview || !urlPreview) return;

    if (!input) {
      methodPreview.textContent = '—';
      urlPreview.textContent = 'Paste a valid cURL command to preview the request.';
      urlPreview.title = '';
      return;
    }

    try {
      const { url, options } = CurlParser.parse(input);
      methodPreview.textContent = options.method || 'GET';
      urlPreview.textContent = url;
      urlPreview.title = url;
    } catch (error) {
      methodPreview.textContent = 'Invalid';
      urlPreview.textContent = error.message || 'Unable to parse cURL command.';
      urlPreview.title = '';
    }
  }

  setApiResponseState(state, { statusText = '', durationText = '', bodyText = '', headersText = '' } = {}) {
    const responseState = document.getElementById('responseState');
    const statusBadge = document.getElementById('responseStatus');
    const timeBadge = document.getElementById('responseTime');
    const responseBody = document.getElementById('responseBody');
    const responseHeaders = document.getElementById('responseHeaders');
    const normalizedState = ['idle', 'loading', 'success', 'error', 'cancelled', 'timeout'].includes(state)
      ? state
      : 'idle';

    if (responseState) {
      responseState.className = `status-pill status-pill--${normalizedState}`;
      responseState.textContent = normalizedState;
    }

    if (statusBadge) {
      if (statusText) {
        statusBadge.textContent = statusText;
      }
      const statusColors = {
        idle: 'var(--text-muted)',
        loading: 'var(--primary)',
        success: 'var(--success)',
        error: 'var(--danger)',
        cancelled: '#f59e0b',
        timeout: 'var(--danger)'
      };
      statusBadge.style.color = statusColors[normalizedState] || 'var(--text-muted)';
    }

    if (timeBadge && durationText) {
      timeBadge.textContent = durationText;
    }

    if (responseBody && bodyText) {
      responseBody.textContent = bodyText;
    }

    if (responseHeaders && headersText) {
      responseHeaders.textContent = headersText;
    }
  }

  formatResponseHeaders(headers) {
    const lines = [];
    headers.forEach((value, key) => {
      lines.push(`${key}: ${value}`);
    });
    return lines.length ? lines.join('\n') : 'No response headers.';
  }

  async executeCurl(button) {
    return this.runCurlRequest(button);
  }

  async runCurlRequest(button) {
    const input = document.getElementById('curlInput').value.trim();
    const responseBody = document.getElementById('responseBody');
    const statusBadge = document.getElementById('responseStatus');
    const timeBadge = document.getElementById('responseTime');
    const responseHeaders = document.getElementById('responseHeaders');
    const executeBtn = button || document.getElementById('executeCurl');
    const cancelBtn = document.getElementById('cancelCurl');

    if (!input) {
      this.setInlineStatus('apiRequestStatus', 'Paste a cURL command first.', 'error');
      this.showToast('Please enter a cURL command', 'error');
      return;
    }

    // Save to history first
    this.saveToHistory(input);

    const controller = new AbortController();
    let timeoutId = null;
    this.activeCurlController = controller;
    this.activeCurlTimedOut = false;

    try {
      this.setButtonBusy(executeBtn, true, 'Running...');
      this.setInlineStatus('apiRequestStatus', 'Running request...');
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.style.display = 'inline-flex';
      }

      this.setApiResponseState('loading', {
        statusText: 'Running',
        durationText: '—',
        headersText: 'Waiting for response headers...',
        bodyText: 'Loading...'
      });

      timeoutId = window.setTimeout(() => {
        this.activeCurlTimedOut = true;
        controller.abort();
      }, this.apiRequestTimeoutMs);

      const startTime = performance.now();
      const { url, options } = CurlParser.parse(input);
      options.signal = controller.signal;
      this.updateParsedCurlPreview();

      const response = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const statusText = `${response.status} ${response.statusText}`.trim();
      const contentType = response.headers.get('content-type');
      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
        responseBody.innerHTML = this.syntaxHighlightJSON(responseData);
      } else {
        responseData = await response.text();
        responseBody.textContent = responseData || '(empty response body)';
      }

      statusBadge.textContent = statusText;
      statusBadge.style.color = response.ok ? 'var(--success)' : 'var(--danger)';
      timeBadge.textContent = `${duration}ms`;
      if (responseHeaders) {
        responseHeaders.textContent = this.formatResponseHeaders(response.headers);
      }
      this.setApiResponseState(response.ok ? 'success' : 'error');
      this.setInlineStatus('apiRequestStatus', response.ok ? 'Request complete' : 'Request returned an error', response.ok ? 'success' : 'error');
    } catch (error) {
      const wasAborted = error.name === 'AbortError' || controller.signal.aborted;
      const state = wasAborted ? (this.activeCurlTimedOut ? 'timeout' : 'cancelled') : 'error';
      const message = wasAborted
        ? (this.activeCurlTimedOut ? 'Request timed out' : 'Request cancelled')
        : `Error: ${error.message}`;

      responseBody.textContent = message;
      statusBadge.textContent = wasAborted ? message : 'Error';
      statusBadge.style.color = 'var(--danger)';
      timeBadge.textContent = '—';
      if (responseHeaders) {
        responseHeaders.textContent = 'No response headers.';
      }
      this.setApiResponseState(state);
      this.setInlineStatus('apiRequestStatus', wasAborted ? message : 'Request failed', 'error');
      this.showToast(wasAborted ? message : 'Request failed', 'error');
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (this.activeCurlController === controller) {
        this.activeCurlController = null;
        this.activeCurlTimedOut = false;
      }
      this.setButtonBusy(executeBtn, false);
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.style.display = 'none';
      }
    }
  }

  cancelCurlRequest() {
    if (this.activeCurlController) {
      this.activeCurlController.abort();
    }
  }


  // JSON Formatter
  formatJSON(button) {
    const input = document.getElementById('jsonInput').value;
    const responseContainer = document.getElementById('jsonResponse');
    const outputEl = document.getElementById('jsonOutput');

    if (!input) {
      this.setInlineStatus('jsonStatus', 'Paste JSON first.', 'error');
      this.showToast('Please enter JSON to format', 'error');
      return;
    }

    this.setButtonBusy(button, true, 'Formatting...');
    this.setInlineStatus('jsonStatus', 'Formatting...');

    try {
      const parsed = JSON.parse(input);
      const highlighted = this.syntaxHighlightJSON(parsed);
      outputEl.innerHTML = highlighted;
      responseContainer.style.display = 'block';
      const emptyState = document.getElementById('jsonEmptyState');
      if (emptyState) emptyState.style.display = 'none';
      this.setInlineStatus('jsonStatus', 'Formatted', 'success');
    } catch (error) {
      outputEl.textContent = `Invalid JSON: ${error.message}`;
      responseContainer.style.display = 'block';
      const emptyState = document.getElementById('jsonEmptyState');
      if (emptyState) emptyState.style.display = 'none';
      this.setInlineStatus('jsonStatus', 'Invalid JSON', 'error');
      this.showToast('Invalid JSON', 'error');
    } finally {
      window.setTimeout(() => this.setButtonBusy(button, false), 180);
    }
  }

  // Utility Functions
  setInlineStatus(id, message, type = '') {
    const status = document.getElementById(id);
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-success', type === 'success');
    status.classList.toggle('is-error', type === 'error');
  }

  setButtonBusy(button, isBusy, busyLabel = '') {
    if (!button) return;

    if (isBusy) {
      if (!button.dataset.defaultHtml) {
        button.dataset.defaultHtml = button.innerHTML;
      }
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      if (busyLabel) {
        button.textContent = busyLabel;
      }
      return;
    }

    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    button.disabled = false;
    if (button.dataset.defaultHtml) {
      button.innerHTML = button.dataset.defaultHtml;
    }
  }

  copyToClipboard(text, { button = null, statusId = '' } = {}) {
    if (!text) return false;

    this.setButtonBusy(button, true, 'Copying...');
    if (statusId) this.setInlineStatus(statusId, 'Copying...');

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();

    try {
      const didCopy = document.execCommand('copy');
      if (!didCopy) {
        throw new Error('Clipboard command was rejected');
      }

      if (statusId) this.setInlineStatus(statusId, 'Copied', 'success');
      this.showToast('Copied to clipboard!');
      chrome.runtime.sendMessage({ type: 'SAVE_CLIPBOARD', text: text }).catch(() => {});
      return true;
    } catch (err) {
      console.log('Failed to copy', err);
      if (statusId) this.setInlineStatus(statusId, 'Copy failed', 'error');
      this.showToast('Failed to copy', 'error');
      return false;
    } finally {
      document.body.removeChild(ta);
      window.setTimeout(() => this.setButtonBusy(button, false), 180);
    }
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toastMessage');
    if (!toast || !messageEl) return;

    messageEl.textContent = message;
    toast.classList.toggle('toast--error', type === 'error');

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

window.addEventListener('beforeunload', () => {
  if (window.popupController?.authTimerInterval) {
    clearInterval(window.popupController.authTimerInterval);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.body.id;
  window.popupController = new PopupController(pageId);
});

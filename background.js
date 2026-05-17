/**
 * DevToolkit Pro - Background Service Worker
 * Handles clipboard logging with IndexedDB
 */

importScripts('generators.js');

const DB_NAME = 'ClipboardDB';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const DEFAULT_CLIPBOARD_SETTINGS = {
  captureEnabled: true,
  maxHistorySize: 100,
  retentionDays: 0,
  blockedDomains: []
};

class ClipboardManager {
  constructor() {
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  getStorageLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  async getClipboardSettings() {
    const stored = await this.getStorageLocal(['clipboardSettings']);
    return this.normalizeClipboardSettings(stored.clipboardSettings);
  }

  normalizeClipboardSettings(settings = {}) {
    const maxHistorySize = Number.parseInt(settings.maxHistorySize, 10);
    const retentionDays = Number.parseInt(settings.retentionDays, 10);
    const blockedDomains = Array.isArray(settings.blockedDomains) ? settings.blockedDomains : [];

    return {
      captureEnabled: settings.captureEnabled !== false,
      maxHistorySize: Number.isFinite(maxHistorySize) ? Math.min(Math.max(maxHistorySize, 1), 1000) : DEFAULT_CLIPBOARD_SETTINGS.maxHistorySize,
      retentionDays: Number.isFinite(retentionDays) ? Math.min(Math.max(retentionDays, 0), 3650) : DEFAULT_CLIPBOARD_SETTINGS.retentionDays,
      blockedDomains: blockedDomains.map(domain => String(domain).trim().toLowerCase()).filter(Boolean)
    };
  }

  isBlockedDomain(url, blockedDomains) {
    if (!url || !blockedDomains.length) return false;

    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      return blockedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  async saveClipboard(text, sourceUrl = '') {
    if (!this.db) await this.initDB();

    const settings = await this.getClipboardSettings();
    if (!settings.captureEnabled || this.isBlockedDomain(sourceUrl, settings.blockedDomains)) {
      return null;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return null;
    }

    const entryId = await new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const entry = {
        text: trimmedText,
        timestamp: Date.now(),
        time: new Date().toLocaleString()
      };
      
      const request = store.add(entry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await this.cleanupClipboardHistory(settings);
    return entryId;
  }

  async cleanupClipboardHistory(settings) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const now = Date.now();
        const retentionCutoff = settings.retentionDays > 0
          ? now - (settings.retentionDays * 24 * 60 * 60 * 1000)
          : 0;
        const entries = request.result.sort((a, b) => b.timestamp - a.timestamp);
        const idsToDelete = new Set();

        entries.forEach((entry, index) => {
          if (retentionCutoff && entry.timestamp < retentionCutoff) {
            idsToDelete.add(entry.id);
          }
          if (index >= settings.maxHistorySize) {
            idsToDelete.add(entry.id);
          }
        });

        idsToDelete.forEach((id) => store.delete(id));
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  notifyPopup() {
    chrome.runtime.sendMessage({ 
      type: 'NEW_COPY_SAVED' 
    }).catch(() => {
      // Popup might not be open, ignore error
    });
  }
}

const clipboardManager = new ClipboardManager();

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_CLIPBOARD') {
    clipboardManager
      .saveClipboard(message.text, message.sourceUrl)
      .then((entryId) => {
        if (entryId !== null) {
          clipboardManager.notifyPopup();
        }
        sendResponse({ success: true, saved: entryId !== null });
      })
      .catch(error => {
        console.log('Failed to save clipboard:', error); // Changed to console.log for dev
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

/**
 * ---------------------------------
 * Context Menu (Generator) Logic
 * ---------------------------------
 */

// Create the context menus on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('DevToolkit Pro: Setting up context menus...');
  
  // Create a parent menu
  chrome.contextMenus.create({
    id: "DEVTOOLKIT_PARENT",
    title: "DevToolkit: Generate Data",
    contexts: ["editable"] // Only show when right-clicking an editable field
  });

  // Add sub-menus for each generator
  chrome.contextMenus.create({
    id: "generate-name",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Persian Name",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-phone",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Phone Number",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-nationalCode",
    parentId: "DEVTOOLKIT_PARENT",
    title: "National Code",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-bankCard",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Bank Card",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-sheba",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Sheba (IBAN)",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-email",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Email",
    contexts: ["editable"]
  });

  chrome.contextMenus.create({
    id: "generate-password",
    parentId: "DEVTOOLKIT_PARENT",
    title: "Password",
    contexts: ["editable"]
  });
});

// Listen for a click on one of our context menu items
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  let generatedText = '';
  
  try {
    switch (info.menuItemId) {
      case 'generate-name':
        generatedText = DataGenerators.generateName();
        break;
      case 'generate-phone':
        generatedText = DataGenerators.generatePhoneNumber();
        break;
      case 'generate-nationalCode':
        generatedText = DataGenerators.generateNationalCode();
        break;
      case 'generate-bankCard':
        generatedText = DataGenerators.generateBankCardNumber();
        break;
      case 'generate-sheba':
        generatedText = DataGenerators.generateShebaNumber();
        break;
      case 'generate-email':
        generatedText = DataGenerators.generateEmail();
        break;
      case 'generate-password':
        generatedText = DataGenerators.generatePassword();
        break;
      default:
        return; 
    }

    // FIXED: Added frameId to target specific frames (iframes)
    if (generatedText) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'INSERT_GENERATED_TEXT',
        text: generatedText
      }, { frameId: info.frameId }).catch(err => {
        // This usually happens if the page needs a refresh
        console.log('DevToolkit: Could not insert text. Page might need refresh.', err);
      });
    }

  } catch (error) {
    console.log('DevToolkit: Context menu generation failed', error);
  }
});
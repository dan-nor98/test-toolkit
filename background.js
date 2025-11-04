/**
 * DevToolkit Pro - Background Service Worker
 * Handles clipboard logging with IndexedDB
 */

const DB_NAME = 'ClipboardDB';
const DB_VERSION = 1;
const STORE_NAME = 'logs';

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

  async saveClipboard(text) {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const entry = {
        text: text.trim(),
        timestamp: Date.now(),
        time: new Date().toLocaleString()
      };
      
      const request = store.add(entry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
      .saveClipboard(message.text)
      .then(() => {
        clipboardManager.notifyPopup();
        sendResponse({ success: true });
      })
      .catch(error => {
        console.log('Failed to save clipboard:', error); // Changed to console.log for dev
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

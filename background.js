/**
 * DevToolkit Pro - Background Service Worker
 * Handles clipboard logging with IndexedDB
 */

importScripts('generators.js');

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
  if (!tab.id) return;

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
        return; // Not one of our menus
    }

    // Send a message to the content script in the active tab
    chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_GENERATED_TEXT',
      text: generatedText
    });

  } catch (error) {
    console.log('DevToolkit: Context menu generation failed', error);
  }
});
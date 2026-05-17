/**
 * DevToolkit Pro - Content Script
 * Captures copy events and sends to background
 */

let lastCopiedText = '';
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 10000;
const DEFAULT_CLIPBOARD_SETTINGS = {
  captureEnabled: true,
  blockedDomains: []
};

function getStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function normalizeClipboardSettings(settings = {}) {
  const blockedDomains = Array.isArray(settings.blockedDomains) ? settings.blockedDomains : [];

  return {
    captureEnabled: settings.captureEnabled !== false,
    blockedDomains: blockedDomains.map(domain => String(domain).trim().toLowerCase()).filter(Boolean)
  };
}

function isCurrentDomainBlocked(blockedDomains) {
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  return blockedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

async function shouldCaptureClipboard() {
  const stored = await getStorageLocal(['clipboardSettings']);
  const settings = normalizeClipboardSettings(stored.clipboardSettings || DEFAULT_CLIPBOARD_SETTINGS);
  return settings.captureEnabled && !isCurrentDomainBlocked(settings.blockedDomains);
}

async function handleCopy(e) {
  try {
    let text = '';
    
    // Try to get selected text first
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      text = selection.toString().trim();
    }
    
    // Validate text
    if (!text || 
        text.length < MIN_TEXT_LENGTH || 
        text.length > MAX_TEXT_LENGTH ||
        text === lastCopiedText) {
      return;
    }
    
    if (!(await shouldCaptureClipboard())) {
      return;
    }

    lastCopiedText = text;
    
    // Send to background
    chrome.runtime.sendMessage({
      type: 'SAVE_CLIPBOARD',
      text: text,
      sourceUrl: window.location.href
    }).catch((error) => {
      // Log errors for development
      console.log('DevToolkit: Message send failed', error);
    });
    
  } catch (error) {
    console.log('DevToolkit: Copy handler error', error);
  }
}

// Listen for copy events
document.addEventListener('copy', handleCopy, { passive: true });

// Clean up on unload
window.addEventListener('beforeunload', () => {
  document.removeEventListener('copy', handleCopy);
  document.removeEventListener('contextmenu', handleContextMenu, true);
});


const EDITABLE_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'password',
  'email',
  'number'
]);

let lastEditableContextMenuTarget = null;
let lastEditableContextMenuPath = '';

function getElementSelectorPath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const path = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();

    if (current.id) {
      path.unshift(`${tagName}#${CSS.escape(current.id)}`);
      break;
    }

    const parent = current.parentElement;
    if (!parent) {
      path.unshift(tagName);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      sibling => sibling.tagName === current.tagName
    );
    const position = sameTagSiblings.indexOf(current) + 1;
    path.unshift(sameTagSiblings.length > 1 ? `${tagName}:nth-of-type(${position})` : tagName);
    current = parent;
  }

  return path.join(' > ');
}

function getContextMenuEditableTarget(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const candidates = path.length ? path : [event.target];

  for (const candidate of candidates) {
    if (AutofillManager.isAutofillCompatible(candidate)) {
      return candidate;
    }
  }

  return null;
}

function handleContextMenu(event) {
  const editableTarget = getContextMenuEditableTarget(event);

  if (!editableTarget) {
    lastEditableContextMenuTarget = null;
    lastEditableContextMenuPath = '';
    return;
  }

  lastEditableContextMenuTarget = editableTarget;
  lastEditableContextMenuPath = getElementSelectorPath(editableTarget);
}

document.addEventListener('contextmenu', handleContextMenu, true);

class AutofillManager {
  static insertIntoActiveElement(text) {
    try {
      const targetEl = this.getInsertionTarget();

      if (!targetEl) {
        console.log('DevToolkit: No active or context-menu element found');
        return false;
      }

      if (this.isContentEditable(targetEl)) {
        return this.insertIntoContentEditable(targetEl, text);
      }

      if (this.isTextInput(targetEl)) {
        return this.insertIntoTextInput(targetEl, text);
      }

      console.log('DevToolkit: Target element is not autofill-compatible');
      return false;
    } finally {
      this.clearLastContextMenuTarget();
    }
  }

  static getInsertionTarget() {
    if (lastEditableContextMenuTarget?.isConnected) {
      return lastEditableContextMenuTarget;
    }

    if (lastEditableContextMenuPath) {
      console.log('DevToolkit: Last context-menu target is unavailable', lastEditableContextMenuPath);
    }

    return document.activeElement;
  }

  static clearLastContextMenuTarget() {
    lastEditableContextMenuTarget = null;
    lastEditableContextMenuPath = '';
  }

  static isAutofillCompatible(element) {
    return this.isContentEditable(element) || this.isTextInput(element);
  }

  static isContentEditable(element) {
    return Boolean(element?.isContentEditable);
  }

  static isTextInput(element) {
    if (!element || (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA')) {
      return false;
    }

    if (element.tagName === 'TEXTAREA') {
      return true;
    }

    const type = (element.type || 'text').toLowerCase();
    return EDITABLE_INPUT_TYPES.has(type);
  }

  static insertIntoContentEditable(element, text) {
    element.focus();

    // execCommand is deprecated but is still the only reliable way
    // to preserve Undo/Redo history in contentEditable editors.
    return document.execCommand('insertText', false, text);
  }

  static insertIntoTextInput(element, text) {
    element.focus();

    const start = Number.isInteger(element.selectionStart)
      ? element.selectionStart
      : element.value.length;
    const end = Number.isInteger(element.selectionEnd)
      ? element.selectionEnd
      : element.value.length;

    const currentValue = element.value;
    const nextValue = currentValue.slice(0, start) + text + currentValue.slice(end);

    element.value = nextValue;
    const nextCursorPosition = start + text.length;
    element.selectionStart = nextCursorPosition;
    element.selectionEnd = nextCursorPosition;

    // Trigger controlled-input updates in frameworks (React, Vue, etc.).
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }
}

/**
 * Listen for messages from the background script
 * to insert generated text.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'INSERT_GENERATED_TEXT') {
    return true;
  }

  try {
    const success = AutofillManager.insertIntoActiveElement(message.text);
    sendResponse({ success });
  } catch (error) {
    console.error('DevToolkit: Insertion failed', error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

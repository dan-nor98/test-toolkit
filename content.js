/**
 * DevToolkit Pro - Content Script
 * Captures copy events and sends to background
 */

let lastCopiedText = '';
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 10000;

function handleCopy(e) {
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
    
    lastCopiedText = text;
    
    // Send to background
    chrome.runtime.sendMessage({
      type: 'SAVE_CLIPBOARD',
      text: text
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

class AutofillManager {
  static insertIntoActiveElement(text) {
    const activeEl = document.activeElement;

    if (!activeEl) {
      console.log('DevToolkit: No active element found');
      return false;
    }

    if (this.isContentEditable(activeEl)) {
      return this.insertIntoContentEditable(activeEl, text);
    }

    if (this.isTextInput(activeEl)) {
      return this.insertIntoTextInput(activeEl, text);
    }

    console.log('DevToolkit: Active element is not autofill-compatible');
    return false;
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

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


/**
 * Listen for messages from the background script
 * to insert generated text.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INSERT_GENERATED_TEXT') {
    const activeEl = document.activeElement;
    
    if (!activeEl) {
      console.log('DevToolkit: No active element found');
      return;
    }

    try {
      // 1. Handle ContentEditable (Rich Text, Divs, Spans)
      // This covers Gmail, Notion, and most modern web editors
      if (activeEl.isContentEditable) {
        // execCommand is deprecated but is still the only reliable way 
        // to preserve Undo/Redo history in contentEditable
        document.execCommand('insertText', false, message.text);
        sendResponse({ success: true });
        return true;
      }

      // 2. Handle Standard Inputs & Textareas
      if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const currentValue = activeEl.value;

        // Insert text at cursor position
        activeEl.value = currentValue.substring(0, start) + 
                         message.text + 
                         currentValue.substring(end);

        // Move cursor to end of inserted text
        activeEl.selectionStart = activeEl.selectionEnd = start + message.text.length;

        // Dispatch events to trigger framework updates (React, Vue, etc.)
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        sendResponse({ success: true });
        return true;
      }
      
    } catch (err) {
      console.error('DevToolkit: Insertion failed', err);
    }
  }
  return true;
});
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
    
    // Check if the active element is an input or textarea
    if (activeEl && (activeEl.tagName.toLowerCase() === 'input' || activeEl.tagName.toLowerCase() === 'textarea')) {
      
      // Set the value
      activeEl.value = message.text;
      
      // Dispatch events to notify frameworks (like React) of the change
      activeEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      activeEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      
      sendResponse({ success: true });
    } else {
      console.log('DevToolkit: No editable element focused to insert text.');
      sendResponse({ success: false, error: 'No active editable element' });
    }
  }
  
  // Return true to indicate async response (though we don't use it here, it's good practice)
  return true; 
});
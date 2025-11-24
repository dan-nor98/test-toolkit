/**
 * DevToolkit Pro - Content Script
 * Captures copy events and sends to background
 */

let lastCopiedText = '';
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 10000;
const FIELD_PATTERNS = {
  email: /email|mail|e-mail/i,
  name: /name|fullname|user|first.*name|last.*name/i,
  phone: /phone|mobile|cell|tel/i,
  nationalCode: /national.*code|id.*number|ssn|nid/i,
  bankCard: /card|debit|credit|pan|bank/i,
  sheba: /sheba|iban/i,
  password: /password|pass|pwd/i
};

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


// --- 2. UI MANAGEMENT ---

let activeIcon = null;
let currentInput = null;

function createAutofillIcon() {
  if (activeIcon) return activeIcon;

  const btn = document.createElement('div');
  btn.className = 'dt-autofill-btn';
  btn.innerHTML = `
    <svg class="dt-autofill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  `;
  
  // Use mousedown to prevent input blur before click registers
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Stop focus loss
    handleIconClick();
  });

  document.body.appendChild(btn);
  activeIcon = btn;
  return btn;
}

function positionIcon(input) {
  const btn = createAutofillIcon();
  const rect = input.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  // Position inside the right edge of the input
  btn.style.top = `${rect.top + scrollY + (rect.height - 24) / 2}px`;
  btn.style.left = `${rect.right + scrollX - 30}px`;
  
  btn.classList.add('visible');
  currentInput = input;
}

function hideIcon() {
  if (activeIcon) {
    activeIcon.classList.remove('visible');
    currentInput = null;
  }
}

// --- 3. LOGIC ---

/**
 * Detects the type of input based on attributes
 */
function detectFieldType(input) {
  // Check explicit type first
  if (input.type === 'email') return 'email';
  if (input.type === 'password') return 'password';
  if (input.type === 'tel') return 'phone';

  // Check attributes (id, name, placeholder, class)
  const attributes = [
    input.id, 
    input.name, 
    input.placeholder, 
    input.className
  ].join(' ');

  for (const [type, regex] of Object.entries(FIELD_PATTERNS)) {
    if (regex.test(attributes)) return type;
  }

  return null;
}

/**
 * Generates data and inserts it
 */
function handleIconClick() {
  if (!currentInput) return;

  const type = detectFieldType(currentInput);
  let value = '';

  try {
    // Uses the globally available DataGenerators class (injected via manifest)
    switch (type) {
      case 'email': value = DataGenerators.generateEmail(); break;
      case 'phone': value = DataGenerators.generatePhoneNumber(); break;
      case 'nationalCode': value = DataGenerators.generateNationalCode(); break;
      case 'bankCard': value = DataGenerators.generateBankCardNumber(); break;
      case 'sheba': value = DataGenerators.generateShebaNumber(); break;
      case 'password': value = DataGenerators.generatePassword(); break;
      case 'name': value = DataGenerators.generateName(); break;
      default: 
        // Fallback: Random Name or just tell user?
        // Let's generate a name as default if we aren't sure, 
        // or you could open a mini-menu here.
        value = DataGenerators.generateName(); 
    }

    insertText(currentInput, value);
    
    // Visual feedback
    const originalColor = activeIcon.style.backgroundColor;
    activeIcon.style.backgroundColor = '#10b981'; // Green
    setTimeout(() => {
      activeIcon.style.backgroundColor = '';
      hideIcon();
    }, 500);

  } catch (err) {
    console.error('Generation failed', err);
  }
}

/**
 * Helper to safely insert text into different input types
 */
function insertText(target, text) {
  if (target.isContentEditable) {
    target.focus();
    document.execCommand('insertText', false, text);
  } else {
    // Standard inputs
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const current = target.value;
    
    target.value = current.substring(0, start) + text + current.substring(end);
    target.selectionStart = target.selectionEnd = start + text.length;
    
    // Trigger events for React/Angular/Vue
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// --- 4. EVENT LISTENERS ---

document.addEventListener('focusin', (e) => {
  const target = e.target;
  
  // Only handle inputs and textareas
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
  
  // Ignore hidden inputs, checkboxes, radios, read-only
  if (target.type === 'hidden' || 
      target.type === 'checkbox' || 
      target.type === 'radio' ||
      target.readOnly) return;

  const type = detectFieldType(target);
  
  // Only show icon if we detected a known type
  if (type) {
    positionIcon(target);
  } else {
    // Optional: You could show it for ALL inputs if you want a default 'Name' gen
    // positionIcon(target); 
    hideIcon();
  }
}, true); // Capture phase to catch all focus events

document.addEventListener('focusout', (e) => {
  // Small delay to allow clicking the icon before it disappears
  setTimeout(() => {
    // If the new focus is NOT our button, hide it
    if (document.activeElement !== activeIcon) {
      hideIcon();
    }
  }, 100);
});

// Update position on scroll/resize
window.addEventListener('scroll', hideIcon, { passive: true });
window.addEventListener('resize', hideIcon, { passive: true });

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
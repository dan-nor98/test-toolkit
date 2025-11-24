/**
 * DevToolkit Pro - Content Script
 * Fixed: Icon disappearing too fast (Race Condition)
 */

// ==========================================
// 1. CLIPBOARD LOGGING
// ==========================================

let lastCopiedText = '';
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 10000;

function handleCopy(e) {
  try {
    let text = '';
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      text = selection.toString().trim();
    }
    
    if (!text || text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH || text === lastCopiedText) {
      return;
    }
    
    lastCopiedText = text;
    chrome.runtime.sendMessage({ type: 'SAVE_CLIPBOARD', text: text }).catch(() => {});
  } catch (error) {
    console.log('DevToolkit: Copy handler error', error);
  }
}

// ==========================================
// 2. CONFIGURATION & HEURISTICS
// ==========================================

const FIELD_PATTERNS = {
  email: /email|mail|e-mail/i,
  name: /name|fullname|user|first.*name|last.*name/i,
  phone: /phone|mobile|cell|tel/i,
  nationalCode: /national.*code|id.*number|ssn|nid/i,
  bankCard: /card|debit|credit|pan|bank/i,
  sheba: /sheba|iban/i,
  password: /password|pass|pwd/i
};

// ==========================================
// 3. UI MANAGEMENT (Floating Icon)
// ==========================================

let activeIcon = null;
let currentInput = null;
let hideTimeout = null; // NEW: Track the timer so we can cancel it

function createAutofillIcon() {
  if (activeIcon) return activeIcon;

  const btn = document.createElement('div');
  btn.className = 'dt-autofill-btn';
  btn.innerHTML = `
    <svg class="dt-autofill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  `;
  
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); 
    handleIconClick();
  });

  document.body.appendChild(btn);
  activeIcon = btn;
  return btn;
}

function positionIcon(input) {
  // NEW: Cancel any pending hide action immediately
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  const btn = createAutofillIcon();
  const rect = input.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

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

// ==========================================
// 4. GENERATION LOGIC
// ==========================================

function generateValueByType(type) {
  try {
    switch (type) {
      case 'email': return DataGenerators.generateEmail();
      case 'phone': return DataGenerators.generatePhoneNumber();
      case 'nationalCode': return DataGenerators.generateNationalCode();
      case 'bankCard': return DataGenerators.generateBankCardNumber();
      case 'sheba': return DataGenerators.generateShebaNumber();
      case 'password': return DataGenerators.generatePassword();
      case 'name': return DataGenerators.generateName();
      default: return null;
    }
  } catch (e) {
    console.error('Generator error:', e);
    return null;
  }
}

function detectFieldType(input) {
  if (input.type === 'email') return 'email';
  if (input.type === 'password') return 'password';
  if (input.type === 'tel') return 'phone';

  const attributes = [
    input.id, 
    input.name, 
    input.placeholder, 
    input.className,
    input.getAttribute('aria-label')
  ].join(' ');

  for (const [type, regex] of Object.entries(FIELD_PATTERNS)) {
    if (regex.test(attributes)) return type;
  }
  return null;
}

function handleIconClick() {
  if (!currentInput) return;
  const type = detectFieldType(currentInput);
  const value = generateValueByType(type || 'name'); 

  if (value) {
    insertText(currentInput, value);
    flashInput(currentInput);
    hideIcon();
  }
}

function handleSmartFill() {
  const active = document.activeElement;
  if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
    console.log('DevToolkit: Focus an input to use Smart Fill');
    return;
  }

  const form = active.form || active.closest('form');

  if (form) {
    const inputs = form.querySelectorAll('input, textarea');
    let fillCount = 0;

    inputs.forEach(input => {
      if (input.type === 'hidden' || input.type === 'submit' || input.disabled || input.readOnly) return;
      if (input.value && input.value.trim() !== '') return;

      const type = detectFieldType(input);
      if (type) {
        const value = generateValueByType(type);
        if (value) {
          insertText(input, value);
          flashInput(input);
          fillCount++;
        }
      }
    });
    
    if (fillCount === 0) {
      const type = detectFieldType(active) || 'name';
      const val = generateValueByType(type);
      if (val) {
        insertText(active, val);
        flashInput(active);
      }
    }
  } else {
    const type = detectFieldType(active);
    const value = generateValueByType(type || 'name');
    if (value) {
      insertText(active, value);
      flashInput(active);
    }
  }
}

// ==========================================
// 5. DOM HELPERS
// ==========================================

function insertText(target, text) {
  if (target.isContentEditable) {
    target.focus();
    document.execCommand('insertText', false, text);
  } else {
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const current = target.value;
    target.value = current.substring(0, start) + text + current.substring(end);
    target.selectionStart = target.selectionEnd = start + text.length;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function flashInput(element) {
  element.style.transition = 'box-shadow 0.2s, background-color 0.2s';
  const originalBoxShadow = element.style.boxShadow;
  const originalBg = element.style.backgroundColor;
  element.style.boxShadow = '0 0 0 2px #10b981';
  element.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
  setTimeout(() => {
    element.style.boxShadow = originalBoxShadow;
    element.style.backgroundColor = originalBg;
  }, 500);
}

// ==========================================
// 6. EVENT LISTENERS
// ==========================================

document.addEventListener('copy', handleCopy, { passive: true });

document.addEventListener('focusin', (e) => {
  const target = e.target;
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
  if (target.type === 'hidden' || target.type === 'checkbox' || target.type === 'radio' || target.readOnly) return;

  const type = detectFieldType(target);
  if (type) {
    positionIcon(target);
  } else {
    hideIcon();
  }
}, true);

document.addEventListener('focusout', (e) => {
  // NEW: Save the timeout ID so we can cancel it if needed
  hideTimeout = setTimeout(() => {
    if (document.activeElement !== activeIcon) {
      hideIcon();
    }
  }, 200); // Increased slightly to 200ms for better UX
});

window.addEventListener('scroll', hideIcon, { passive: true });
window.addEventListener('resize', hideIcon, { passive: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INSERT_GENERATED_TEXT') {
    const activeEl = document.activeElement;
    if (activeEl) {
      insertText(activeEl, message.text);
      sendResponse({ success: true });
    }
  } 
  else if (message.type === 'TRIGGER_SMART_FILL') {
    handleSmartFill();
    sendResponse({ success: true });
  }
  return true;
});

window.addEventListener('beforeunload', () => {
  document.removeEventListener('copy', handleCopy);
});
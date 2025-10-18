document.addEventListener('DOMContentLoaded', function() {
  
  // Helper function to copy text and show feedback
  function copyToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(() => {
      // Show success feedback
      const originalText = buttonElement.textContent;
      buttonElement.textContent = '✓ کپی شد!';
      buttonElement.style.backgroundColor = '#10b981';
      
      // Reset button after 1.5 seconds
      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.backgroundColor = '#667eea';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      buttonElement.textContent = '❌ خطا!';
      buttonElement.style.backgroundColor = '#ef4444';
      
      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.backgroundColor = '#667eea';
      }, 1500);
    });
  }

  // Phone Number
  document.getElementById('generatePhone').addEventListener('click', function() {
    const result = generatePhoneNumber();
    document.getElementById('phoneResult').value = result;
    copyToClipboard(result, this);
  });

  // Name
  document.getElementById('generateName').addEventListener('click', function() {
    const result = generateName();
    document.getElementById('nameResult').value = result;
    copyToClipboard(result, this);
  });

  // National Code
  document.getElementById('generateNationalCode').addEventListener('click', function() {
    const result = generateNationalCode();
    document.getElementById('nationalCodeResult').value = result;
    copyToClipboard(result, this);
  });

  // Bank Card
  document.getElementById('generateBankCard').addEventListener('click', function() {
    const result = generateBankCardNumber();
    document.getElementById('bankCardResult').value = result;
    copyToClipboard(result, this);
  });

  // Sheba
  document.getElementById('generateSheba').addEventListener('click', function() {
    const result = generateShebaNumber();
    document.getElementById('shebaResult').value = result;
    copyToClipboard(result, this);
  });
});

// Add click-to-copy for input fields
document.querySelectorAll('.result-input').forEach(input => {
  input.addEventListener('click', function() {
    if (this.value) {
      this.select();
      navigator.clipboard.writeText(this.value).then(() => {
        this.style.backgroundColor = '#d1fae5';
        setTimeout(() => {
          this.style.backgroundColor = '#f9f9f9';
        }, 1000);
      });
    }
  });
});


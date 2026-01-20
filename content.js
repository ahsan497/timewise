// ========================================
// TimeWise Content Script
// Shows floating note indicator on pages
// ========================================

let noteIndicator = null;
let currentDomain = null;
let currentUrl = null;
let noteScope = 'domain';
let outsideClickHandler = null;
let isExtensionValid = true;
let observer = null;

// ===== UTILITY FUNCTIONS =====

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getNoteKey() {
  return noteScope === 'domain' ? currentDomain : currentUrl;
}

// Check if extension context is still valid
function checkExtensionContext() {
  if (!isExtensionValid) return false;
  
  try {
    // Check if chrome.runtime exists and has an id
    if (!chrome.runtime?.id) {
      isExtensionValid = false;
      cleanup();
      return false;
    }
    return true;
  } catch (error) {
    // Any error here means extension context is invalid
    isExtensionValid = false;
    cleanup();
    return false;
  }
}

// Centralized cleanup function
function cleanup() {
  // Only log once
  if (isExtensionValid) {
    console.log('TimeWise: Extension context invalidated, cleaning up...');
  }
  
  // Remove UI elements
  removeNoteIndicator();
  
  // Disconnect observer
  if (observer) {
    try {
      observer.disconnect();
    } catch (e) {
      // Silently fail if already disconnected
    }
    observer = null;
  }
  
  // Mark as invalid
  isExtensionValid = false;
}

// ===== NOTE INDICATOR UI =====

function createNoteIndicator() {
  if (noteIndicator) return;
  
  noteIndicator = document.createElement('div');
  noteIndicator.id = 'timewise-note-indicator';
  noteIndicator.innerHTML = `
    <style>
      #timewise-note-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #5a67d8;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(90, 103, 216, 0.4);
        z-index: 999999;
        transition: all 0.3s ease;
        font-size: 24px;
      }
      
      #timewise-note-indicator:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(90, 103, 216, 0.5);
      }
      
      #timewise-note-popup {
        display: none;
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        padding: 16px;
        z-index: 1000000;
        animation: slideUp 0.3s ease;
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      #timewise-note-popup.show {
        display: block;
      }
      
      .timewise-note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .timewise-note-title {
        font-size: 14px;
        font-weight: 600;
        color: #2c3e50;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .timewise-close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 0;
        line-height: 1;
      }
      
      .timewise-note-content {
        font-size: 13px;
        line-height: 1.6;
        color: #555;
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .timewise-note-content:empty::before {
        content: 'No note for this page';
        color: #999;
        font-style: italic;
      }
    </style>
    <div id="timewise-indicator-icon">📝</div>
    <div id="timewise-note-popup">
      <div class="timewise-note-header">
        <div class="timewise-note-title">Note for this page</div>
        <button class="timewise-close-btn">×</button>
      </div>
      <div class="timewise-note-content" id="timewise-note-text"></div>
    </div>
  `;
  
  document.body.appendChild(noteIndicator);
  
  // Event listeners
  const icon = noteIndicator.querySelector('#timewise-indicator-icon');
  const popup = noteIndicator.querySelector('#timewise-note-popup');
  const closeBtn = noteIndicator.querySelector('.timewise-close-btn');
  
  icon.addEventListener('click', () => {
    popup.classList.toggle('show');
  });
  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.remove('show');
  });
  
  // Close popup when clicking outside - with proper cleanup
  outsideClickHandler = (e) => {
    // Check if noteIndicator still exists before accessing it
    if (noteIndicator && !noteIndicator.contains(e.target)) {
      popup.classList.remove('show');
    }
  };
  
  document.addEventListener('click', outsideClickHandler);
}

function removeNoteIndicator() {
  if (noteIndicator) {
    try {
      noteIndicator.remove();
    } catch (e) {
      // Silently handle if element is already removed
    }
    noteIndicator = null;
  }
  
  // Clean up the outside click handler
  if (outsideClickHandler) {
    try {
      document.removeEventListener('click', outsideClickHandler);
    } catch (e) {
      // Silently handle cleanup errors
    }
    outsideClickHandler = null;
  }
}

function updateNoteDisplay(notes) {
  if (!noteIndicator) return;
  
  const noteTextElement = noteIndicator.querySelector('#timewise-note-text');
  if (!noteTextElement) return;
  
  // Handle both old format (single note object) and new format (array of notes)
  if (!notes || (Array.isArray(notes) && notes.length === 0)) {
    noteTextElement.textContent = '';
    return;
  }
  
  // If it's an array, show the most recent note
  if (Array.isArray(notes)) {
    const sortedNotes = [...notes].sort((a, b) => b.timestamp - a.timestamp);
    const recentNote = sortedNotes[0];
    
    // Show count if multiple notes
    if (notes.length > 1) {
      noteTextElement.textContent = `${recentNote.text}\n\n(${notes.length - 1} more note${notes.length > 2 ? 's' : ''} - open popup to view all)`;
    } else {
      noteTextElement.textContent = recentNote.text;
    }
  } else {
    // Old format fallback
    noteTextElement.textContent = notes.text || '';
  }
}

// ===== CHECK FOR NOTES =====

async function checkForNote() {
  // Check if extension context is valid before proceeding
  if (!checkExtensionContext()) {
    return;
  }
  
  try {
    currentDomain = getDomain(window.location.href);
    currentUrl = window.location.href;
    
    if (!currentDomain) return;
    
    // Wrap storage call in try-catch for extension context errors
    let notes = {};
    let settings = {};
    
    try {
      const result = await chrome.storage.local.get(['notes', 'settings']);
      notes = result.notes || {};
      settings = result.settings || {};
    } catch (storageError) {
      // Storage access failed - extension context likely invalidated
      const errorMsg = storageError?.message || '';
      if (errorMsg.includes('Extension context invalidated') ||
          errorMsg.includes('message port closed') ||
          errorMsg.includes('receiving end does not exist')) {
        cleanup();
        return;
      }
      throw storageError;
    }
    
    noteScope = settings.noteScope || 'domain';
    const noteKey = getNoteKey();
    
    // Check if indicator is hidden for this site
    const hiddenIndicators = settings.hiddenIndicators || [];
    const isHidden = hiddenIndicators.some(item => 
      (noteScope === 'domain' && item === currentDomain) ||
      (noteScope === 'url' && item === currentUrl)
    );
    
    if (notes[noteKey] && notes[noteKey].length > 0 && !isHidden) {
      createNoteIndicator();
      updateNoteDisplay(notes[noteKey]);
    } else {
      removeNoteIndicator();
    }
    
  } catch (error) {
    // Check if error is due to invalid extension context
    const errorMsg = error?.message || '';
    if (errorMsg.includes('Extension context invalidated') ||
        errorMsg.includes('message port closed') ||
        errorMsg.includes('runtime.lastError') ||
        errorMsg.includes('receiving end does not exist')) {
      // Silent cleanup - this is expected when extension reloads
      cleanup();
    } else {
      // Only log unexpected errors
      console.error('TimeWise: Unexpected error checking for note:', error);
    }
  }
}

// ===== MESSAGE LISTENER =====

// Wrap message listener to handle extension context errors
function setupMessageListener() {
  if (!checkExtensionContext()) {
    return;
  }
  
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Check extension context before handling messages
      if (!checkExtensionContext()) {
        return false;
      }
      
      try {
        if (request.action === 'noteUpdated') {
          if (request.hasNote) {
            checkForNote();
          } else {
            removeNoteIndicator();
          }
        }
      } catch (error) {
        cleanup();
      }
      
      return true;
    });
  } catch (error) {
    // Extension context already invalid
    cleanup();
  }
}

// ===== INITIALIZATION =====

function initialize() {
  if (!checkExtensionContext()) {
    return;
  }
  
  // Setup message listener
  setupMessageListener();
  
  // Check for notes on page load
  checkForNote();
  
  // Re-check on URL changes (for SPAs) - with extension context validation
  let lastUrl = location.href;

  try {
    observer = new MutationObserver(() => {
      // Stop observing if extension context is invalid
      if (!checkExtensionContext()) {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        return;
      }
      
      try {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          checkForNote();
        }
      } catch (error) {
        // Handle any errors during observation
        cleanup();
      }
    });

    observer.observe(document, { subtree: true, childList: true });
  } catch (error) {
    // Observer creation failed - extension context likely invalid
    cleanup();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  cleanup();
});
// ========================================
// TimeWise Content Script
// Shows floating note indicator on pages
// ========================================

let noteIndicator = null;
let currentDomain = null;
let currentUrl = null;
let noteScope = 'domain';
let outsideClickHandler = null;

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
    noteIndicator.remove();
    noteIndicator = null;
  }
  
  // Clean up the outside click handler
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

function updateNoteDisplay(notes) {
  if (!noteIndicator) return;
  
  const noteTextElement = noteIndicator.querySelector('#timewise-note-text');
  
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
  try {
    currentDomain = getDomain(window.location.href);
    currentUrl = window.location.href;
    
    if (!currentDomain) return;
    
    const { notes = {}, settings = {} } = await chrome.storage.local.get(['notes', 'settings']);
    
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
    console.error('TimeWise: Error checking for note:', error);
  }
}

// ===== MESSAGE LISTENER =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'noteUpdated') {
    if (request.hasNote) {
      checkForNote();
    } else {
      removeNoteIndicator();
    }
  }
  return true;
});

// ===== INITIALIZATION =====

// Check for notes on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForNote);
} else {
  checkForNote();
}

// Re-check on URL changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    checkForNote();
  }
}).observe(document, { subtree: true, childList: true });
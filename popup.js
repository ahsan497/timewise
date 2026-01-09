// ========================================
// TimeWise Popup UI Logic - ENHANCED WITH MULTIPLE NOTES
// ========================================

let currentDomain = null;
let currentUrl = null;
let currentNoteScope = 'domain';
let timerInterval = null;
let currentSessionSeconds = 0;
let isCurrentSiteTracked = true; // Track if current site is being tracked

// ===== UTILITY FUNCTIONS =====

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatLastVisit(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return 'Earlier';
}

function formatNoteTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getNoteKey() {
  return currentNoteScope === 'domain' ? currentDomain : currentUrl;
}

// ===== DISPLAY FUNCTIONS =====

async function displayRecentActivity() {
  const timeList = document.getElementById('timeList');
  
  try {
    const { lastVisits = [], timeData = {} } = await chrome.storage.local.get(['lastVisits', 'timeData']);
    const today = getTodayKey();
    
    // Update lastVisits with latest time data and add real-time tracking
    const updatedVisits = lastVisits.map(visit => {
      const domainTimeData = timeData[visit.domain] || {};
      let todaySeconds = domainTimeData[today] || 0;
      
      // Add current session time if this is the active domain AND being tracked
      if (visit.domain === currentDomain && currentSessionSeconds > 0 && isCurrentSiteTracked) {
        todaySeconds += currentSessionSeconds;
      }
      
      return {
        ...visit,
        todaySeconds,
        isActive: visit.domain === currentDomain && isCurrentSiteTracked
      };
    }).filter(visit => visit.todaySeconds > 0);
    
    if (updatedVisits.length === 0) {
      timeList.innerHTML = '<div class="empty-state">No activity tracked today</div>';
      return;
    }
    
    // Sort by most recent visit
    updatedVisits.sort((a, b) => b.lastVisit - a.lastVisit);
    
    timeList.innerHTML = updatedVisits
      .slice(0, 10)
      .map(item => `
        <div class="time-item">
          <div class="time-item-left">
            <div class="domain" title="${item.domain}">${item.domain}</div>
            <div class="last-visit">${formatLastVisit(item.lastVisit)}</div>
          </div>
          <div class="time ${item.isActive ? 'active' : ''}">${formatTime(item.todaySeconds)}</div>
        </div>
      `)
      .join('');
      
  } catch (error) {
    console.error('Error displaying stats:', error);
    timeList.innerHTML = '<div class="empty-state">Error loading data</div>';
  }
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadCurrentSiteInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      document.getElementById('currentSite').textContent = 'No active site';
      document.getElementById('notesSectionTitle').textContent = 'Notes';
      isCurrentSiteTracked = false;
      return;
    }
    
    currentDomain = getDomain(tab.url);
    currentUrl = tab.url;
    
    // Check if this is a valid trackable domain
    if (!currentDomain || 
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      document.getElementById('currentSite').textContent = 'Cannot track this page';
      document.getElementById('notesSectionTitle').textContent = 'Notes';
      document.getElementById('saveNoteBtn').disabled = true;
      document.getElementById('noteInput').disabled = true;
      document.getElementById('trackingControls').style.display = 'none';
      document.getElementById('indicatorToggle').disabled = true;
      isCurrentSiteTracked = false;
      return;
    }
    
    // Check if site is in no-track list
    const { settings = {} } = await chrome.storage.local.get('settings');
    const noTrackList = settings.noTrackList || [];
    const isNoTrack = noTrackList.some(item => 
      currentDomain === item || currentUrl.includes(item)
    );
    
    // Set tracking status
    isCurrentSiteTracked = !isNoTrack;
    
    // Update notes section title based on scope
    const scopeText = settings.noteScope === 'url' ? 'URL' : 'Site';
    document.getElementById('notesSectionTitle').textContent = `Add Note to This ${scopeText}`;
    
    document.getElementById('currentSite').textContent = `📍 ${currentDomain}`;
    document.getElementById('saveNoteBtn').disabled = false;
    document.getElementById('noteInput').disabled = false;
    document.getElementById('indicatorToggle').disabled = false;
    document.getElementById('trackingControls').style.display = 'flex';
    
    // Show appropriate tracking buttons
    if (isNoTrack) {
      document.getElementById('trackBtn').style.display = 'block';
      document.getElementById('untrackBtn').style.display = 'none';
      document.getElementById('currentSite').textContent = `📍 ${currentDomain} ⏸️ Not Tracking`;
      document.getElementById('currentSite').style.color = '#ef4444';
    } else {
      document.getElementById('trackBtn').style.display = 'none';
      document.getElementById('untrackBtn').style.display = 'block';
      document.getElementById('currentSite').style.color = '#666';
    }
    
    // Check if there's data for today to show delete button
    const { timeData = {} } = await chrome.storage.local.get('timeData');
    const today = getTodayKey();
    const hasDataToday = timeData[currentDomain] && timeData[currentDomain][today];
    
    if (hasDataToday) {
      document.getElementById('deleteTodayBtn').style.display = 'block';
    } else {
      document.getElementById('deleteTodayBtn').style.display = 'none';
    }
    
    // Load existing notes
    await loadNotes();
    
    // Load indicator visibility state
    await loadIndicatorState();
    
  } catch (error) {
    console.error('Error loading current site:', error);
  }
}

async function loadNotes() {
  try {
    const { notes = {} } = await chrome.storage.local.get('notes');
    const noteKey = getNoteKey();
    
    const notesHistory = document.getElementById('notesHistory');
    const noteInput = document.getElementById('noteInput');
    
    // Clear input for fresh note
    noteInput.value = '';
    
    // Get notes for this key
    const siteNotes = notes[noteKey] || [];
    
    if (siteNotes.length === 0) {
      notesHistory.innerHTML = '<div class="notes-empty">No notes yet for this site</div>';
      return;
    }
    
    // Sort by most recent first
    siteNotes.sort((a, b) => b.timestamp - a.timestamp);
    
    notesHistory.innerHTML = `
      <div class="note-count">${siteNotes.length} note${siteNotes.length > 1 ? 's' : ''}</div>
      ${siteNotes.map((note, index) => `
        <div class="note-item" data-note-id="${note.id}">
          <div class="note-header">
            <div class="note-timestamp">${formatNoteTimestamp(note.timestamp)}</div>
            <div class="note-actions">
              <button class="note-action-btn edit-note" data-note-id="${note.id}" title="Edit">✏️</button>
              <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="note-text">${escapeHtml(note.text)}</div>
        </div>
      `).join('')}
    `;
    
    // Add event listeners for edit and delete
    notesHistory.querySelectorAll('.edit-note').forEach(btn => {
      btn.addEventListener('click', () => editNote(btn.dataset.noteId));
    });
    
    notesHistory.querySelectorAll('.delete-note').forEach(btn => {
      btn.addEventListener('click', () => deleteNote(btn.dataset.noteId));
    });
    
  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function saveNote() {
  const noteInput = document.getElementById('noteInput');
  const noteText = noteInput.value.trim();
  
  if (!noteText) {
    alert('Please enter a note');
    return;
  }
  
  const noteKey = getNoteKey();
  
  try {
    const { notes = {} } = await chrome.storage.local.get('notes');
    
    // Initialize array for this key if doesn't exist
    if (!notes[noteKey]) {
      notes[noteKey] = [];
    }
    
    // Add new note
    const newNote = {
      id: Date.now().toString(),
      text: noteText,
      timestamp: Date.now(),
      scope: currentNoteScope
    };
    
    notes[noteKey].unshift(newNote); // Add to beginning
    
    await chrome.storage.local.set({ notes });
    
    // Clear input
    noteInput.value = '';
    
    // Show success message
    const savedMsg = document.getElementById('noteSaved');
    savedMsg.style.display = 'block';
    setTimeout(() => {
      savedMsg.style.display = 'none';
    }, 2000);
    
    // Reload notes display
    await loadNotes();
    
    // Notify content script to update indicator
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'noteUpdated',
        hasNote: true
      }).catch(() => {
        // Content script might not be ready, ignore error
      });
    }
    
  } catch (error) {
    console.error('Error saving note:', error);
    alert('Failed to save note');
  }
}

async function editNote(noteId) {
  const noteKey = getNoteKey();
  
  try {
    const { notes = {} } = await chrome.storage.local.get('notes');
    const siteNotes = notes[noteKey] || [];
    
    const note = siteNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const newText = prompt('Edit note:', note.text);
    if (newText === null) return; // Cancelled
    
    if (newText.trim()) {
      note.text = newText.trim();
      note.timestamp = Date.now(); // Update timestamp
      await chrome.storage.local.set({ notes });
      await loadNotes();
      
      // Update content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'noteUpdated',
          hasNote: true
        }).catch(() => {});
      }
    } else {
      alert('Note cannot be empty');
    }
    
  } catch (error) {
    console.error('Error editing note:', error);
    alert('Failed to edit note');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Delete this note?')) return;
  
  const noteKey = getNoteKey();
  
  try {
    const { notes = {} } = await chrome.storage.local.get('notes');
    const siteNotes = notes[noteKey] || [];
    
    // Remove note with this ID
    notes[noteKey] = siteNotes.filter(n => n.id !== noteId);
    
    // If no notes left, remove the key
    if (notes[noteKey].length === 0) {
      delete notes[noteKey];
    }
    
    await chrome.storage.local.set({ notes });
    await loadNotes();
    
    // Update content script indicator
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'noteUpdated',
        hasNote: notes[noteKey] && notes[noteKey].length > 0
      }).catch(() => {});
    }
    
  } catch (error) {
    console.error('Error deleting note:', error);
    alert('Failed to delete note');
  }
}

async function loadSettings() {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    const remindersToggle = document.getElementById('remindersToggle');
    remindersToggle.checked = settings.remindersEnabled !== false;
    
    // Set initial note scope
    currentNoteScope = settings.noteScope || 'domain';
    updateNoteScopeButtons();
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings(updates) {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const newSettings = { ...settings, ...updates };
    await chrome.storage.local.set({ settings: newSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function updateNoteScopeButtons() {
  document.querySelectorAll('.scope-btn').forEach(btn => {
    if (btn.dataset.scope === currentNoteScope) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ===== INDICATOR VISIBILITY CONTROL =====

async function loadIndicatorState() {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const hiddenIndicators = settings.hiddenIndicators || [];
    const noteKey = getNoteKey();
    
    const isHidden = hiddenIndicators.includes(noteKey);
    document.getElementById('indicatorToggle').checked = !isHidden;
    
  } catch (error) {
    console.error('Error loading indicator state:', error);
  }
}

async function toggleIndicator(show) {
  const noteKey = getNoteKey();
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (!settings.hiddenIndicators) {
      settings.hiddenIndicators = [];
    }
    
    if (show) {
      // Remove from hidden list
      settings.hiddenIndicators = settings.hiddenIndicators.filter(item => item !== noteKey);
    } else {
      // Add to hidden list
      if (!settings.hiddenIndicators.includes(noteKey)) {
        settings.hiddenIndicators.push(noteKey);
      }
    }
    
    await chrome.storage.local.set({ settings });
    
    // Update content script to show/hide indicator
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'noteUpdated',
        hasNote: true
      }).catch(() => {});
    }
    
  } catch (error) {
    console.error('Error toggling indicator:', error);
  }
}

// ===== REAL-TIME TIMER =====

async function startRealtimeTimer() {
  // Get current session info from background
  chrome.runtime.sendMessage({ action: 'getCurrentSession' }, (response) => {
    if (response && response.isActive && response.domain === currentDomain && isCurrentSiteTracked) {
      // Calculate how many seconds have elapsed since session start
      if (response.startTime) {
        currentSessionSeconds = Math.floor((Date.now() - response.startTime) / 1000);
      }
    } else {
      currentSessionSeconds = 0;
    }
  });
  
  // Clear existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Update display every second
  timerInterval = setInterval(() => {
    // Only increment if site is being tracked
    if (isCurrentSiteTracked && currentSessionSeconds >= 0) {
      currentSessionSeconds++;
    }
    displayRecentActivity();
  }, 1000);
}

function stopRealtimeTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ===== TRACKING CONTROLS =====

async function startTracking() {
  if (!currentDomain) return;
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const noTrackList = settings.noTrackList || [];
    
    // Remove from no-track list
    settings.noTrackList = noTrackList.filter(item => 
      item !== currentDomain && !currentUrl.includes(item)
    );
    
    await chrome.storage.local.set({ settings });
    
    // Update tracking status and reload UI
    isCurrentSiteTracked = true;
    currentSessionSeconds = 0; // Reset to start fresh tracking
    await loadCurrentSiteInfo();
    
    // Show success message
    const msg = document.createElement('div');
    msg.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #10b981; color: white; padding: 12px 16px; border-radius: 6px; font-size: 13px; z-index: 9999;';
    msg.textContent = '✓ Tracking started for ' + currentDomain;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
    
  } catch (error) {
    console.error('Error starting tracking:', error);
    alert('Failed to start tracking');
  }
}

async function stopTracking() {
  if (!currentDomain) return;
  
  if (!confirm(`Stop tracking ${currentDomain}?\n\nThis will:\n• Stop recording time immediately\n• Add to no-track list\n• Keep existing data`)) {
    return;
  }
  
  try {
    // CRITICAL: Capture exact current session time BEFORE making changes
    const exactTimeWhenStopped = currentSessionSeconds;
    
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (!settings.noTrackList) {
      settings.noTrackList = [];
    }
    
    if (!settings.noTrackList.includes(currentDomain)) {
      settings.noTrackList.push(currentDomain);
    }
    
    await chrome.storage.local.set({ settings });
    
    // Update tracking status
    isCurrentSiteTracked = false;
    
    // Set timer to exact captured value (prevent any drift)
    currentSessionSeconds = exactTimeWhenStopped;
    
    // Reload UI
    await loadCurrentSiteInfo();
    
    // Force one more display update with frozen value
    await displayRecentActivity();
    
    // Show success message
    const msg = document.createElement('div');
    msg.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #ef4444; color: white; padding: 12px 16px; border-radius: 6px; font-size: 13px; z-index: 9999;';
    msg.textContent = `✓ Tracking stopped at ${formatTime(exactTimeWhenStopped)}`;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
    
  } catch (error) {
    console.error('Error stopping tracking:', error);
    alert('Failed to stop tracking');
  }
}

async function deleteTodayData() {
  if (!currentDomain) return;
  
  if (!confirm(`Delete today's time data for ${currentDomain}?\n\nThis action cannot be undone.`)) {
    return;
  }
  
  try {
    const { timeData = {}, lastVisits = [], sessionStarts = {} } = await chrome.storage.local.get(['timeData', 'lastVisits', 'sessionStarts']);
    const today = getTodayKey();
    
    // Delete today's time data
    if (timeData[currentDomain] && timeData[currentDomain][today]) {
      delete timeData[currentDomain][today];
      
      // Remove domain if no dates left
      if (Object.keys(timeData[currentDomain]).length === 0) {
        delete timeData[currentDomain];
      }
    }
    
    // Remove from last visits
    const updatedVisits = lastVisits.filter(v => v.domain !== currentDomain);
    
    // Remove session start
    if (sessionStarts[currentDomain] && sessionStarts[currentDomain][today]) {
      delete sessionStarts[currentDomain][today];
      if (Object.keys(sessionStarts[currentDomain]).length === 0) {
        delete sessionStarts[currentDomain];
      }
    }
    
    await chrome.storage.local.set({ 
      timeData, 
      lastVisits: updatedVisits,
      sessionStarts
    });
    
    // Reload UI
    await loadCurrentSiteInfo();
    await displayRecentActivity();
    
    // Show success message
    const msg = document.createElement('div');
    msg.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #10b981; color: white; padding: 12px 16px; border-radius: 6px; font-size: 13px; z-index: 9999;';
    msg.textContent = '✓ Today\'s data deleted for ' + currentDomain;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
    
  } catch (error) {
    console.error('Error deleting data:', error);
    alert('Failed to delete data');
  }
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCurrentSiteInfo();
  await displayRecentActivity();
  
  // Start real-time updates every second
  startRealtimeTimer();
});

// Stop timer when popup closes
window.addEventListener('unload', () => {
  stopRealtimeTimer();
});

document.getElementById('saveNoteBtn').addEventListener('click', saveNote);

document.getElementById('noteInput').addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to save
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    saveNote();
  }
});

document.getElementById('remindersToggle').addEventListener('change', (e) => {
  saveSettings({ remindersEnabled: e.target.checked });
});

document.getElementById('indicatorToggle').addEventListener('change', (e) => {
  toggleIndicator(e.target.checked);
});

document.querySelectorAll('.scope-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    currentNoteScope = btn.dataset.scope;
    updateNoteScopeButtons();
    await saveSettings({ noteScope: currentNoteScope });
    
    // Update section title
    const scopeText = currentNoteScope === 'url' ? 'URL' : 'Site';
    document.getElementById('notesSectionTitle').textContent = `Add Note to This ${scopeText}`;
    
    await loadNotes(); // Reload notes for new scope
    await loadIndicatorState(); // Reload indicator state for new scope
  });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'settings.html' });
});

document.getElementById('viewHistoryLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'settings.html#history' });
});

document.getElementById('trackBtn').addEventListener('click', startTracking);

document.getElementById('untrackBtn').addEventListener('click', stopTracking);

document.getElementById('deleteTodayBtn').addEventListener('click', deleteTodayData);
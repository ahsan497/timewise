// ========================================
// TimeWise Settings Page Logic - ENHANCED
// ========================================

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

function showSuccess() {
  const msg = document.getElementById('successMessage');
  msg.classList.add('show');
  setTimeout(() => {
    msg.classList.remove('show');
  }, 3000);
}

// ===== TIME LIMITS & GOALS =====

async function loadLimits() {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const limits = settings.limits || {};
    
    const limitList = document.getElementById('limitList');
    
    if (Object.keys(limits).length === 0) {
      limitList.innerHTML = '<div class="empty-state">No time limits set</div>';
    } else {
      limitList.innerHTML = Object.entries(limits)
        .map(([domain, minutes]) => `
          <div class="limit-item">
            <div class="limit-info">
              <div class="limit-domain">${domain}</div>
              <div class="limit-time">${minutes} minute${minutes > 1 ? 's' : ''} per day</div>
            </div>
            <button class="remove-btn" data-domain="${domain}">×</button>
          </div>
        `)
        .join('');
      
      // Add remove handlers
      limitList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeLimit(btn.dataset.domain));
      });
    }
    
    // Load daily goal
    const goalMinutes = settings.dailyGoal || 0;
    if (goalMinutes > 0) {
      document.getElementById('dailyGoalMinutes').value = goalMinutes;
      await updateGoalStatus();
    }
    
  } catch (error) {
    console.error('Error loading limits:', error);
  }
}

async function updateGoalStatus() {
  try {
    const { settings = {}, timeData = {} } = await chrome.storage.local.get(['settings', 'timeData']);
    const goalMinutes = settings.dailyGoal || 0;
    
    if (goalMinutes === 0) {
      document.getElementById('goalStatus').innerHTML = '<em>No goal set</em>';
      return;
    }
    
    // Calculate today's total
    const today = getTodayKey();
    let totalSeconds = 0;
    
    for (const domain in timeData) {
      if (timeData[domain][today]) {
        totalSeconds += timeData[domain][today];
      }
    }
    
    const totalMinutes = Math.floor(totalSeconds / 60);
    const percentage = Math.min(100, Math.round((totalMinutes / goalMinutes) * 100));
    
    const statusEl = document.getElementById('goalStatus');
    statusEl.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Today's Progress:</strong> ${totalMinutes} / ${goalMinutes} minutes (${percentage}%)
      </div>
      <div style="height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="height: 100%; background: ${percentage >= 100 ? '#10b981' : '#5a67d8'}; width: ${percentage}%; transition: width 0.3s;"></div>
      </div>
      ${percentage >= 100 ? '<div style="margin-top: 8px; color: #10b981; font-weight: 600;">🎉 Goal achieved!</div>' : ''}
    `;
  } catch (error) {
    console.error('Error updating goal status:', error);
  }
}

async function setDailyGoal() {
  const goalMinutes = parseInt(document.getElementById('dailyGoalMinutes').value);
  
  if (!goalMinutes || goalMinutes < 1) {
    alert('Please enter a valid goal (minimum 1 minute)');
    return;
  }
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    settings.dailyGoal = goalMinutes;
    await chrome.storage.local.set({ settings });
    
    showSuccess();
    await updateGoalStatus();
  } catch (error) {
    console.error('Error setting goal:', error);
    alert('Failed to set goal');
  }
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function addLimit() {
  const domainInput = document.getElementById('limitDomain');
  const minutesInput = document.getElementById('limitMinutes');
  
  let domain = domainInput.value.trim().toLowerCase();
  const minutes = parseInt(minutesInput.value);
  
  if (!domain || !minutes || minutes < 1) {
    alert('Please enter a valid domain and time limit');
    return;
  }
  
  // Clean domain - remove protocol and www
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (!settings.limits) {
      settings.limits = {};
    }
    
    settings.limits[domain] = minutes;
    
    await chrome.storage.local.set({ settings });
    
    domainInput.value = '';
    minutesInput.value = '';
    
    await loadLimits();
    showSuccess();
    
  } catch (error) {
    console.error('Error adding limit:', error);
    alert('Failed to add limit');
  }
}

async function removeLimit(domain) {
  if (!confirm(`Remove time limit for ${domain}?`)) return;
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (settings.limits) {
      delete settings.limits[domain];
    }
    
    await chrome.storage.local.set({ settings });
    
    // Also clear notification for this domain
    const { lastNotifications = {} } = await chrome.storage.local.get('lastNotifications');
    delete lastNotifications[domain];
    await chrome.storage.local.set({ lastNotifications });
    
    await loadLimits();
    showSuccess();
    
  } catch (error) {
    console.error('Error removing limit:', error);
    alert('Failed to remove limit');
  }
}

// ===== HISTORY =====

async function loadHistory() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }
  
  try {
    const { timeData = {}, sessionStarts = {} } = await chrome.storage.local.get(['timeData', 'sessionStarts']);
    const historyBody = document.getElementById('historyBody');
    
    const rows = [];
    
    for (const domain in timeData) {
      // Filter out invalid domains
      if (!domain || domain.startsWith('chrome') || domain === 'extensions') {
        continue;
      }
      
      for (const date in timeData[domain]) {
        if (date >= startDate && date <= endDate) {
          const startTime = sessionStarts[domain] && sessionStarts[domain][date] 
            ? new Date(sessionStarts[domain][date]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : 'N/A';
          
          rows.push({
            domain,
            date,
            startTime,
            seconds: timeData[domain][date]
          });
        }
      }
    }
    
    if (rows.length === 0) {
      historyBody.innerHTML = '<tr><td colspan="4" class="empty-state">No activity in this date range</td></tr>';
      return;
    }
    
    // Sort by date descending, then by time spent
    rows.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.seconds - a.seconds;
    });
    
    historyBody.innerHTML = rows
      .map(row => `
        <tr>
          <td>${row.domain}</td>
          <td>${row.date}<br><small style="color: #999;">Started: ${row.startTime}</small></td>
          <td>${formatTime(row.seconds)}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deleteHistoryEntry('${row.domain}', '${row.date}')" style="font-size: 11px; padding: 4px 8px;">
              Delete
            </button>
          </td>
        </tr>
      `)
      .join('');
    
  } catch (error) {
    console.error('Error loading history:', error);
    alert('Failed to load history');
  }
}

async function deleteHistoryEntry(domain, date) {
  if (!confirm(`Delete time data for ${domain} on ${date}?`)) return;
  
  try {
    const { timeData = {}, sessionStarts = {} } = await chrome.storage.local.get(['timeData', 'sessionStarts']);
    
    if (timeData[domain] && timeData[domain][date]) {
      delete timeData[domain][date];
      
      // Remove domain if no dates left
      if (Object.keys(timeData[domain]).length === 0) {
        delete timeData[domain];
      }
    }
    
    // Also remove session start
    if (sessionStarts[domain] && sessionStarts[domain][date]) {
      delete sessionStarts[domain][date];
      if (Object.keys(sessionStarts[domain]).length === 0) {
        delete sessionStarts[domain];
      }
    }
    
    await chrome.storage.local.set({ timeData, sessionStarts });
    await loadHistory();
    showSuccess();
    
  } catch (error) {
    console.error('Error deleting entry:', error);
    alert('Failed to delete entry');
  }
}

// Make function global for onclick
window.deleteHistoryEntry = deleteHistoryEntry;

// ===== DATA MANAGEMENT =====

async function exportData() {
  try {
    const data = await chrome.storage.local.get(null);
    
    // Clean up invalid domains before export
    if (data.timeData) {
      const cleanedTimeData = {};
      for (const domain in data.timeData) {
        if (domain && !domain.startsWith('chrome') && domain !== 'extensions' && domain.includes('.')) {
          cleanedTimeData[domain] = data.timeData[domain];
        }
      }
      data.timeData = cleanedTimeData;
    }
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `timewise-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

async function importData() {
  document.getElementById('importFile').click();
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedData = JSON.parse(text);
    
    // Validate data structure
    if (typeof importedData !== 'object') {
      throw new Error('Invalid data format');
    }
    
    const confirmed = confirm(
      'Import data from backup?\n\n' +
      'This will MERGE with your existing data:\n' +
      '• Time data will be combined\n' +
      '• Notes will be added\n' +
      '• Settings will be overwritten\n\n' +
      'Continue?'
    );
    
    if (!confirmed) return;
    
    // Get current data
    const currentData = await chrome.storage.local.get(null);
    
    // Merge time data
    if (importedData.timeData) {
      const mergedTimeData = { ...(currentData.timeData || {}), ...importedData.timeData };
      for (const domain in importedData.timeData) {
        if (!mergedTimeData[domain]) {
          mergedTimeData[domain] = {};
        }
        Object.assign(mergedTimeData[domain], importedData.timeData[domain]);
      }
      importedData.timeData = mergedTimeData;
    }
    
    // Merge notes
    if (importedData.notes) {
      const mergedNotes = { ...(currentData.notes || {}) };
      for (const key in importedData.notes) {
        if (!mergedNotes[key]) {
          mergedNotes[key] = [];
        }
        // Ensure array format
        const importedNotesArray = Array.isArray(importedData.notes[key]) 
          ? importedData.notes[key] 
          : [importedData.notes[key]];
        
        mergedNotes[key] = [...mergedNotes[key], ...importedNotesArray];
        
        // Remove duplicates by ID
        const uniqueNotes = {};
        mergedNotes[key].forEach(note => {
          uniqueNotes[note.id || note.timestamp] = note;
        });
        mergedNotes[key] = Object.values(uniqueNotes);
      }
      importedData.notes = mergedNotes;
    }
    
    // Save merged data
    await chrome.storage.local.set(importedData);
    
    alert('✓ Data imported successfully!');
    window.location.reload();
    
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Failed to import data. Please check the file format.');
  }
  
  // Reset file input
  event.target.value = '';
}

async function clearAllData() {
  const confirmed = confirm(
    'Are you sure you want to clear ALL TimeWise data?\n\n' +
    'This will delete:\n' +
    '• All time tracking history\n' +
    '• All notes\n' +
    '• All settings\n\n' +
    'This action cannot be undone.'
  );
  
  if (!confirmed) return;
  
  try {
    await chrome.storage.local.clear();
    
    // Reset default settings
    await chrome.storage.local.set({
      settings: {
        remindersEnabled: true,
        noteScope: 'domain',
        limits: {},
        noTrackList: []
      },
      lastVisits: []
    });
    
    alert('All data has been cleared');
    window.location.reload();
    
  } catch (error) {
    console.error('Error clearing data:', error);
    alert('Failed to clear data');
  }
}

// ===== NO-TRACK LIST =====

async function loadNoTrackList() {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const noTrackList = settings.noTrackList || [];
    
    const listEl = document.getElementById('noTrackList');
    
    if (noTrackList.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No sites in no-track list</div>';
      return;
    }
    
    listEl.innerHTML = noTrackList
      .map(item => `
        <div class="limit-item">
          <div class="limit-info">
            <div class="limit-domain">${item}</div>
            <div class="limit-time">Never tracked</div>
          </div>
          <button class="remove-btn" data-item="${item}">×</button>
        </div>
      `)
      .join('');
    
    // Add remove handlers
    listEl.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeFromNoTrack(btn.dataset.item));
    });
    
  } catch (error) {
    console.error('Error loading no-track list:', error);
  }
}

async function addToNoTrack() {
  const input = document.getElementById('noTrackInput');
  let item = input.value.trim().toLowerCase();
  
  if (!item) {
    alert('Please enter a domain or URL');
    return;
  }
  
  // Clean the input
  item = item.replace(/^https?:\/\//, '').replace(/^www\./, '');
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (!settings.noTrackList) {
      settings.noTrackList = [];
    }
    
    if (settings.noTrackList.includes(item)) {
      alert('This item is already in the no-track list');
      return;
    }
    
    settings.noTrackList.push(item);
    await chrome.storage.local.set({ settings });
    
    input.value = '';
    await loadNoTrackList();
    showSuccess();
    
  } catch (error) {
    console.error('Error adding to no-track:', error);
    alert('Failed to add to no-track list');
  }
}

async function removeFromNoTrack(item) {
  if (!confirm(`Remove ${item} from no-track list?`)) return;
  
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    if (settings.noTrackList) {
      settings.noTrackList = settings.noTrackList.filter(i => i !== item);
    }
    
    await chrome.storage.local.set({ settings });
    await loadNoTrackList();
    showSuccess();
    
  } catch (error) {
    console.error('Error removing from no-track:', error);
    alert('Failed to remove from no-track list');
  }
}

// ===== STORAGE MONITORING =====

function showStorageSize() {
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    const mb = (bytes / 1024 / 1024).toFixed(2);
    const percentage = (bytes / 10485760 * 100).toFixed(1); // 10 MB limit
    
    document.getElementById('storageSize').textContent = `${mb} MB (${percentage}%)`;
    document.getElementById('storageBar').style.width = `${percentage}%`;
    
    // Change color based on usage
    const bar = document.getElementById('storageBar');
    if (percentage > 90) {
      bar.style.background = '#ef4444'; // red
    } else if (percentage > 70) {
      bar.style.background = '#f59e0b'; // orange
    } else {
      bar.style.background = '#5a67d8'; // blue
    }
  });
}

// ===== CLEANUP FUNCTIONS =====

async function cleanupTimeData() {
  const months = parseInt(document.getElementById('cleanupMonths').value);
  
  if (!confirm(`Delete all time data older than ${months} month${months > 1 ? 's' : ''}?`)) {
    return;
  }
  
  try {
    const { timeData = {} } = await chrome.storage.local.get('timeData');
    
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;
    
    let deletedCount = 0;
    for (const domain in timeData) {
      for (const date in timeData[domain]) {
        if (date < cutoffStr) {
          delete timeData[domain][date];
          deletedCount++;
        }
      }
      if (Object.keys(timeData[domain]).length === 0) {
        delete timeData[domain];
      }
    }
    
    await chrome.storage.local.set({ timeData });
    alert(`✓ Deleted ${deletedCount} old time entries`);
    showSuccess();
    showStorageSize();
    
  } catch (error) {
    console.error('Error cleaning time data:', error);
    alert('Failed to clean up time data');
  }
}

async function cleanupNotes() {
  const limit = parseInt(document.getElementById('notesLimit').value);
  
  if (!confirm(`Keep only the last ${limit} notes per site?`)) {
    return;
  }
  
  try {
    const { notes = {} } = await chrome.storage.local.get('notes');
    
    let trimmedCount = 0;
    for (const key in notes) {
      if (Array.isArray(notes[key]) && notes[key].length > limit) {
        const before = notes[key].length;
        // Sort by timestamp descending and keep only the newest
        notes[key].sort((a, b) => b.timestamp - a.timestamp);
        notes[key] = notes[key].slice(0, limit);
        trimmedCount += (before - notes[key].length);
      }
    }
    
    await chrome.storage.local.set({ notes });
    alert(`✓ Trimmed ${trimmedCount} old notes`);
    showSuccess();
    showStorageSize();
    
  } catch (error) {
    console.error('Error cleaning notes:', error);
    alert('Failed to clean up notes');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  loadLimits();
  loadNoTrackList();
  showStorageSize();
  
  // Set default date range (last 7 days)
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  document.getElementById('endDate').valueAsDate = today;
  document.getElementById('startDate').valueAsDate = weekAgo;
  
  // Check if we should scroll to history section
  if (window.location.hash === '#history') {
    setTimeout(() => {
      const historySection = document.querySelector('.section:nth-child(3)');
      if (historySection) {
        historySection.scrollIntoView({ behavior: 'smooth' });
        loadHistory();
      }
    }, 100);
  }
  
  // Refresh storage size and goal every 5 seconds
  setInterval(() => {
    showStorageSize();
    if (document.getElementById('dailyGoalMinutes').value) {
      updateGoalStatus();
    }
  }, 5000);
});

// ===== EVENT LISTENERS =====

document.getElementById('addLimitBtn').addEventListener('click', addLimit);

document.getElementById('limitDomain').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addLimit();
});

document.getElementById('limitMinutes').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addLimit();
});

document.getElementById('setGoalBtn').addEventListener('click', setDailyGoal);

document.getElementById('loadHistoryBtn').addEventListener('click', loadHistory);

document.getElementById('exportBtn').addEventListener('click', exportData);

document.getElementById('importBtn').addEventListener('click', importData);

document.getElementById('importFile').addEventListener('change', handleImportFile);

document.getElementById('clearBtn').addEventListener('click', clearAllData);

document.getElementById('cleanupTimeBtn').addEventListener('click', cleanupTimeData);

document.getElementById('cleanupNotesBtn').addEventListener('click', cleanupNotes);

document.getElementById('addNoTrackBtn').addEventListener('click', addToNoTrack);

document.getElementById('noTrackInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addToNoTrack();
});
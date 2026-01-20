// ========================================
// TimeWise Service Worker (Manifest V3)
// Handles time tracking, reminders, and storage
// ========================================

// ===== STATE MANAGEMENT =====
let currentSession = {
  domain: null,
  url: null,
  startTime: null,
  isActive: false
};

let dailyGoalNotified = false; // Track if daily goal notification sent today

// ===== UTILITY FUNCTIONS =====

// Extract clean domain from URL - ENHANCED with better filtering
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    
    // Filter out extension pages, new tabs, and chrome:// URLs
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url === 'chrome://newtab/' ||
      hostname === '' ||
      !hostname.includes('.')
    ) {
      return null;
    }
    
    return hostname;
  } catch {
    return null;
  }
}

// Get today's date key (YYYY-MM-DD)
function getDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== TIME TRACKING CORE =====

// Save accumulated time for current session
async function saveCurrentSession() {
  if (!currentSession.domain || !currentSession.startTime || !currentSession.isActive) {
    return;
  }
  
  const elapsed = Math.floor((Date.now() - currentSession.startTime) / 1000); // seconds
  
  // Don't save if elapsed time is 0
  if (elapsed <= 0) return;
  
  const dateKey = getDateKey();
  
  try {
    const data = await chrome.storage.local.get(['timeData', 'lastVisits']);
    const timeData = data.timeData || {};
    const lastVisits = data.lastVisits || [];
    
    // Update time data
    if (!timeData[currentSession.domain]) {
      timeData[currentSession.domain] = {};
    }
    
    if (!timeData[currentSession.domain][dateKey]) {
      timeData[currentSession.domain][dateKey] = 0;
    }
    
    timeData[currentSession.domain][dateKey] += elapsed;
    
    // Update last visits (keep last 10 unique domains with their latest visit time)
    const visitIndex = lastVisits.findIndex(v => v.domain === currentSession.domain);
    const visitEntry = {
      domain: currentSession.domain,
      url: currentSession.url,
      lastVisit: Date.now(),
      todaySeconds: timeData[currentSession.domain][dateKey]
    };
    
    if (visitIndex !== -1) {
      lastVisits[visitIndex] = visitEntry;
    } else {
      lastVisits.unshift(visitEntry);
    }
    
    // Keep only last 10
    const recentVisits = lastVisits.slice(0, 10);
    
    await chrome.storage.local.set({ 
      timeData,
      lastVisits: recentVisits
    });
    
    // Check if site-specific reminder needed
    await checkSiteReminder(currentSession.domain, timeData[currentSession.domain][dateKey]);
    
    // Check if daily goal reminder needed
    await checkDailyGoalReminder(timeData, dateKey);
    
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

// Start new tracking session
async function startSession(domain, url) {
  // Don't track if domain is invalid
  if (!domain) {
    currentSession = {
      domain: null,
      url: null,
      startTime: null,
      isActive: false
    };
    return;
  }
  
  // Check no-track list
  const { settings = {} } = await chrome.storage.local.get('settings');
  const noTrackList = settings.noTrackList || [];
  const isNoTrack = noTrackList.some(item => 
    domain === item || url.includes(item)
  );
  
  if (isNoTrack) {
    currentSession = {
      domain: null,
      url: null,
      startTime: null,
      isActive: false
    };
    return;
  }
  
  // Save previous session if any
  await saveCurrentSession();
  
  // Check if window is focused
  try {
    const window = await chrome.windows.getCurrent();
    
    currentSession = {
      domain,
      url,
      startTime: Date.now(),
      isActive: window.focused
    };
    
    // Store session start time
    const dateKey = getDateKey();
    const { sessionStarts = {} } = await chrome.storage.local.get('sessionStarts');
    
    if (!sessionStarts[domain]) {
      sessionStarts[domain] = {};
    }
    
    // Only store if this is the first session of the day
    if (!sessionStarts[domain][dateKey]) {
      sessionStarts[domain][dateKey] = Date.now();
      await chrome.storage.local.set({ sessionStarts });
    }
    
  } catch (error) {
    console.error('Error starting session:', error);
  }
}

// Stop current session
async function stopSession() {
  await saveCurrentSession();
  currentSession = {
    domain: null,
    url: null,
    startTime: null,
    isActive: false
  };
}

// ===== REMINDER SYSTEM - FIXED WITH PROFESSIONAL NOTIFICATIONS =====

async function checkSiteReminder(domain, totalSeconds) {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    // Check if reminders are enabled
    if (!settings.remindersEnabled) return;
    
    const limits = settings.limits || {};
    const limitMinutes = limits[domain];
    
    // No limit set for this domain
    if (!limitMinutes) return;
    
    const limitSeconds = limitMinutes * 60;
    
    // Check if we just crossed the threshold (within last 10 seconds for better accuracy)
    if (totalSeconds >= limitSeconds && totalSeconds < limitSeconds + 10) {
      // Check if we already notified today
      const { lastNotifications = {} } = await chrome.storage.local.get('lastNotifications');
      const today = getDateKey();
      
      if (lastNotifications[domain] === today) return;
      
      // FIXED: Professional notification with better messaging
      const hours = Math.floor(limitMinutes / 60);
      const mins = limitMinutes % 60;
      let timeStr = '';
      
      if (hours > 0 && mins > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        timeStr = `${mins} minute${mins > 1 ? 's' : ''}`;
      }
      
      chrome.notifications.create(`reminder-${domain}-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⏰ TimeWise Reminder',
        message: `You've reached your ${timeStr} goal on ${domain} today. Great work staying mindful of your time!`,
        priority: 2,
        requireInteraction: false,
        silent: false
      });
      
      // Mark as notified
      lastNotifications[domain] = today;
      await chrome.storage.local.set({ lastNotifications });
      
      console.log(`Site reminder sent for ${domain}: ${timeStr}`);
    }
  } catch (error) {
    console.error('Error checking site reminder:', error);
  }
}

async function checkDailyGoalReminder(timeData, dateKey) {
  try {
    const { settings = {} } = await chrome.storage.local.get('settings');
    
    // Check if reminders are enabled and daily goal is set
    if (!settings.remindersEnabled || !settings.dailyGoal) return;
    
    const goalMinutes = settings.dailyGoal;
    const goalSeconds = goalMinutes * 60;
    
    // Calculate total time today
    let totalSeconds = 0;
    for (const domain in timeData) {
      if (timeData[domain][dateKey]) {
        totalSeconds += timeData[domain][dateKey];
      }
    }
    
    // Check if we just reached the goal (within last 10 seconds)
    if (totalSeconds >= goalSeconds && totalSeconds < goalSeconds + 10) {
      // Check if we already notified today
      const { dailyGoalNotifications = {} } = await chrome.storage.local.get('dailyGoalNotifications');
      const today = getDateKey();
      
      if (dailyGoalNotifications[today]) return;
      
      // FIXED: Professional daily goal achievement notification
      const hours = Math.floor(goalMinutes / 60);
      const mins = goalMinutes % 60;
      let timeStr = '';
      
      if (hours > 0 && mins > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        timeStr = `${mins} minute${mins > 1 ? 's' : ''}`;
      }
      
      chrome.notifications.create(`daily-goal-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🎉 Daily Goal Achieved!',
        message: `Congratulations! You've completed your ${timeStr} productivity goal for today. Keep up the great work!`,
        priority: 2,
        requireInteraction: false,
        silent: false
      });
      
      // Mark as notified
      dailyGoalNotifications[today] = true;
      await chrome.storage.local.set({ dailyGoalNotifications });
      
      console.log(`Daily goal achieved notification sent: ${timeStr}`);
    }
  } catch (error) {
    console.error('Error checking daily goal reminder:', error);
  }
}

// ===== EVENT LISTENERS =====

// Tab activated (switched to different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;
    
    const domain = getDomain(tab.url);
    
    if (domain !== currentSession.domain) {
      await startSession(domain, tab.url);
    }
  } catch (error) {
    // console.error('Error on tab activation:', error);
  }
});

// Tab updated (URL changed in current tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const domain = getDomain(changeInfo.url);
    
    // Check if this is the active tab
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (activeTab && activeTab.id === tabId) {
        await startSession(domain, changeInfo.url);
      }
    } catch (error) {
      console.error('Error on tab update:', error);
    }
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - save current session but mark as inactive
    currentSession.isActive = false;
    await saveCurrentSession();
  } else {
    // Browser gained focus
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab && tab.url) {
        const domain = getDomain(tab.url);
        if (domain) {
          currentSession.isActive = true;
          if (domain !== currentSession.domain) {
            await startSession(domain, tab.url);
          } else {
            // Resume timing for same domain
            currentSession.startTime = Date.now();
          }
        }
      }
    } catch (error) {
      console.error('Error on window focus:', error);
    }
  }
});

// CRITICAL: Periodic save every 5 seconds to catch reminders quickly
chrome.alarms.create('quickSave', { periodInMinutes: 0.0833 }); // ~5 seconds
chrome.alarms.create('periodicSave', { periodInMinutes: 1 }); // 1 minute backup
chrome.alarms.create('weeklyCleanup', { periodInMinutes: 10080 }); // 7 days
chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'quickSave' || alarm.name === 'periodicSave') {
    if (currentSession.domain && currentSession.isActive) {
      await saveCurrentSession();
      // Restart timer to continue tracking
      currentSession.startTime = Date.now();
    }
  } else if (alarm.name === 'weeklyCleanup') {
    await cleanupOldData();
  } else if (alarm.name === 'dailyReset') {
    // Reset daily goal notification flag at midnight
    dailyGoalNotified = false;
  }
});

// ===== AUTOMATIC DATA CLEANUP =====

async function cleanupOldData() {
  try {
    const { timeData = {}, notes = {} } = await chrome.storage.local.get(['timeData', 'notes']);
    
    // Keep only last 365 days of time data
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const cutoffDate = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;
    
    let cleanedDates = 0;
    for (const domain in timeData) {
      for (const date in timeData[domain]) {
        if (date < cutoffDate) {
          delete timeData[domain][date];
          cleanedDates++;
        }
      }
      // Remove domain if no dates left
      if (Object.keys(timeData[domain]).length === 0) {
        delete timeData[domain];
      }
    }
    
    // Limit notes to 50 per site
    let trimmedNotes = 0;
    for (const key in notes) {
      if (Array.isArray(notes[key]) && notes[key].length > 50) {
        notes[key].sort((a, b) => b.timestamp - a.timestamp);
        notes[key] = notes[key].slice(0, 50);
        trimmedNotes++;
      }
    }
    
    await chrome.storage.local.set({ timeData, notes });
    
    console.log(`TimeWise cleanup: Removed ${cleanedDates} old dates, trimmed ${trimmedNotes} note histories`);
    
    // Check storage size and warn if needed
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      const mb = (bytes / 1024 / 1024).toFixed(2);
      console.log(`TimeWise storage: ${mb} MB / 10 MB`);
      
      if (bytes > 8388608) { // 8 MB (80% of limit)
        chrome.notifications.create('storage-warning', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'TimeWise Storage Notice',
          message: `Storage is ${mb} MB. Consider exporting and clearing old data in Settings.`,
          priority: 1
        });
      }
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// ===== INITIALIZATION =====

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        remindersEnabled: true,
        noteScope: 'domain',
        limits: {},
        noTrackList: [],
        dailyGoal: 0
      }
    });
  }
  
  // Initialize other storage if not exists
  const { lastVisits, sessionStarts } = await chrome.storage.local.get(['lastVisits', 'sessionStarts']);
  if (!lastVisits) {
    await chrome.storage.local.set({ lastVisits: [] });
  }
  if (!sessionStarts) {
    await chrome.storage.local.set({ sessionStarts: {} });
  }
});

// Start tracking current tab on startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const domain = getDomain(tab.url);
      if (domain) {
        await startSession(domain, tab.url);
      }
    }
  } catch (error) {
    console.error('Error on startup:', error);
  }
});

// ===== MESSAGE HANDLERS =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentDomain') {
    sendResponse({ 
      domain: currentSession.domain,
      url: currentSession.url
    });
  } else if (request.action === 'getCurrentSession') {
    sendResponse({
      domain: currentSession.domain,
      url: currentSession.url,
      startTime: currentSession.startTime,
      isActive: currentSession.isActive
    });
  }
  return true;
});
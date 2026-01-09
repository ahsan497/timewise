# Privacy Policy for TimeWise

**Last Updated**: January 2026

## Overview

TimeWise ("the Extension") is committed to protecting your privacy. This privacy policy explains how TimeWise handles your data.

## Our Privacy Promise

**TimeWise does NOT:**
- Collect any personal information
- Send data to external servers
- Track your browsing activity
- Use analytics or tracking pixels
- Share data with third parties
- Display ads or promotional content
- Monitor your web searches or page content

## What Data is Stored

TimeWise stores the following data **locally on your device only**:

### 1. Time Tracking Data
- Website domains you visit (e.g., "example.com")
- Time spent on each website
- Session start times
- Historical time data (up to 365 days)

### 2. Notes
- Text notes you create
- Timestamps of when notes were created/edited
- Association with website domains or URLs

### 3. User Settings
- Time limits you set for websites
- Reminder preferences (enabled/disabled)
- No-track list (sites you choose not to track)
- Note scope preferences (domain vs URL)
- Indicator visibility preferences
- Daily productivity goals

## Data Storage Location

All data is stored using Chrome's local storage API (`chrome.storage.local`). This means:
- Data **never leaves your device**
- Data is stored in your browser's local storage
- Only you have access to your data
- Data is automatically deleted if you uninstall the extension
- No account or sign-up required

## Data Retention

- Time tracking data is automatically cleaned up after 365 days
- You can manually delete data at any time through Settings
- You can export your data as a JSON file
- Data persists across browser restarts
- Uninstalling the extension permanently deletes all data

## Permissions Explained

TimeWise requests the following permissions:

### tabs
**Why needed**: To detect which website you're currently viewing for accurate time tracking and to display relevant notes.
**What we access**: Only the URL of the current tab. We do not access page content.

### storage
**Why needed**: To save your time tracking data, notes, and settings locally in your browser.
**What is stored**: Time data, notes, and preferences (all locally on your device).

### alarms
**Why needed**: To periodically save tracking data and schedule reminder notifications.
**What we do**: Run background tasks every few seconds to save tracking progress.

### notifications
**Why needed**: To send friendly reminders when you reach your set time limits.
**User control**: Reminders can be completely disabled in Settings.

### host_permissions (http://*/* and https://*/*)
**Why needed**: To display the note indicator overlay on websites you visit and track browsing time.
**What we access**: Only the URL to determine which site you're on. We do not read page content, forms, or personal information.

## Third-Party Services

TimeWise does **NOT** use any third-party services, including:
- No analytics services (Google Analytics, Mixpanel, etc.)
- No crash reporting services
- No advertising networks
- No cloud storage or backup services
- No external APIs

## Children's Privacy

TimeWise does not knowingly collect any personal information from anyone, including children under 13. Since we don't collect any data at all, the Extension is safe for users of all ages.

## Data Security

Since all data is stored locally on your device:
- Data is protected by your browser's security measures
- No data transmission means no risk of interception
- Your browser's password/security protects your data
- We recommend using a screen lock and browser password

## Your Rights & Control

You have complete control over your data:

### View Your Data
- All data is viewable in the Extension's History section
- Settings page shows all stored preferences

### Export Your Data
- Go to Settings → Data Management → Export Data
- Downloads a JSON file with all your data

### Delete Your Data
- Delete individual entries from History
- Delete today's data for specific sites
- Clear all data: Settings → Data Management → Clear All Data
- Uninstall the extension to permanently remove all data

### Opt-Out of Tracking
- Add sites to the No-Track list in Settings
- Stop tracking button for current site in popup
- Disable tracking entirely by not using the extension

## Updates to This Policy

We may update this privacy policy from time to time. Changes will be:
- Reflected in the "Last Updated" date
- Posted in the Chrome Web Store listing
- Included in extension updates

Continued use of TimeWise after policy changes constitutes acceptance of the updated policy.

## Open Source

TimeWise is open source software. You can:
- Review the complete source code
- Verify our privacy claims
- Contribute to the project
- Fork and modify the code

**Source Code**: [Add your GitHub URL here]

## Contact Information

If you have questions about this privacy policy or TimeWise:

**Email**: [ahsantariq497@gmail.com]
**GitHub Issues**: [https://github.com/ahsan497/timewise/issues]
**Chrome Web Store**: [extension-store-url]

## Compliance

TimeWise complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles

Since we don't collect any personal data, most data protection regulations don't apply, but we follow privacy best practices regardless.

## Data Portability

Your data is always portable:
- Export function provides complete data in JSON format
- JSON files are human-readable and can be imported elsewhere
- Standard format makes data easy to process with other tools

## No Sale of Data

TimeWise will never sell your data because:
1. We don't collect your data
2. We don't have access to your data
3. Your data never leaves your device

## Transparency

We believe in complete transparency:
- All code is open source and reviewable
- This privacy policy clearly explains our practices
- We use only standard browser APIs
- No hidden features or tracking

---

## Summary

**In Plain English:**

TimeWise is a simple time tracking extension that:
- Stores everything on your computer only
- Never sends data anywhere
- Doesn't track what you do on websites
- Just counts time and lets you take notes
- Gives you complete control over your data

If you have any concerns or questions, please contact us at [ahsantariq497@gmail.com].

---

**Developer Information:**
- Developer Name: [Ahsan Tariq]
- Extension Name: TimeWise - Focus Time Tracker & Smart Notes
- Extension ID: [Will be assigned by Chrome Web Store]
- Version: 1.0.0
- Last Policy Update: January 2026

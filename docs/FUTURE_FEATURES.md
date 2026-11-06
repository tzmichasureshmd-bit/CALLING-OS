# Future Features & Enhancements

## Overview
This document outlines potential features, improvements, and ideas for CallNexa that can be implemented in future versions. These are NOT currently implemented but are valuable additions for enhanced user experience.

---

## 🔴 1. Real-Time Call Recording Indicator (HIGH PRIORITY)

### Current Behavior
- Recording happens **automatically** in background by Android OS
- Employee doesn't see any indicator during call
- Recording only detected **after call ends** (file discovery)
- Upload happens silently in background

### Proposed Feature: Floating Indicator
**Show a floating bubble during active calls to indicate recording status**

#### Visual Design
```
┌─────────────────────────┐
│  📱 Active Call Screen  │
│                         │
│  ┌──────────────┐       │
│  │ 🔴 Recording │       │  ← Floating popup (top-right corner)
│  │   2:34       │       │     Red dot + timer
│  └──────────────┘       │     Draggable, semi-transparent
│                         │
│  John Doe               │
│  +919876543210          │
│  03:45                  │
│                         │
│  [Mute] [Speaker] [End] │
└─────────────────────────┘
```

#### Technical Implementation
```javascript
// NEW FILE: mobile/src/RecordingIndicatorService.js

import { NativeModules, NativeEventEmitter, AppRegistry } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Shows a floating overlay during active calls when recording is enabled
 * Uses Android Overlay Window permission (SYSTEM_ALERT_WINDOW)
 */

// Native module (Kotlin) to detect call state
const { CallStateModule } = NativeModules;

export class RecordingIndicatorService {
  static async showIndicator() {
    // Show floating bubble using React Native Overlay or native overlay
    // Position: Top-right corner, draggable
    // Content: "🔴 Recording" + call duration
    // Background: Semi-transparent red (#FF0000 with 85% opacity)
  }
  
  static async hideIndicator() {
    // Remove floating bubble when call ends
  }
  
  static async startMonitoring() {
    const emitter = new NativeEventEmitter(CallStateModule);
    
    // Listen for call state changes
    emitter.addListener('callStateChanged', async (state) => {
      if (state === 'OFFHOOK') {  // Call active
        const recordingEnabled = await isRecordingEnabled();
        if (recordingEnabled) {
          await this.showIndicator();
        }
      } else if (state === 'IDLE') {  // Call ended
        await this.hideIndicator();
      }
    });
  }
}
```

#### Required Permissions
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
```

#### User Control
```javascript
// Settings toggle
<Switch 
  label="Show recording indicator during calls"
  value={showRecordingIndicator}
  onValueChange={setShowRecordingIndicator}
/>
```

#### Privacy Benefits
- ✅ Employee **knows** when call is being recorded
- ✅ Visual reminder to stay professional
- ✅ Can pause/disable recording before personal calls
- ✅ Complies with consent laws in many regions

#### Implementation Steps
1. Create native Kotlin module for call state detection
2. Build React Native floating overlay component
3. Add SYSTEM_ALERT_WINDOW permission request
4. Add Settings toggle for indicator visibility
5. Test on various Android versions (10, 11, 12, 13, 14)

---

## 🎙️ 2. One-Tap Recording Toggle (MEDIUM PRIORITY)

### Current Behavior
- Recording is **global ON/OFF** in Settings
- No per-call control
- Employee must go to Settings → Call Recording → Toggle

### Proposed Feature: Quick Toggle Widget
**Add a home screen widget or notification toggle for instant recording control**

#### Option A: Home Screen Widget
```
┌──────────────────────┐
│  CallNexa Recording  │
│                      │
│  ⚫ OFF    ● ON      │  ← Toggle switch
│                      │
│  Last sync: 2m ago   │
└──────────────────────┘
```

#### Option B: Quick Settings Tile (Android)
```
Swipe down from top
  ↓
Quick Settings tiles
  ↓
[🎙️ CallNexa Recording]  ← Tap to toggle ON/OFF
```

#### Option C: Notification Toggle
```
┌──────────────────────────────┐
│  CallNexa Recording          │
│  Status: ON ✓                │
│  Last call: 5 minutes ago    │
│                              │
│  [Turn OFF]  [View Calls]    │  ← Action buttons
└──────────────────────────────┘
```

#### Use Cases
- **Before personal call**: Tap widget → OFF → Make call
- **Back to business**: Tap widget → ON → Recording enabled
- **No need to open app**: Toggle from anywhere

#### Implementation
```javascript
// NEW FILE: mobile/widgets/RecordingToggleWidget.js

import { WidgetTaskHandler } from 'react-native-android-widget';

WidgetTaskHandler('RecordingToggle', async ({ widgetAction }) => {
  if (widgetAction === 'toggle') {
    const current = await AsyncStorage.getItem(RECORDING_PREF_KEY);
    const newValue = current === 'true' ? 'false' : 'true';
    await AsyncStorage.setItem(RECORDING_PREF_KEY, newValue);
    
    // Update widget UI
    return { success: true, enabled: newValue === 'true' };
  }
});
```

---

## 📊 3. Live Call Analytics Dashboard (LOW PRIORITY)

### Proposed Feature
**Real-time analytics showing active calls across all employees**

#### Dashboard View
```
┌─────────────────────────────────────┐
│  Active Calls: 12                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                      │
│  Ramesh Kumar                        │
│  └─ +919123456789 • 3:45 🔴         │
│                                      │
│  Priya Sharma                        │
│  └─ +918765432109 • 1:20 🔴         │
│                                      │
│  [View All 12 Active Calls →]       │
└─────────────────────────────────────┘
```

#### Technical Approach
- Employee mobile app sends `call_started` event via WebSocket
- Manager dashboard listens to real-time events
- Shows: Employee name, customer number, duration, recording status

#### Privacy Consideration
- ⚠️ **Controversial** - Manager can listen to live calls?
- 🔒 **Alternative**: Show only metadata (not audio stream)
- ✅ Better: Show call completed + recording available

---

## 🤖 4. AI-Powered Features (MEDIUM PRIORITY)

### 4.1 Real-Time Transcription During Call
**Live captions/subtitles while call is happening**

#### Use Case
- Employee can see what customer is saying (for noisy environments)
- Great for hearing-impaired employees
- Can copy/paste important info (order numbers, addresses)

#### Technical
```javascript
// Stream audio to cloud transcription service
// WhisperAPI, Google Speech-to-Text, Azure Speech
const stream = await startAudioStream();
const transcription = await whisperAPI.streamTranscribe(stream);

// Show in floating overlay
<FloatingTranscript text={transcription} />
```

### 4.2 AI Suggested Responses
**AI listens and suggests responses to employee during call**

```
Customer: "What's the delivery time?"
  ↓
AI Suggestion appears on screen:
  "Standard delivery: 3-5 business days
   Express: 1-2 business days"
```

### 4.3 Sentiment Analysis Alert
**AI detects angry customer, alerts manager**

```
AI detects: Customer tone is frustrated 😠
  ↓
Notification to Manager:
  "Ramesh's call needs attention - customer upset"
  [Listen] [Join Call] [Send Message]
```

---

## 🔔 5. Smart Notifications (HIGH PRIORITY)

### Current Behavior
- Generic notifications: "Call synced", "Recording uploaded"
- No context or actionable insights

### Proposed: Contextual Notifications

#### For Employees
```
🎯 Goal Progress: 15/20 calls today (75%)
   3 more calls to hit your target!
   [View Stats]

🔥 Hot Lead Alert!
   Customer called back: +919123456789
   Last call: 2 days ago (interested in Pro plan)
   [View History] [Call Now]

📊 Weekly Report Ready
   You made 87 calls this week (↑12% from last week)
   Top customer: ABC Corp (5 calls)
   [View Full Report]
```

#### For Managers
```
⚠️ Employee Offline: Ramesh Kumar
   Last seen: 2 hours ago
   Expected call target: Not met (8/20 calls)
   [Contact Employee] [View Device Status]

🎉 Team Milestone!
   100 calls completed today across all employees
   Top performer: Priya (18 calls)
   [View Leaderboard]

📞 Missed Follow-up Alert
   3 customers called back but no response
   - +919111111111 (2 attempts)
   - +919222222222 (1 attempt)
   [Assign Follow-up]
```

---

## 🎯 6. Gamification & Incentives (LOW PRIORITY)

### Proposed Features

#### Daily Challenges
```
Today's Challenge: Make 20 calls 📞
Progress: ████████░░ 16/20 (80%)
Reward: 50 coins 🪙
```

#### Leaderboard
```
Top Callers This Week:
🥇 Priya Sharma    - 127 calls
🥈 Ramesh Kumar    - 115 calls
🥉 Amit Patel      - 98 calls
```

#### Badges & Achievements
```
🏆 Call Master
   Made 1000+ calls total

⚡ Speed Demon
   Made 30 calls in one day

🎯 Perfect Week
   Hit daily target 7 days in a row
```

---

## 📱 7. Advanced Call Features (FUTURE)

### 7.1 Call Scheduling
- Schedule calls for specific time
- Auto-reminder before scheduled call
- One-tap dial from schedule

### 7.2 Call Scripts
- Pre-written scripts for different scenarios
- Show script during call (floating overlay)
- Track which scripts convert best

### 7.3 Call Recording Bookmarks
- Mark important moments during call
- "This part is important" → Creates timestamp
- Manager can jump to bookmarks in recording

### 7.4 Multi-Language Support
- Auto-detect customer language
- Transcribe in customer's language
- Translate to employee's language (real-time)

---

## 🔒 8. Enhanced Privacy Controls (HIGH PRIORITY)

### 8.1 Consent Management
**Before recording, ask customer for consent**

```
[During call setup]
"This call may be recorded for quality purposes.
 Press 1 to consent, Press 2 to decline."

If declined:
  → Recording disabled for this call
  → Flagged as "No consent" in dashboard
```

### 8.2 Auto-Redaction
**Automatically remove sensitive info from transcripts**

```
Customer: "My credit card is 4532-1234-5678-9012"
  ↓
Transcript: "My credit card is [REDACTED]"

Customer: "My Aadhaar number is 1234-5678-9012"
  ↓
Transcript: "My Aadhaar number is [REDACTED]"
```

### 8.3 Recording Expiry
**Auto-delete recordings after X days**

```
Settings:
[ ] Keep recordings forever
[✓] Auto-delete after 90 days (compliance)
[ ] Delete after 30 days
```

---

## 💰 9. Billing & Payment Features (MEDIUM PRIORITY)

### 9.1 Usage-Based Billing
- Track: Calls synced, recordings stored, transcriptions generated
- Bill monthly based on actual usage
- Show usage dashboard to client

### 9.2 Pay-As-You-Go Transcription
- Basic plan: Call logs only (free)
- Premium: Add transcription (₹2 per minute)
- Enterprise: Unlimited transcription

### 9.3 Client Self-Service Portal
- View invoices online
- Add/remove employees
- Update payment method
- Download usage reports

---

## 📈 10. Advanced Analytics (LOW PRIORITY)

### 10.1 Predictive Analytics
- "Ramesh will miss his target this week (75% confidence)"
- "Customer +919123456789 likely to convert (based on 3 positive calls)"

### 10.2 Call Pattern Insights
- "Most successful calls happen between 10 AM - 12 PM"
- "Calls longer than 5 minutes have 80% conversion rate"
- "Customers from Maharashtra respond better to Hindi"

### 10.3 Competitor Mentions
- AI detects competitor names in transcripts
- Alert manager: "10 calls mentioned 'Competitor XYZ' this week"

---

## 🌐 11. Integrations (MEDIUM PRIORITY)

### 11.1 CRM Integration
- Sync calls to Salesforce, HubSpot, Zoho
- Auto-create leads from calls
- Link calls to opportunities

### 11.2 WhatsApp Integration
- Send follow-up messages after call
- "Thanks for the call! Here's the link: [product]"

### 11.3 Calendar Integration
- Schedule follow-up calls in Google Calendar
- Reminder notifications

### 11.4 Slack/Teams Notifications
- "New call from high-priority customer → #sales channel"
- Manager gets alerts in Slack

---

## 🎨 12. UI/UX Improvements (ONGOING)

### 12.1 Dark Mode (Already Implemented ✓)
- Mobile app dark mode: ✓
- Dashboard dark mode: ✓

### 12.2 Customizable Dashboard
- Drag-and-drop widgets
- Manager chooses which metrics to show
- Save custom layouts

### 12.3 Offline Mode
- Cache recent calls on mobile
- View call history without internet
- Sync when back online

---

## 📞 Current Call Recording Flow (How It Works Now)

### Step-by-Step Process

#### 1. Call Happens
```
Employee makes/receives call
  ↓
Android OS automatically records (if phone has built-in recording)
  OR
Third-party app records (Google Phone, Truecaller, etc.)
```

#### 2. Recording Saved to Device
```
Recording saved to:
  /storage/emulated/0/Recordings/Call/
  /storage/emulated/0/CallRecordings/
  /storage/emulated/0/Vivo/CallRecord/
  ... etc. (varies by manufacturer)

File format:
  .mp3, .mp4, .m4a, .aac, .wav, .3gp, .amr
```

#### 3. Call Ends & Syncs
```
Call ends
  ↓
CallLogObserver detects change
  ↓
Mobile reads call metadata from Android CallLog
  ↓
Syncs to backend (POST /api/v1/calls/sync)
  ↓
Backend saves: call_id, phone, duration, etc.
  ↓
Recording status: "not_available" (initially)
```

#### 4. Recording Discovery (After Call)
```
Mobile searches for recording file:
  - Match by: timestamp, phone number, duration
  - Search in 15+ common recording directories
  - Use native RecordingModule (MediaStore API)

If found:
  → recording_path = "/storage/.../recording.mp3"
  → Update status: "recording_found"
```

#### 5. Privacy Checks (Before Upload)
```
Check 1: Recording enabled in Settings?
  ❌ No → Stop, status: "recording_disabled"
  ✅ Yes → Continue

Check 2: Call classified as "business"?
  ❌ No → Stop, status: "personal_call"
  ✅ Yes → Continue

Check 3: Number on excluded list?
  ✅ Yes → Stop, status: "excluded_number"
  ❌ No → Continue

✅ All checks passed → Proceed to upload
```

#### 6. Upload to Supabase Storage
```
POST /api/v1/calls/{call_id}/recording
Content-Type: audio/mp4
Authorization: Bearer <token>
Body: <binary audio data>

Backend:
  1. Validates file (size, format, magic bytes)
  2. Uploads to Supabase Storage:
     Path: {org_id}/{call_id}.mp4
  3. Updates database:
     - recording_available = true
     - recording_status = "uploaded"
     - recording_url = "{org_id}/{call_id}.mp4"
     - recording_size_bytes = 5242880
  4. Triggers transcription (background task)
```

#### 7. Transcription (Background)
```
Backend downloads recording from Supabase
  ↓
Runs Whisper AI model
  ↓
Generates transcript text
  ↓
Updates database:
  - transcript_text = "Hello, this is..."
  - transcript_status = "completed"
  ↓
Generates AI summary
  ↓
Updates database:
  - summary_text = "Customer inquired about pricing..."
  - summary_status = "completed"
```

#### 8. Dashboard Display
```
Manager opens call details
  ↓
Clicks "Play Recording"
  ↓
Frontend calls: GET /api/v1/calls/{call_id}/recording-url
  ↓
Backend generates signed URL (Supabase, 1 hour expiry)
  ↓
Frontend plays audio using signed URL
  ↓
Shows transcript below audio player
  ↓
Shows AI summary (key points, sentiment, action items)
```

---

## 🚨 Why Automatic Recording is Best

### ✅ Advantages of Automatic Recording

1. **Zero Friction**
   - Employee doesn't need to remember to press "Record"
   - No missed recordings due to human error
   - 100% call coverage

2. **Consistent Quality**
   - All calls recorded with same settings
   - No "I forgot to record that important call" situations

3. **Legal Compliance**
   - Easier to prove all calls were recorded (for regulated industries)
   - Complete audit trail

4. **Better Analytics**
   - Can analyze 100% of calls (not just selective ones)
   - Accurate performance metrics

### ⚠️ Disadvantages

1. **Privacy Concerns**
   - Personal calls accidentally recorded
   - **Solution**: Excluded numbers list + Business/Personal classification

2. **Storage Costs**
   - More recordings = more storage
   - **Solution**: Auto-delete after 90 days, compress recordings

3. **Employee Discomfort**
   - Feeling "watched" constantly
   - **Solution**: Transparency + recording indicator + easy toggle

---

## 💡 Recommended Approach (Best of Both Worlds)

### Hybrid System

```
Default: Automatic Recording ON
  ↓
Employee can:
  1. Disable via Settings (global OFF)
  2. Use Quick Toggle widget (per-session OFF)
  3. Add numbers to excluded list (never record specific contacts)
  4. Classify call as "Personal" before/after (prevents upload)

Visual Indicator:
  - Floating bubble shows "🔴 Recording" during call
  - Employee always knows recording status
  - Can tap bubble to pause/stop recording (future feature)
```

### Benefits
- ✅ Automatic by default (no missed calls)
- ✅ Employee has full control (privacy respected)
- ✅ Visual transparency (knows when recording)
- ✅ Quick toggle for personal calls (no friction)

---

## 📝 Implementation Priority

| Feature | Priority | Effort | Impact | Timeline |
|---------|----------|--------|--------|----------|
| 🔴 Recording Indicator | **HIGH** | Medium | High | Week 1-2 |
| 🔔 Smart Notifications | **HIGH** | Low | High | Week 1 |
| 🔒 Enhanced Privacy | **HIGH** | Medium | High | Week 2-3 |
| 🎙️ Quick Toggle Widget | **MEDIUM** | Medium | Medium | Week 3-4 |
| 💰 Usage-Based Billing | **MEDIUM** | High | Medium | Month 2 |
| 🌐 CRM Integration | **MEDIUM** | High | Medium | Month 2-3 |
| 🤖 AI Features | **LOW** | Very High | Medium | Month 3+ |
| 📊 Live Analytics | **LOW** | High | Low | Month 4+ |
| 🎯 Gamification | **LOW** | Medium | Low | Month 4+ |

---

## 🎯 Next Steps

### Immediate (Week 1-2)
1. ✅ Fix SIM configuration sync (DONE!)
2. 🔴 Implement recording indicator
3. 🔔 Add smart notifications

### Short-term (Month 1)
1. 🎙️ Quick toggle widget
2. 🔒 Enhanced privacy controls
3. 📱 UI/UX polish

### Medium-term (Month 2-3)
1. 💰 Billing dashboard
2. 🌐 CRM integrations
3. 📊 Advanced analytics

### Long-term (Month 3+)
1. 🤖 AI features
2. 📞 Advanced call features
3. 🎯 Gamification

---

## 📞 Questions for Client

1. **Recording Indicator**: Should we show it to employees, or keep recording silent?
2. **Privacy**: Should recording be opt-in (employee enables) or opt-out (enabled by default)?
3. **Consent**: Should we ask customer for consent before recording? (IVR: "Press 1 to consent")
4. **Storage**: How long should we keep recordings? 30 days? 90 days? Forever?
5. **Integrations**: Which CRM do they use? (Salesforce, Zoho, custom?)

---

**This document will be shared on GitHub for transparency and community feedback!** 🚀


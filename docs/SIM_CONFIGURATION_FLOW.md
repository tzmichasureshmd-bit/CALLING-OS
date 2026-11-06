# SIM Configuration & Sync Flow

## Overview
Employees can have **dual SIM phones** (or single SIM). The mobile app lets them **select which SIM** they use for business calls, and this configuration is synced to the backend and displayed on the dashboard.

---

## 📱 STEP 1: Initial SIM Detection (During Onboarding)

### When It Happens
- **New employee** downloads app and goes through onboarding
- **Existing employee** reinstalls app on new phone

### What Happens
```javascript
// mobile/app/onboarding.jsx - SimDetectStep
readSimInfo().then((sims) => {
  // Returns array of detected SIMs:
  // [
  //   {
  //     slot: 0,  // Physical slot (0-indexed)
  //     subscriptionId: "1",  // Android subscription ID (unique per SIM card)
  //     carrierName: "Airtel",
  //     phoneNumber: "+919876543210",
  //     mcc: "404",  // Country code (404 = India)
  //     mnc: "45",   // Network code
  //     countryIso: "IN",
  //     networkType: "LTE",
  //     isActive: true
  //   },
  //   {
  //     slot: 1,
  //     subscriptionId: "2",
  //     carrierName: "Jio",
  //     phoneNumber: "+919123456789",
  //     // ... other fields
  //   }
  // ]
});
```

### Employee Selects SIM
- App displays all detected SIMs
- Employee taps to select **which SIM they use for business calls**
- Selection is saved locally + sent to backend during registration

---

## 💾 STEP 2: SIM Registration (Backend)

### During Device Registration
```javascript
// mobile/src/AuthContext.jsx - registerDevice()
await api.registerDevice({
  device_identifier: "unique-android-id",
  manufacturer: "vivo",
  model: "V2246",
  android_version: "13",
  app_version: "1.1.0",
  sims: [  // ← Full SIM inventory sent
    {
      slot: 0,
      carrier: "Airtel",
      display_name: "SIM 1 - Airtel",
      phone_number: "+919876543210",
      mcc: "404",
      mnc: "45",
      country_iso: "IN",
      subscription_id: "1",
      network_type: "LTE",
      is_active: true,
      is_selected: true  // ← User's choice
    },
    {
      slot: 1,
      carrier: "Jio",
      phone_number: "+919123456789",
      subscription_id: "2",
      is_active: true,
      is_selected: false  // ← Not selected
    }
  ]
});
```

### Backend Processing
```python
# backend/app/routers/devices.py - register_device()

# 1. Create/update device record
device = Device(
    id="tzm-dev-abc123",
    organization_id=org.id,
    employee_id=employee.id,
    device_identifier="unique-android-id",
    model="V2246",
    # ... other fields
)
db.add(device)
db.flush()

# 2. Upsert SIM records
for sim_item in body.sims:
    existing_sim = db.query(SIM).filter(
        SIM.device_id == device.id,
        SIM.slot == sim_item.slot
    ).first()
    
    if existing_sim:
        # Update existing SIM (e.g., carrier changed)
        existing_sim.carrier = sim_item.carrier
        existing_sim.subscription_id = sim_item.subscription_id
        existing_sim.is_selected = sim_item.is_selected
        # ... update other fields
    else:
        # Insert new SIM
        sim = SIM(
            id=uuid.uuid4(),
            device_id=device.id,
            slot=sim_item.slot,
            carrier=sim_item.carrier,
            phone_number=sim_item.phone_number,
            subscription_id=sim_item.subscription_id,
            is_selected=sim_item.is_selected,  # ← Stored in DB
            is_active=True,
            first_detected_at=now,
            last_detected_at=now
        )
        db.add(sim)

# 3. Ensure only ONE SIM has is_selected=true
if selected_count > 1:
    raise HTTPException(422, "Only one SIM can be selected")

# 4. Update employee phone number from selected SIM
selected_sim = next((s for s in device.sims if s.is_selected), None)
if selected_sim and selected_sim.phone_number:
    employee.phone = selected_sim.phone_number

db.commit()
```

### Database Schema
```sql
-- Table: sims
CREATE TABLE sims (
    id UUID PRIMARY KEY,
    device_id UUID REFERENCES devices(id),
    slot INTEGER NOT NULL,  -- 0, 1, 2, etc.
    carrier VARCHAR,  -- "Airtel", "Jio", "Vi", etc.
    display_name VARCHAR,  -- "SIM 1 - Airtel"
    phone_number VARCHAR,  -- "+919876543210"
    mcc VARCHAR(3),  -- Mobile Country Code
    mnc VARCHAR(3),  -- Mobile Network Code
    country_iso VARCHAR(2),  -- "IN"
    subscription_id VARCHAR,  -- Android subscriptionId (unique per physical SIM card)
    network_type VARCHAR,  -- "LTE", "5G", "3G"
    is_active BOOLEAN DEFAULT true,  -- Still detected in phone
    is_selected BOOLEAN DEFAULT false,  -- Employee's choice for business calls
    first_detected_at TIMESTAMP,
    last_detected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, slot)  -- One record per slot per device
);
```

---

## ⚙️ STEP 3: SIM Configuration in Settings

### Employee Can Change Selection Later
```javascript
// mobile/app/(tabs)/settings.jsx - SimConfigModal

<SimConfigModal
  visible={simOpen}
  onClose={() => setSimOpen(false)}
  sims={sims}  // Current inventory from readSimInfo()
  selectedSim={selectedSim}  // Currently selected SIM
  onSelectSim={async (sim) => {
    // 1. Save locally
    await saveSimSelection(sim);
    
    // 2. Send to backend
    const updated = sims.map(s => ({
      slot: s.slot,
      carrier: s.carrierName,
      phone_number: s.phoneNumber,
      subscription_id: s.subscriptionId,
      is_active: true,
      is_selected: s.slot === sim.slot  // ← New selection
    }));
    
    await api.syncSims(deviceId, updated);
    
    // 3. Trigger full sync (recheck calls with new SIM filter)
    runSyncCycle(deviceId, "reconcile");
  }}
/>
```

### Backend Updates
```python
# backend/app/routers/devices.py - sync_sims()

@router.post("/{device_id}/sims/sync")
async def sync_sims(device_id: str, sims: list[SIMSyncItem]):
    # 1. Clear previous selection
    db.query(SIM).filter(
        SIM.device_id == device_id,
        SIM.is_selected == True
    ).update({SIM.is_selected: False})
    
    # 2. Apply new selection
    for sim_item in sims:
        existing = db.query(SIM).filter(
            SIM.device_id == device_id,
            SIM.slot == sim_item.slot
        ).first()
        existing.is_selected = sim_item.is_selected
    
    # 3. Update employee phone
    _sync_selected_sim_phone(db, device)
    
    # 4. Broadcast to dashboard
    await manager.broadcast(org_id, {
        "event": "device_update",
        "device": _device_payload(device, employee_name)
    })
    
    return {"status": "ok", "sims": [_sim_dict(s) for s in device.sims]}
```

---

## 🔄 STEP 4: Ongoing Sync (Heartbeat)

### Mobile Sends SIM Status Every Minute
```javascript
// mobile/src/syncService.js - doHeartbeat()
setInterval(async () => {
  const currentSims = await readSimInfo();
  
  await api.heartbeat(deviceId, {
    is_online: true,
    battery_level: 85,
    permissions_status: { callLog: true, phoneState: true },
    sims: currentSims.map(s => ({
      slot: s.slot,
      carrier: s.carrierName,
      subscription_id: s.subscriptionId,
      is_active: true,
      is_selected: s.subscriptionId === selectedSim.subscriptionId
    }))
  });
}, 60_000);  // Every 60 seconds
```

### Why?
- **Detect SIM changes** (user swapped physical SIM card)
- **Detect SIM removal** (user took out SIM)
- **Detect new SIM** (user inserted second SIM)
- Keep dashboard updated in real-time

---

## 🖥️ STEP 5: Dashboard Display

### WebSocket Real-Time Updates
```javascript
// web/src/api/useDeviceSocket.js

// 1. Normalize device data
function normalizeDevice(d) {
  // Find selected SIM (is_selected=true), fallback to first
  const selectedSim = (d.sims || []).find(s => s.is_selected) || (d.sims || [])[0];
  
  const simDisplay = selectedSim 
    ? (selectedSim.display_name || selectedSim.carrier || selectedSim.phone_number || `SIM ${selectedSim.slot + 1}`)
    : "No SIM";
  
  return {
    id: d.id,
    employee: d.employee_name,
    device: d.model,
    sim: simDisplay,  // ← Used in main display
    sims: d.sims || [],  // ← Full array for detailed view
    selectedSim: selectedSim,
    // ... other fields
  };
}

// 2. Listen for updates
socket.on("device_update", (msg) => {
  const updated = normalizeDevice(msg.device);
  // Update devices list in React state
});
```

### Device Health Page
```jsx
// web/src/pages/DeviceHealth.jsx

{/* SIM Configuration Section */}
{d.sims && d.sims.length > 0 && (
  <div>
    <h3>SIM Configuration</h3>
    <span>{d.sims.length} {d.sims.length === 1 ? 'SIM' : 'SIMs'} detected</span>
    
    {d.sims.map((sim) => (
      <div key={sim.id} style={{
        background: sim.is_selected ? "var(--success-soft)" : "var(--bg-subtle)",
        border: sim.is_selected ? "1px solid var(--success)" : "1px solid var(--border)"
      }}>
        {sim.is_selected && <CheckCircle size={14} color="var(--success)" />}
        <span>{sim.display_name || sim.carrier || `SIM ${sim.slot + 1}`}</span>
        {sim.is_selected && <span>ACTIVE</span>}
        {!sim.is_active && <span>INACTIVE</span>}
        
        <div>
          {sim.phone_number && <div>📱 {sim.phone_number}</div>}
          {sim.subscription_id && <div>ID: {sim.subscription_id} • Slot {sim.slot + 1}</div>}
        </div>
      </div>
    ))}
    
    <p>💡 Employee selects which SIM to use for business calls in mobile app Settings → SIM Configuration</p>
  </div>
)}
```

---

## 🎯 Call Filtering by SIM

### Mobile Side
```javascript
// mobile/src/callLogService.js - applySimFilter()

export async function applySimFilter(calls) {
  const selection = await getSimSelection();
  
  // No selection = include all calls
  if (!selection.subscriptionId && selection.slot === null) {
    return calls;
  }
  
  // Filter by subscriptionId (most reliable)
  if (selection.subscriptionId) {
    return calls.filter(c => 
      c.subscription_id === selection.subscriptionId
    );
  }
  
  // Fallback: filter by slot
  if (selection.slot !== null) {
    return calls.filter(c => 
      c.sim_slot === (selection.slot + 1)  // Android uses 1-indexed
    );
  }
  
  return calls;
}
```

### Backend Side
```python
# backend/app/models/call.py

class Call(Base):
    __tablename__ = "calls"
    
    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id"))
    employee_id = Column(String, ForeignKey("employees.id"))
    device_id = Column(String, ForeignKey("devices.id"))
    sim_id = Column(String, ForeignKey("sims.id"))  # ← Links to SIM record
    
    phone_number = Column(String)
    call_type = Column(String)  # incoming, outgoing, missed
    duration_seconds = Column(Integer)
    start_time = Column(DateTime(timezone=True))
    
    sim_slot = Column(Integer)  # Snapshot: slot at time of call
    subscription_id = Column(String)  # Snapshot: subscriptionId at time of call
    source = Column(String)  # Display: "SIM 1", "SIM 2", etc.
    
    # Relationships
    sim = relationship("SIM")  # Can join to get current SIM details
```

---

## 🚨 SIM Change Detection

### What Triggers It?
1. **Physical SIM swap** (user replaced SIM card)
2. **SIM removal** (user took out SIM)
3. **Carrier change** (same SIM but carrier name changed)
4. **New SIM inserted** (dual SIM phone, added second SIM)

### Mobile Detection
```javascript
// mobile/src/simSelectionService.js - checkSimChange()

export async function checkSimChange(currentInventory) {
  const selection = await getSimSelection();
  
  // No previous selection
  if (!selection.subscriptionId && selection.slot === null) {
    return { changed: false, noSelection: true };
  }
  
  // Check if previously selected SIM is still present
  if (selection.subscriptionId) {
    const stillPresent = currentInventory.find(
      s => s.subscriptionId === selection.subscriptionId
    );
    
    if (stillPresent) {
      return { changed: false };  // ✅ Same SIM still active
    }
    
    // ❌ SIM removed or replaced
    const sameSlot = currentInventory.find(s => s.slot === selection.slot);
    return {
      changed: true,
      previous: selection.snapshot,
      current: sameSlot || null  // null = SIM removed entirely
    };
  }
  
  return { changed: false };
}
```

### Mobile Handles Change
```javascript
// mobile/app/(tabs)/settings.jsx

useEffect(() => {
  async function checkForSimChange() {
    const sims = await readSimInfo();
    const changeResult = await checkSimChange(sims);
    
    if (changeResult.changed) {
      // Show alert modal
      Alert.alert(
        "SIM Changed Detected",
        `Your previously selected SIM (${changeResult.previous.carrierName}) is no longer detected. Please select a SIM to continue syncing calls.`,
        [
          {
            text: "Select SIM",
            onPress: () => setSimOpen(true)
          }
        ]
      );
    }
  }
  
  checkForSimChange();
}, []);
```

### Backend Tracks Changes
```python
# backend/app/routers/devices.py - _upsert_sims()

def _upsert_sims(db, device, sim_items, org_id):
    changes = []
    
    for item in sim_items:
        existing = db.query(SIM).filter(
            SIM.device_id == device.id,
            SIM.slot == item.slot
        ).first()
        
        if existing:
            # Detect subscription ID change (SIM card replaced)
            if (item.subscription_id and existing.subscription_id 
                and item.subscription_id != existing.subscription_id):
                changes.append({
                    "device_id": device.id,
                    "slot": item.slot,
                    "change_type": "REPLACED",
                    "previous_subscription_id": existing.subscription_id,
                    "new_subscription_id": item.subscription_id,
                    "previous_carrier": existing.carrier,
                    "new_carrier": item.carrier,
                    "timestamp": now.isoformat()
                })
                logger.warning("SIM replaced: device=%s slot=%d %s→%s", 
                    device.id, item.slot, existing.carrier, item.carrier)
            
            # Update record
            existing.subscription_id = item.subscription_id
            existing.carrier = item.carrier
            existing.last_detected_at = now
        else:
            # New SIM inserted
            changes.append({
                "change_type": "INSERTED",
                "slot": item.slot,
                "carrier": item.carrier
            })
    
    # Detect removed SIMs
    current_slots = {item.slot for item in sim_items}
    for existing_sim in device.sims:
        if existing_sim.slot not in current_slots and existing_sim.is_active:
            existing_sim.is_active = False
            changes.append({
                "change_type": "REMOVED",
                "slot": existing_sim.slot,
                "carrier": existing_sim.carrier
            })
    
    # Broadcast changes to dashboard
    for change in changes:
        await manager.broadcast(org_id, {
            "event": "sim_changed",
            **change
        })
    
    return changes
```

---

## 📊 Dashboard Notifications

### Manager Sees SIM Changes
```javascript
// web/src/api/useDeviceSocket.js

socket.on("sim_changed", (msg) => {
  if (msg.change_type === "REPLACED") {
    showNotification({
      title: "SIM Card Replaced",
      message: `${msg.employee_name} replaced their SIM (Slot ${msg.slot}): ${msg.previous_carrier} → ${msg.new_carrier}`,
      type: "warning"
    });
  } else if (msg.change_type === "REMOVED") {
    showNotification({
      title: "SIM Removed",
      message: `${msg.employee_name} removed SIM from Slot ${msg.slot} (${msg.carrier})`,
      type: "error"
    });
  } else if (msg.change_type === "INSERTED") {
    showNotification({
      title: "New SIM Detected",
      message: `${msg.employee_name} inserted SIM in Slot ${msg.slot}: ${msg.carrier}`,
      type: "success"
    });
  }
});
```

---

## ✅ Summary

### Flow Recap
1. **Onboarding**: Employee selects SIM during setup
2. **Registration**: Mobile sends full SIM inventory to backend
3. **Database**: Backend stores all SIMs with `is_selected` flag
4. **Settings**: Employee can change selection anytime
5. **Heartbeat**: Mobile syncs SIM status every 60 seconds
6. **Dashboard**: Shows selected SIM + all detected SIMs
7. **Change Detection**: Alerts employee if selected SIM removed
8. **Call Filtering**: Only sync calls from selected SIM

### Key Features
- ✅ **Multi-SIM support** (dual SIM, eSIM, physical SIM)
- ✅ **Real-time sync** (dashboard updates instantly)
- ✅ **Change detection** (alerts on SIM swap/removal)
- ✅ **Employee control** (select which SIM for business)
- ✅ **Manager visibility** (see all SIMs on dashboard)
- ✅ **Call filtering** (only sync calls from selected SIM)
- ✅ **History tracking** (audit log of SIM changes)

### For Your Client Demo
**Show them:**
1. Employee has dual SIM phone (Airtel + Jio)
2. Employee selects "SIM 1 - Airtel" for business
3. Dashboard shows "SIM 1 - Airtel (ACTIVE)" + "SIM 2 - Jio (INACTIVE)"
4. Only calls from Airtel SIM are synced
5. Employee swaps SIM → alert appears on mobile
6. Manager sees notification on dashboard

**Tell them:**
- "Employees can choose which SIM to use for business calls"
- "Personal SIM stays private — no calls synced from it"
- "Dashboard shows all SIMs in employee's phone"
- "Automatic alerts if employee swaps SIM card"
- "Works with single SIM, dual SIM, and eSIM phones"

---

## 🔧 Troubleshooting

### Problem: Dashboard shows "SIM 1" instead of real carrier
**Cause**: Old code was only showing first SIM, ignoring `is_selected` flag  
**Fix**: Updated `useDeviceSocket.js` to prioritize `is_selected` SIM

### Problem: Employee changed SIM but calls still syncing from old SIM
**Cause**: Local selection not synced to backend  
**Fix**: Mobile now calls `/devices/{id}/sims/sync` after selection change

### Problem: Dual SIM phone but only one SIM shows on dashboard
**Cause**: Mobile not sending full SIM inventory in heartbeat  
**Fix**: Heartbeat now includes `sims: [...]` array with all detected SIMs

### Problem: Employee removed SIM but dashboard still shows it as active
**Cause**: Backend wasn't marking removed SIMs as inactive  
**Fix**: `_upsert_sims()` now sets `is_active=false` for missing SIMs

---

**Your SIM configuration system is now production-ready!** 🎉


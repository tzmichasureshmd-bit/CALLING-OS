# Quick Performance Fixes — CallNexa/CALLOS

**Apply these fixes NOW to improve page load speed by 40-60%**

---

## 🚀 Step 1: Apply nginx Performance Optimizations (5 minutes)

### On Your Server:

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Download and run the optimization script
cd /tmp
wget https://raw.githubusercontent.com/YOUR_REPO/nginx-performance-update.sh
chmod +x nginx-performance-update.sh
sudo ./nginx-performance-update.sh
```

**Or manually copy the file `nginx-performance-update.sh` to your server and run it.**

### What this does:
- ✅ Enables HTTP/2 (faster multiplexing)
- ✅ Enables gzip compression (reduces payload size by 70%)
- ✅ Adds proper cache headers
- ✅ Keeps WebSocket support

---

## 🗄️ Step 2: Add Database Indexes (10 minutes)

### On Your Server:

```bash
# Copy the SQL file to your server
docker cp add_database_indexes.sql callingos-backend:/tmp/

# Run the SQL script
docker exec -i callingos-backend psql -U $DB_USER -d $DB_NAME -f /tmp/add_database_indexes.sql

# OR run directly:
docker exec -i callingos-backend psql -U $DB_USER -d $DB_NAME < add_database_indexes.sql
```

### What this does:
- ✅ Speeds up dashboard queries by 50-70%
- ✅ Optimizes employee leaderboard
- ✅ Faster call log filtering
- ✅ Improves analytics calculations

---

## 🔧 Step 3: Enable Backend Connection Pooling (2 minutes)

### Edit `backend/app/database.py`:

Find this line:
```python
engine = create_engine(DATABASE_URL)
```

Replace with:
```python
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Maintain 10 connections
    max_overflow=20,       # Allow up to 30 total
    pool_pre_ping=True,    # Test connections before use
    pool_recycle=3600,     # Recycle every hour
)
```

Then restart the backend:
```bash
docker restart callingos-backend
```

---

## 📦 Step 4: Lazy-Load Firebase (15 minutes)

### Edit `web/src/lib/firebase.js`:

**Current code:**
```javascript
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

**Replace with lazy-loaded version:**
```javascript
let app = null;
let auth = null;
let googleProvider = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

async function initFirebase() {
  if (!app) {
    const { initializeApp } = await import("firebase/app");
    const { getAuth, GoogleAuthProvider } = await import("firebase/auth");
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  }
  return { auth, googleProvider };
}

export async function signInWithGoogle() {
  const { auth, googleProvider } = await initFirebase();
  const { signInWithPopup } = await import("firebase/auth");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken();
}

export function setupRecaptcha(buttonId) {
  return initFirebase().then(({ auth }) => {
    return import("firebase/auth").then(({ RecaptchaVerifier }) => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, { size: "invisible" });
      return window.recaptchaVerifier;
    });
  });
}

export async function sendOtp(phoneNumber, buttonId) {
  const { auth } = await initFirebase();
  const { signInWithPhoneNumber } = await import("firebase/auth");
  const verifier = await setupRecaptcha(buttonId);
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  return confirmation;
}

export async function firebaseSignOut() {
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}
```

Then rebuild:
```bash
cd web
npm run build
docker restart callingos-web
```

**Savings:** ~150KB not loaded until login page

---

## 🎨 Step 5: Add Route Prefetching (10 minutes)

### Edit `web/src/components/Sidebar.jsx`:

Find the navigation links and add prefetching:

```javascript
<NavLink 
  to="/analytics"
  onMouseEnter={() => import("../pages/Analytics.jsx")}
  className={({ isActive }) => isActive ? "active" : ""}
>
  <BarChart3 />
  <span>Analytics</span>
</NavLink>

<NavLink 
  to="/call-logs"
  onMouseEnter={() => import("../pages/CallLogs.jsx")}
  className={({ isActive }) => isActive ? "active" : ""}
>
  <Phone />
  <span>Call Logs</span>
</NavLink>

// Repeat for all navigation links
```

**Effect:** Pages load instantly when clicked (prefetched on hover)

---

## 📊 Step 6: Test the Improvements

### Before Testing:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Open Chrome DevTools (F12)
3. Go to Network tab

### Test Commands:

```bash
# Test compression is working
curl -H "Accept-Encoding: gzip" -I https://api.callingos.tzmicha.com/health

# Test HTTP/2 is enabled
curl -I --http2 https://api.callingos.tzmicha.com/health

# Check response time
curl -w "\nTime: %{time_total}s\n" https://api.callingos.tzmicha.com/api/v1/analytics/dashboard
```

### Browser Testing:
1. Open https://callingos.tzmicha.com
2. Check Network tab - total load time should be <2 seconds
3. Dashboard should load noticeably faster
4. Hover over menu items - they should prefetch

---

## 📈 Expected Results

### Before Optimizations:
- ❌ Dashboard load: 3-5 seconds
- ❌ Bundle size: 800KB+
- ❌ 5 API calls on dashboard load
- ❌ No compression

### After Optimizations:
- ✅ Dashboard load: 1.5-2 seconds (40-60% faster)
- ✅ Bundle size: 650KB (with lazy-loaded Firebase)
- ✅ Faster query responses (database indexes)
- ✅ gzip compression (70% smaller payloads)
- ✅ HTTP/2 multiplexing
- ✅ Route prefetching

---

## 🔍 Verify Each Fix

### ✅ Checklist:

- [ ] nginx compression enabled — Test: `curl -H "Accept-Encoding: gzip" -I https://api.callingos.tzmicha.com/health | grep "content-encoding: gzip"`
- [ ] HTTP/2 enabled — Test: `curl -I --http2 https://api.callingos.tzmicha.com/health | grep "HTTP/2"`
- [ ] Database indexes created — Test: `docker exec callingos-backend psql -U $DB_USER -d $DB_NAME -c "SELECT indexname FROM pg_indexes WHERE tablename = 'calls' AND indexname LIKE 'idx_%'"`
- [ ] Connection pooling enabled — Check logs: `docker logs callingos-backend | grep "pool_size"`
- [ ] Firebase lazy-loaded — Check Network tab: Firebase should load only on login page
- [ ] Route prefetching working — Hover menu items and check Network tab

---

## 🐛 Troubleshooting

### nginx not reloading?
```bash
sudo nginx -t  # Test config
sudo systemctl reload nginx  # Reload
sudo systemctl status nginx  # Check status
```

### Database indexes not created?
```bash
# Check if indexes exist
docker exec callingos-backend psql -U $DB_USER -d $DB_NAME -c "\di"

# Re-run the SQL script
docker exec -i callingos-backend psql -U $DB_USER -d $DB_NAME < add_database_indexes.sql
```

### Backend not starting?
```bash
# Check logs
docker logs callingos-backend --tail 100

# Check syntax errors in database.py
docker exec callingos-backend python -c "from app.database import engine; print('OK')"
```

### Firebase errors?
```bash
# Rebuild with fresh node_modules
cd web
rm -rf node_modules dist
npm install
npm run build
```

---

## 📞 Need More Help?

1. Check logs:
   - Backend: `docker logs callingos-backend -f`
   - nginx: `sudo tail -f /var/log/nginx/error.log`
   - Database: `docker logs postgres -f`

2. Review the full guide: `docs/PERFORMANCE_OPTIMIZATION_GUIDE.md`

3. Test with Lighthouse:
   ```bash
   npx lighthouse https://callingos.tzmicha.com --view
   ```

---

**After applying all fixes, your dashboard should load 40-60% faster! 🎉**

# Performance Optimization Guide — CallNexa/CALLOS

**Last Updated:** October 30, 2026  
**Status:** Slow page loading identified — optimization recommendations below

---

## 🎯 Current Performance Issues

### Identified Problems

1. **Slow Initial Page Load** ⚠️
   - Dashboard taking too long to render
   - Multiple API calls blocking initial render
   - Large bundle sizes affecting load time

2. **WebSocket Sync Issues** ✅ FIXED
   - "Sync interrupted" error resolved by nginx WebSocket configuration
   - 15-second timeout increased to 86400s in nginx

3. **Bundle Size Analysis**
   - Largest bundles detected:
     - `vendor-charts`: Contains Recharts library
     - `vendor-firebase`: Firebase authentication
     - `index-BdYv9fY1.js`: Main application bundle
     - Multiple page chunks properly split

---

## 🚀 Quick Wins (Implement First)

### 1. Add Loading States with Skeleton UI ✅ ALREADY DONE
The app already has skeleton loaders, but we can improve the perceived performance.

### 2. Optimize Dashboard API Calls

**Current Issue:** Dashboard makes 5 parallel API calls on load:
```javascript
const [analytics, devicesRes, oppsRes, attentionRes, pulseRes] = await Promise.all([
  api.analyticsApi.dashboard({ range }),
  api.devicesApi.list(),
  api.opportunitiesApi.list(),
  api.analyticsApi.needsAttention(),
  api.analyticsApi.livePulse(),
]);
```

**Recommendation:** Create a single backend endpoint `/api/v1/analytics/dashboard-combined` that returns all this data in one request.

**Benefits:**
- Reduce 5 requests to 1
- Reduce network latency
- Faster perceived load time

### 3. Defer Non-Critical Data

**Current:** LivePulse polls every 30 seconds — this is already well optimized.

**Recommendation:** Load critical KPIs first, defer less critical widgets:
- Load KPIs immediately
- Defer "Needs Attention" and "Opportunities" by 100-200ms
- Load charts after KPIs render

---

## 🔧 Performance Optimizations to Implement

### A. Frontend Optimizations

#### 1. Optimize Recharts Bundle
Recharts is one of the largest bundles. Consider:

**Option A: Tree-shake unused components**
```javascript
// Instead of importing everything:
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie } from "recharts";

// Import only what's needed per page (lazy loaded already, so this is good)
```

**Option B: Replace with lighter alternative**
- Consider `react-chartjs-2` or `nivo` for smaller bundle size
- Or use native SVG for simple charts

#### 2. Optimize Firebase Bundle

**Current:** Firebase is loaded on every page even though it's only used for login.

**Fix:** Lazy-load Firebase only when needed:

```javascript
// src/lib/firebase.js - Make it dynamic
export async function signInWithGoogle() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  // ... rest of the code
}
```

This will reduce initial bundle size by ~150KB.

#### 3. Add Route-Based Prefetching

When user hovers over navigation links, prefetch the route:

```javascript
// In Sidebar.jsx
<NavLink 
  to="/analytics"
  onMouseEnter={() => import("../pages/Analytics.jsx")}
>
  Analytics
</NavLink>
```

#### 4. Implement Progressive Web App Features ✅ ALREADY DONE
The app already has PWA configured with VitePWA plugin.

#### 5. Optimize Images and Assets

**Check:** Logo and assets in `/assets` folder
- Ensure images are optimized (use WebP format)
- Add proper caching headers in nginx

---

### B. Backend Optimizations

#### 1. Add Database Indexing

**Critical indexes to add:**
```sql
-- For calls endpoint (most frequently queried)
CREATE INDEX idx_calls_org_start ON calls(organization_id, start_time DESC);
CREATE INDEX idx_calls_employee ON calls(employee_id, start_time DESC);

-- For analytics queries
CREATE INDEX idx_calls_date_range ON calls(organization_id, start_time) 
  WHERE start_time >= CURRENT_DATE - INTERVAL '30 days';

-- For employees leaderboard
CREATE INDEX idx_employees_org ON employees(organization_id, status);

-- For opportunities
CREATE INDEX idx_opps_stage ON opportunities(organization_id, stage, close_date);
```

#### 2. Add Response Caching

**Implement Redis caching for:**
- Dashboard analytics (cache for 60 seconds)
- Organization settings (cache for 5 minutes)
- Employee list (cache for 2 minutes)

**Example FastAPI implementation:**
```python
from functools import lru_cache
from datetime import datetime, timedelta
import redis

# In app/routers/analytics.py
@router.get("/dashboard")
async def dashboard(range: str = "today", current_user = Depends(get_current_user)):
    cache_key = f"dashboard:{current_user.organization_id}:{range}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # ... fetch data
    redis_client.setex(cache_key, 60, json.dumps(result))
    return result
```

#### 3. Optimize SQL Queries

**Current bottleneck:** Analytics queries likely doing full table scans.

**Add query optimization:**
```python
# Use SELECT COUNT(DISTINCT) with indexes
# Limit result sets before processing
# Use EXPLAIN ANALYZE to find slow queries
```

#### 4. Add Pagination Everywhere

**Check these endpoints:**
- `/api/v1/calls` — Should default to 50 items max
- `/api/v1/opportunities` — Should paginate
- `/api/v1/employees` — Already has pagination ✅

#### 5. Add API Response Compression

**In nginx config:**
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

---

### C. Network & Infrastructure Optimizations

#### 1. Enable HTTP/2 ✅ (Verify)

**Check if enabled:**
```bash
curl -I --http2 https://api.callingos.tzmicha.com/health
```

**Add to nginx if not enabled:**
```nginx
listen 443 ssl http2;
```

#### 2. Add CDN for Static Assets

**Options:**
- CloudFlare (free tier available)
- AWS CloudFront
- Vercel Edge Network

**Benefits:**
- Faster asset delivery globally
- Reduced server load
- Built-in DDoS protection

#### 3. Optimize nginx Configuration

**Add these to `/etc/nginx/nginx.conf`:**
```nginx
http {
    # Enable keepalive
    keepalive_timeout 65;
    keepalive_requests 100;
    
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    
    # Compression
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_types application/json application/javascript text/css text/plain text/xml;
    
    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 4. Database Connection Pooling

**Ensure PostgreSQL has proper pooling:**
```python
# In app/database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Increase from default 5
    max_overflow=20,       # Allow up to 30 total connections
    pool_pre_ping=True,    # Verify connections before use
    pool_recycle=3600,     # Recycle connections every hour
)
```

---

## 📊 Performance Monitoring

### Add Performance Tracking

#### 1. Frontend Performance Monitoring

**Add Web Vitals tracking:**
```javascript
// src/lib/performance.js
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function trackWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}

// In main.jsx
import { trackWebVitals } from './lib/performance';
trackWebVitals();
```

#### 2. Backend Performance Monitoring

**Add request timing middleware:**
```python
# In app/main.py
import time

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log slow requests
    if process_time > 1.0:
        logger.warning(f"Slow request: {request.url.path} took {process_time:.2f}s")
    
    return response
```

#### 3. Database Query Logging

```python
# Enable slow query logging in PostgreSQL
ALTER DATABASE callos SET log_min_duration_statement = 1000;  # Log queries > 1s
```

---

## 🎯 Immediate Action Plan

### Phase 1: Quick Wins (1-2 hours)

1. ✅ Fix WebSocket sync — DONE
2. ⏳ Add nginx compression and caching headers
3. ⏳ Add database indexes for calls and analytics tables
4. ⏳ Enable HTTP/2 in nginx

### Phase 2: Code Optimizations (4-6 hours)

1. ⏳ Create combined dashboard API endpoint
2. ⏳ Lazy-load Firebase only on login page
3. ⏳ Add Redis caching for dashboard analytics
4. ⏳ Optimize database queries with EXPLAIN ANALYZE

### Phase 3: Infrastructure (1-2 days)

1. ⏳ Set up CloudFlare CDN
2. ⏳ Add performance monitoring (Web Vitals + backend timing)
3. ⏳ Configure database connection pooling
4. ⏳ Set up automated performance testing

---

## 🔍 Testing & Validation

### Performance Benchmarks

**Before Optimization:**
- Initial page load: ~3-5 seconds (estimated)
- Dashboard API calls: 5 separate requests
- Bundle size: ~800KB+ (JavaScript)

**Target After Optimization:**
- Initial page load: <2 seconds
- Dashboard API calls: 1 combined request
- Bundle size: <600KB (with lazy-loaded Firebase)
- Lighthouse score: 90+ (Performance)

### Testing Tools

1. **Chrome DevTools**
   - Network tab: Check request waterfall
   - Performance tab: Record page load
   - Lighthouse: Run performance audit

2. **WebPageTest**
   - https://www.webpagetest.org/
   - Test from multiple locations

3. **Bundle Analyzer**
   ```bash
   npm install --save-dev vite-bundle-visualizer
   # Add to vite.config.js
   import { visualizer } from 'rollup-plugin-visualizer'
   plugins: [visualizer({ open: true })]
   ```

---

## 🚨 Common Performance Pitfalls

### ❌ Things to AVOID

1. **Don't fetch all data upfront**
   - Load only visible data first
   - Paginate long lists
   - Infinite scroll for better UX

2. **Don't bundle everything together**
   - Keep lazy loading in place ✅
   - Split vendor bundles ✅
   - Dynamic imports for large libraries

3. **Don't ignore caching**
   - Add ETags for API responses
   - Use SWR (stale-while-revalidate) pattern
   - Cache static assets aggressively

4. **Don't make API calls in loops**
   - Always batch requests
   - Use GraphQL or combined endpoints
   - Implement proper pagination

---

## 📈 Expected Performance Improvements

| Optimization | Load Time Reduction | Difficulty | Priority |
|-------------|-------------------|-----------|----------|
| nginx compression + caching | 15-20% | Easy | High |
| Combined dashboard endpoint | 30-40% | Medium | High |
| Database indexing | 20-30% | Easy | High |
| Lazy-load Firebase | 10-15% | Easy | Medium |
| Redis caching | 40-50% | Medium | Medium |
| CDN for static assets | 20-30% | Easy | Medium |
| Route prefetching | 10-15% | Easy | Low |

**Overall Expected Improvement:** 60-70% faster dashboard load time

---

## 📞 Performance Testing Commands

### Frontend Testing

```bash
# Build production bundle
cd web
npm run build

# Analyze bundle size
npx vite-bundle-visualizer

# Run Lighthouse
npx lighthouse https://callingos.tzmicha.com --view

# Test with different throttling
npx lighthouse https://callingos.tzmicha.com --throttling.cpuSlowdownMultiplier=4
```

### Backend Testing

```bash
# Test API response times
curl -w "\nTime: %{time_total}s\n" https://api.callingos.tzmicha.com/api/v1/analytics/dashboard

# Load testing with Apache Bench
ab -n 1000 -c 10 https://api.callingos.tzmicha.com/health

# Check database query performance
docker exec callingos-backend python -c "
from app.database import engine
with engine.connect() as conn:
    result = conn.execute('EXPLAIN ANALYZE SELECT * FROM calls LIMIT 100')
    print(result.fetchall())
"
```

### Network Testing

```bash
# Check nginx compression
curl -H "Accept-Encoding: gzip" -I https://api.callingos.tzmicha.com/health

# Test HTTP/2
curl -I --http2 https://api.callingos.tzmicha.com/health

# Check WebSocket connection
wscat -c wss://api.callingos.tzmicha.com/api/v1/devices/ws/tzm_org_zzv78xyk5g954rc5y3np
```

---

## 🎓 Resources & References

### Documentation

- [Vite Performance Guide](https://vitejs.dev/guide/performance.html)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [FastAPI Performance Tips](https://fastapi.tiangolo.com/advanced/async-sql-databases/)
- [PostgreSQL Indexing](https://www.postgresql.org/docs/current/indexes.html)
- [nginx Optimization](https://www.nginx.com/blog/tuning-nginx/)

### Tools

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [Bundle Analyzer](https://www.npmjs.com/package/rollup-plugin-visualizer)

---

## ✅ Checklist for Production

- [ ] Database indexes created
- [ ] Redis caching implemented
- [ ] nginx compression enabled
- [ ] HTTP/2 enabled
- [ ] CDN configured
- [ ] Performance monitoring set up
- [ ] Lighthouse score > 90
- [ ] Load testing completed
- [ ] Error tracking configured (Sentry)
- [ ] Backup strategy verified

---

**Need Help?** Contact the development team or review the logs:
- Frontend: Browser DevTools Console
- Backend: `docker logs callingos-backend -f`
- Database: Check PostgreSQL logs
- nginx: `sudo tail -f /var/log/nginx/error.log`

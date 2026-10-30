# ✅ CALLOS Deployment Checklist

Use this checklist before sharing APK or deploying to production.

---

## Pre-Deployment Testing

### Backend
- [ ] Backend starts without errors: `uvicorn app.main:app --reload`
- [ ] Health check passes: `curl http://localhost:8000/health`
- [ ] Database health: `curl http://localhost:8000/health/db`
- [ ] API docs load: `http://localhost:8000/docs`
- [ ] No startup warnings in logs

### Database
- [ ] PostgreSQL is running
- [ ] Can connect: `psql postgresql://user:pass@localhost:5432/callos`
- [ ] Tables exist: `SELECT * FROM pg_tables WHERE schemaname='public';`
- [ ] Migrations applied: `SELECT * FROM alembic_version;` (or similar)
- [ ] No data corruption: `PRAGMA integrity_check;` (or equivalent)

### Web Dashboard
- [ ] Starts without errors: `npm run dev`
- [ ] Loads at http://localhost:5173
- [ ] No console errors (F12)
- [ ] API connects to backend
- [ ] Responsive on mobile size

### Mobile App
- [ ] Starts in Expo: `npx expo start`
- [ ] No build errors
- [ ] Loads in emulator or physical device
- [ ] Can read Android call log (on device)
- [ ] Can register account

---

## E2E Testing

### Automated Tests
- [ ] `python test_e2e_sync.py` passes all 10 tests
- [ ] No database errors
- [ ] No authentication errors
- [ ] No sync failures

### Manual Mobile Testing
- [ ] Can register new account
- [ ] Device ID appears in Settings tab
- [ ] Permissions show as granted/denied correctly
- [ ] "Last Sync" updates every 15 seconds

### Dashboard Testing
- [ ] Can login on web
- [ ] Call Logs page loads
- [ ] Analytics dashboard shows data
- [ ] Filters work (date range, employee, call type)
- [ ] Real-time updates work (WebSocket connected)

---

## APK Building

### Pre-Build
- [ ] Expo account created and logged in: `eas login`
- [ ] Project linked: `eas project:info`
- [ ] `eas.json` configured correctly
- [ ] `app.json` has all permissions
- [ ] No uncommitted code changes (clean git status)

### Build Process
- [ ] Build starts: `eas build -p android --profile customClient`
- [ ] No compilation errors
- [ ] Build completes successfully
- [ ] Download link generated

### Post-Build
- [ ] Download APK link works
- [ ] APK file size is reasonable (>50MB)
- [ ] Can install on test device: `adb install callingos.apk`
- [ ] App launches without crashing
- [ ] Permissions request works

---

## Team Distribution

### Before Sharing
- [ ] APK tested on at least 2 Android devices
- [ ] No known critical bugs
- [ ] Instructions written clearly
- [ ] Download link is public/shareable
- [ ] Support contact documented

### Documentation
- [ ] Setup instructions included
- [ ] Company code provided (`TZM-2026-5823`)
- [ ] Backend endpoint URL included
- [ ] Known issues listed
- [ ] Support contact/channel specified

### Distribution
- [ ] APK link shared via email/Slack
- [ ] QR code generated (from Expo)
- [ ] Installation instructions included
- [ ] First user signup tested
- [ ] Feedback channel established

---

## Production Deployment

### Environment
- [ ] Production database configured
- [ ] Production Supabase storage set up
- [ ] Production OpenAI API key configured
- [ ] Firebase credentials in place
- [ ] JWT secret changed from default

### Security
- [ ] CORS origins restricted to production domains
- [ ] JWT secret is strong (>32 chars)
- [ ] Database credentials secured
- [ ] API keys not in source code
- [ ] HTTPS enabled on all endpoints

### Performance
- [ ] Database indexed properly
- [ ] Connection pooling configured
- [ ] Rate limiting enabled
- [ ] Caching configured
- [ ] Load tested (or at least smoke tested)

### Monitoring
- [ ] Error logging configured
- [ ] Request logging enabled
- [ ] Database monitoring set up
- [ ] Alerts configured for failures
- [ ] Backup strategy in place

### Docker/Deployment
- [ ] Docker builds without errors
- [ ] `docker-compose up` works
- [ ] Services communicate correctly
- [ ] Volumes persist data
- [ ] Environment variables properly set
- [ ] Secrets not in compose file

---

## Post-Deployment Validation

### Production Backend
- [ ] Health check passes
- [ ] Database connected
- [ ] Supabase storage accessible
- [ ] OpenAI API working
- [ ] No error logs

### Production Web
- [ ] Dashboard loads
- [ ] Can login with production user
- [ ] Can view calls
- [ ] Analytics show data
- [ ] Real-time updates work

### Production Mobile
- [ ] App connects to production API
- [ ] Can register with production backend
- [ ] Can sync calls
- [ ] Calls appear on dashboard within 15 seconds

### End-to-End Flow
- [ ] User: Register account
- [ ] User: Receive/make a call
- [ ] User: Open app → See call in Logs
- [ ] Admin: Login to dashboard
- [ ] Admin: View employee's calls
- [ ] Admin: See analytics updated

---

## Rollback Plan

If something breaks in production:

### Quick Rollback
- [ ] Previous APK build link saved
- [ ] Previous Docker image tagged
- [ ] Database backup available
- [ ] Rollback instructions documented

### Communication
- [ ] Team notified of issue
- [ ] Support updated on status
- [ ] Rollback decision made
- [ ] Rollback executed
- [ ] Post-mortem scheduled

---

## Sign-Off

### Development Team
- [ ] Code reviewed and tested
- [ ] E2E tests passing
- [ ] No known critical bugs
- [ ] Ready for team testing

**Developer Name:** _______________
**Date:** _______________
**Sign:** _______________

### QA Team
- [ ] Manual tests completed
- [ ] Performance acceptable
- [ ] No security issues found
- [ ] Ready for production

**QA Name:** _______________
**Date:** _______________
**Sign:** _______________

### Product Manager
- [ ] Requirements met
- [ ] User experience acceptable
- [ ] All features working
- [ ] Approved for release

**PM Name:** _______________
**Date:** _______________
**Sign:** _______________

---

## Notes

Add any deployment-specific notes here:

```
[Space for notes]
```

---

## Useful Commands

```bash
# View backend logs
tail -f backend/backend.log

# Check database
psql postgresql://user:pass@localhost:5432/callos -c "SELECT COUNT(*) FROM calls;"

# Test mobile API
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/v1/calls

# Build APK locally
cd mobile && eas build -p android --profile customClient --local

# View running containers
docker ps

# View Docker logs
docker logs -f callingos-backend

# Stop everything
docker compose down
```

---

## Support Contacts

- **Developer Lead:** [Name/Email]
- **DevOps:** [Name/Email]
- **Product Manager:** [Name/Email]
- **QA Lead:** [Name/Email]

---

Use this checklist for every deployment!

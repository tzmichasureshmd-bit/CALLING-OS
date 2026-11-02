# Demo Quick Start Guide
## Get Your Demo Running in 30 Minutes

---

## 🚀 Super Fast Setup (For Immediate Demo)

### Step 1: Run Setup Script (5 minutes)

**On Windows:**
```powershell
cd "c:\Users\danie\Desktop\CALL OSS"
.\setup_demo.ps1
```

**On Linux/Mac:**
```bash
cd ~/path/to/CALL-OSS
chmod +x setup_demo.sh
./setup_demo.sh
```

This script will:
- ✅ Create PostgreSQL database
- ✅ Run migrations
- ✅ Seed 100 employees + 500 calls
- ✅ Start backend server
- ✅ Start frontend server

### Step 2: Access Demo (1 minute)

1. Open browser: **http://localhost:5173**
2. Login with: **admin@techsales.com** / **Demo2024!**
3. 🎉 You're in!

### Step 3: Test It Works (5 minutes)

- [ ] Click "Calls" - should see 500+ calls
- [ ] Click "Employees" - should see 100 employees
- [ ] Click "Devices" - should see 100 devices
- [ ] Click "Analytics" - should see charts
- [ ] Play a call recording (if available)
- [ ] Try search and filters

---

## 📱 Optional: Android App Demo

If you want to show the mobile app making real calls:

1. Build APK:
```bash
cd android
./gradlew assembleRelease
```

2. Install on phone:
```bash
adb install app/build/outputs/apk/release/app-release.apk
```

3. Configure in app:
   - API URL: `http://your-server-ip:8000`
   - Login: `sales1@techsales.com` / `Demo2024!`

4. Make a test call and watch it appear in dashboard!

---

## 📚 Full Documentation

Now that your demo is running, review these documents:

### For Technical Setup
- **[DEMO_SETUP_GUIDE.md](./DEMO_SETUP_GUIDE.md)** - Complete setup instructions
  - Production deployment
  - Large-scale demo (5,000 users)
  - Troubleshooting

### For Presentation
- **[DEMO_PRESENTATION_CHECKLIST.md](./DEMO_PRESENTATION_CHECKLIST.md)** - Step-by-step demo guide
  - Pre-demo checklist
  - Presentation script
  - Q&A handling
  - Follow-up timeline

### For Sales Discussion
- **[ROI_CALCULATOR.md](./ROI_CALCULATOR.md)** - Financial justification
  - ROI calculations
  - Cost comparisons
  - Value proposition
  - Pricing models

---

## 🎯 Demo Scenarios

### Scenario 1: Quick 10-Minute Demo
**Perfect for: Initial interest, busy executives**

1. **Login** - Show dashboard (1 min)
2. **Calls page** - Show call list and filters (3 min)
3. **Employee page** - Show one employee's history (2 min)
4. **Analytics** - Show one chart (2 min)
5. **Mobile demo** - Make one call (2 min)

### Scenario 2: Full 30-Minute Demo
**Perfect for: Decision makers, formal presentation**

Follow the complete presentation script in [DEMO_PRESENTATION_CHECKLIST.md](./DEMO_PRESENTATION_CHECKLIST.md)

### Scenario 3: Technical Deep-Dive
**Perfect for: IT team, technical evaluation**

1. Show architecture diagram
2. Explain database schema
3. Demonstrate API endpoints (http://localhost:8000/docs)
4. Show WebSocket real-time updates
5. Discuss security and scalability
6. Review integration capabilities

---

## 🔑 Demo Credentials

### Admin Access
- **Email:** admin@techsales.com
- **Password:** Demo2024!
- **Can see:** Everything - all employees, all calls, all analytics

### Manager Access
- **Email:** manager1@techsales.com to manager10@techsales.com
- **Password:** Demo2024!
- **Can see:** Team-level data, reports, analytics

### Sales Rep Access
- **Email:** sales1@techsales.com to sales100@techsales.com
- **Password:** Demo2024!
- **Can see:** Their own calls and data

---

## 💡 Pro Tips

### Make It Look Good
1. **Clear browser cache** before demo (fresh experience)
2. **Zoom to 110%** for better visibility on projector
3. **Use dark mode** (if available) - looks more professional
4. **Have multiple tabs open** for quick switching

### Handle Questions Smoothly
1. **Have API docs open** (http://localhost:8000/docs) for technical questions
2. **Have pricing sheet ready** for cost questions
3. **Know your numbers** - memorize key stats from ROI doc

### Avoid These Mistakes
1. ❌ Don't show debug/error pages
2. ❌ Don't get lost in features - stay focused on their needs
3. ❌ Don't promise features you don't have
4. ❌ Don't skip the "wow" moment - make a live call!

---

## 🛠 Quick Commands

### Check if demo is running:
```bash
# Check backend
curl http://localhost:8000/health

# Check frontend
curl http://localhost:5173
```

### View logs:
```bash
# Backend logs
tail -f backend/demo_backend.log

# Frontend logs
tail -f frontend/demo_frontend.log
```

### Stop demo:
```bash
# Windows
.\stop_demo.ps1

# Linux/Mac
./stop_demo.sh
```

### Restart demo:
```bash
# Windows
.\stop_demo.ps1
.\setup_demo.ps1

# Linux/Mac
./stop_demo.sh
./setup_demo.sh
```

---

## 🆘 Emergency Troubleshooting

### Demo won't start?
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check ports are available
netstat -an | grep 8000  # Backend
netstat -an | grep 5173  # Frontend
```

### No data showing?
```bash
# Check database has data
psql -U postgres callos_demo -c "SELECT COUNT(*) FROM calls;"

# Should return 500+
```

### Can't login?
```bash
# Reset admin password
cd backend
python create_superadmin.py
```

### Demo crashed during presentation?
1. **Stay calm** - apologize briefly
2. **Switch to backup** - use screenshots or video
3. **Pivot to Q&A** - "While that restarts, any questions?"
4. **Follow up** - "I'll send you access to working demo"

---

## 📧 Follow-Up Email Template

```
Subject: Call OS Demo - Access & Next Steps

Hi [Client Name],

Thank you for your time today! As promised, here are your demo credentials:

🔗 Demo URL: http://demo.callos.yourcompany.com
📧 Email: admin@techsales.com
🔑 Password: Demo2024!

The demo will remain active for 30 days for your team to explore.

📎 I've attached:
- Technical documentation
- ROI calculator (showing $37M return on $650K investment)
- Security & compliance overview
- Implementation timeline

Next Steps:
1. Explore the demo with your team
2. Technical Q&A session - [Proposed date/time]
3. Formal proposal - I'll send by [date]

Questions? Reply to this email or call me at [phone].

Looking forward to helping you transform your sales operations!

Best,
[Your Name]
```

---

## ✅ Pre-Demo Checklist (Print This!)

**30 Minutes Before:**
- [ ] Demo environment is running
- [ ] Can login as admin
- [ ] Dashboard shows data (calls, employees, devices)
- [ ] At least one call has a recording
- [ ] Analytics page loads with charts
- [ ] Mobile device is charged (if doing mobile demo)
- [ ] Presentation slides are ready
- [ ] ROI doc is printed/accessible
- [ ] Business cards are ready
- [ ] Bathroom break taken
- [ ] Deep breath - you got this!

---

## 🎉 Success Metrics

**You know the demo was successful if:**

✅ Client asked about pricing  
✅ Client mentioned timeline  
✅ Client requested pilot program  
✅ Client asked technical questions (showing interest)  
✅ Client introduced you to other stakeholders  
✅ Client agreed to specific next steps  

**If 3+ of these happened, you're in good shape!**

---

## 📞 Need Help?

**Technical Issues:**
- Check backend logs: `backend/demo_backend.log`
- Check frontend logs: `frontend/demo_frontend.log`
- Review: [DEMO_SETUP_GUIDE.md](./DEMO_SETUP_GUIDE.md)

**Presentation Help:**
- Review: [DEMO_PRESENTATION_CHECKLIST.md](./DEMO_PRESENTATION_CHECKLIST.md)

**Pricing Questions:**
- Review: [ROI_CALCULATOR.md](./ROI_CALCULATOR.md)

---

## 🚀 You're Ready!

Your demo environment is running. You have all the documentation. Now go show them how Call OS will transform their sales operations!

**Remember:**
- You're solving a real problem
- The ROI is compelling (5,692%!)
- You have proof (working demo)
- Stay confident and focused on their needs

**Good luck! 🎉**

---

*Last Updated: [Current Date]*
*Questions? Contact: [Your email/phone]*

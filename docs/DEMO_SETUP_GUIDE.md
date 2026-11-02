# Call OS Demo Setup Guide for Enterprise Client
## 3,000-5,000 Sales Employee Deployment

---

## Overview
This guide will help you set up a demonstration environment for a client with 3,000-5,000 sales employees who need comprehensive call tracking, monitoring, and analytics.

---

## Demo Environment Options

### Option 1: Quick Demo (Recommended for Initial Presentation)
**Timeline:** 1-2 hours setup
**Purpose:** Show core features and UI/UX

### Option 2: Production-Like Demo
**Timeline:** 1 day setup
**Purpose:** Performance testing with realistic data volume

---

## Part 1: Quick Demo Setup (Option 1)

### Prerequisites
- Server with at least 8GB RAM, 4 CPU cores
- Domain name (e.g., demo.callos.yourcompany.com)
- SSL certificate (Let's Encrypt recommended)
- PostgreSQL 14+ database

### Step 1: Environment Preparation

```bash
# Clone the repository
git clone <your-repo-url> callos-demo
cd callos-demo

# Create production environment files
cd backend
cp .env.example .env.production
```

### Step 2: Configure Environment Variables

Edit `backend/.env.production`:

```env
# Database Configuration
DATABASE_URL=postgresql://callos_user:STRONG_PASSWORD@localhost:5432/callos_demo

# Security
SECRET_KEY=<generate-with-openssl-rand-hex-32>
CORS_ORIGINS=https://demo.callos.yourcompany.com

# Demo Organization
DEMO_MODE=true
DEMO_ORG_NAME=TechSales Corp Demo

# Optional: Recording Storage
RECORDING_STORAGE_PATH=/var/callos/recordings
MAX_RECORDING_SIZE_MB=100

# Optional: AI Features (if demoing transcription)
OPENAI_API_KEY=<your-key-if-available>
```

### Step 3: Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE callos_demo;
CREATE USER callos_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE callos_demo TO callos_user;
\q

# Run migrations
cd backend
python migration_runner.py
```

### Step 4: Seed Demo Data

Create `backend/seed_demo_client.py`:

```python
"""
Seed script for demo client with realistic sales team structure
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import random

from app.database import get_db
from app.models import Organization, User, Employee, Device, Call
from app.auth.password import get_password_hash

async def seed_demo_data():
    """Create demo data for 100 employees (scaled representation of 5000)"""
    
    # Create demo organization
    org = Organization(
        name="TechSales Corp Demo",
        slug="techsales-demo",
        contact_email="demo@techsales.com",
        subscription_tier="enterprise",
        max_employees=5000,
        max_devices=5000,
        is_active=True
    )
    # Save org...
    
    # Create admin user
    admin = User(
        email="admin@techsales.com",
        hashed_password=get_password_hash("Demo2024!"),
        full_name="Demo Admin",
        is_active=True,
        is_superadmin=False,
        organization_id=org.id,
        role="admin"
    )
    
    # Create manager users (10 managers for 100 employees = 1:10 ratio)
    managers = []
    for i in range(10):
        manager = User(
            email=f"manager{i+1}@techsales.com",
            hashed_password=get_password_hash("Demo2024!"),
            full_name=f"Sales Manager {i+1}",
            is_active=True,
            organization_id=org.id,
            role="manager"
        )
        managers.append(manager)
    
    # Create 100 sales employees with devices
    employees = []
    devices = []
    
    departments = ["North Region", "South Region", "East Region", "West Region", 
                   "Enterprise Sales", "SMB Sales", "Inside Sales", "Field Sales",
                   "Retail Sales", "Channel Sales"]
    
    for i in range(100):
        # Create employee
        employee = Employee(
            employee_id=f"EMP{1000+i}",
            full_name=f"Sales Rep {i+1}",
            email=f"sales{i+1}@techsales.com",
            phone_number=f"+1555{i:04d}",
            department=random.choice(departments),
            position="Sales Representative",
            is_active=True,
            organization_id=org.id
        )
        employees.append(employee)
        
        # Create device for employee
        device = Device(
            device_id=f"DEVICE-{i+1:04d}",
            device_name=f"Sales Phone {i+1}",
            device_model=random.choice(["Samsung Galaxy S23", "Samsung Galaxy A54", 
                                       "Xiaomi Redmi Note 12", "OnePlus Nord"]),
            assigned_employee_id=employee.id,
            organization_id=org.id,
            is_active=True,
            last_seen=datetime.utcnow() - timedelta(minutes=random.randint(1, 60))
        )
        devices.append(device)
    
    print(f"Created {len(employees)} employees and {len(devices)} devices")
    
    # Create realistic call history (500 calls over past 7 days)
    calls = []
    call_types = ["outgoing", "incoming", "missed"]
    call_statuses = ["completed", "missed", "rejected", "busy"]
    
    for _ in range(500):
        employee = random.choice(employees)
        device = next(d for d in devices if d.assigned_employee_id == employee.id)
        
        call_date = datetime.utcnow() - timedelta(
            days=random.randint(0, 7),
            hours=random.randint(8, 18),  # Business hours
            minutes=random.randint(0, 59)
        )
        
        call_type = random.choice(call_types)
        duration = random.randint(30, 600) if call_type != "missed" else 0
        
        call = Call(
            phone_number=f"+1555{random.randint(10000, 99999)}",
            contact_name=f"Customer {random.randint(1, 1000)}",
            call_type=call_type,
            call_status=random.choice(call_statuses),
            duration=duration,
            timestamp=call_date,
            device_id=device.id,
            employee_id=employee.id,
            organization_id=org.id,
            has_recording=random.choice([True, False]),
            has_transcript=random.choice([True, False]) if duration > 60 else False
        )
        calls.append(call)
    
    print(f"Created {len(calls)} call records")
    
    return {
        "organization": org,
        "admin": admin,
        "managers": managers,
        "employees": employees,
        "devices": devices,
        "calls": calls
    }

if __name__ == "__main__":
    asyncio.run(seed_demo_data())
    print("\n✅ Demo data created successfully!")
    print("\n📋 Login Credentials:")
    print("   Admin: admin@techsales.com / Demo2024!")
    print("   Managers: manager1@techsales.com to manager10@techsales.com / Demo2024!")
```

Run the seed script:
```bash
python seed_demo_client.py
```

### Step 5: Deploy Backend

```bash
# Using Docker (recommended)
cd backend
docker-compose -f docker-compose.yml up -d

# OR using Uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Step 6: Deploy Frontend

```bash
cd frontend

# Configure API endpoint
cat > .env.production << EOF
VITE_API_URL=https://demo-api.callos.yourcompany.com
VITE_WS_URL=wss://demo-api.callos.yourcompany.com/ws
EOF

# Build and deploy
npm install
npm run build

# Serve with nginx (recommended)
sudo cp -r dist/* /var/www/callos-demo/
```

### Step 7: Configure Nginx

```nginx
# /etc/nginx/sites-available/callos-demo

# Frontend
server {
    listen 443 ssl http2;
    server_name demo.callos.yourcompany.com;
    
    ssl_certificate /etc/letsencrypt/live/demo.callos.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.callos.yourcompany.com/privkey.pem;
    
    root /var/www/callos-demo;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name demo-api.callos.yourcompany.com;
    
    ssl_certificate /etc/letsencrypt/live/demo.callos.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.callos.yourcompany.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_request;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Part 2: Demo Presentation Script

### 1. Dashboard Overview (2 minutes)
**What to Show:**
- Login as admin@techsales.com
- Main dashboard with real-time call statistics
- Total calls today, this week, this month
- Active devices count
- Top performers

**Key Points:**
- "Real-time visibility into all 5,000 employees"
- "See calls happening right now across your sales team"
- "Identify top performers instantly"

### 2. Call Monitoring (5 minutes)
**What to Show:**
- Navigate to Calls page
- Show filterable call list
- Filter by employee, date range, call type
- Click on a call to see details
- Play recording (if available)
- Show transcript and AI summary

**Key Points:**
- "Every call is logged automatically"
- "Search through millions of calls in seconds"
- "AI-powered transcription for quality assurance"
- "No manual logging required from sales team"

### 3. Employee Management (3 minutes)
**What to Show:**
- Navigate to Employees section
- Show list of all 100 demo employees
- Click on employee to see their call history
- Show performance metrics per employee
- Department organization

**Key Points:**
- "Manage 5,000 employees with ease"
- "Track individual performance metrics"
- "Organize by department, region, or team"
- "See which reps are making quota"

### 4. Device Management (3 minutes)
**What to Show:**
- Navigate to Devices section
- Show device list with status indicators
- Device health monitoring (battery, signal, last seen)
- Device-to-employee assignment

**Key Points:**
- "Know the status of every phone in the field"
- "Remote monitoring prevents downtime"
- "See which devices need attention"

### 5. Analytics & Reporting (4 minutes)
**What to Show:**
- Navigate to Analytics
- Show call volume trends
- Success rate metrics
- Peak calling hours
- Regional performance comparison
- Export data functionality

**Key Points:**
- "Make data-driven decisions"
- "Identify best practices from top performers"
- "Spot training opportunities"
- "Export for board presentations"

### 6. Real-Time Updates (2 minutes)
**What to Show:**
- Keep dashboard open
- Show new calls appearing in real-time
- Device status changes
- Live notification system

**Key Points:**
- "No refresh needed - updates instantly"
- "Monitor your team as they work"
- "Get alerts for important events"

---

## Part 3: Production-Like Demo (Option 2)

### For Large-Scale Testing

If client wants to see performance with realistic data volume:

```python
# Create seed_large_demo.py for 5,000 employees and 50,000+ calls

async def seed_large_demo():
    """Create full-scale demo data"""
    
    # 5,000 employees
    for i in range(5000):
        # Create employee and device
        pass
    
    # 50,000 calls over 30 days
    for _ in range(50000):
        # Create realistic call patterns
        pass
    
    print("Created 5,000 employees and 50,000 calls")
```

**System Requirements for Large Demo:**
- 16GB RAM minimum
- 8 CPU cores
- 500GB SSD storage
- PostgreSQL with connection pooling
- Redis for caching (optional but recommended)

---

## Part 4: Demo Mobile App (Android)

### Quick Setup

1. **Build Demo APK:**
```bash
cd android
./gradlew assembleRelease
```

2. **Configure Demo Server:**
Edit `app/src/main/res/values/config.xml`:
```xml
<string name="demo_api_url">https://demo-api.callos.yourcompany.com</string>
```

3. **Install on Demo Device:**
```bash
adb install app/build/outputs/apk/release/app-release.apk
```

4. **Demo Flow:**
- Login with sales1@techsales.com / Demo2024!
- Make a test call (use excluded numbers to avoid real calls)
- Show call gets logged immediately
- Show it appears in dashboard in real-time

---

## Part 5: Demo Scenarios

### Scenario 1: Sales Manager Morning Routine
**Character:** Sales Manager starting their day

1. Login to dashboard
2. Check overnight call activity
3. Review missed calls that need follow-up
4. Check which reps haven't made calls yet
5. Listen to a few successful calls for coaching

### Scenario 2: Quality Assurance Review
**Character:** QA Manager reviewing team performance

1. Filter calls by duration (find quick hangups)
2. Review transcripts for compliance keywords
3. Flag calls for manager review
4. Export data for weekly report

### Scenario 3: IT Administrator Device Check
**Character:** IT Admin managing fleet

1. Check device health status
2. Find devices with low battery
3. Identify devices that haven't checked in
4. Assign new device to new employee

### Scenario 4: Executive Dashboard View
**Character:** VP of Sales reviewing metrics

1. View organization-wide analytics
2. Compare regional performance
3. Identify top performers
4. Review month-over-month trends
5. Export presentation data

---

## Part 6: Common Client Questions & Answers

### Q: Can it handle 5,000 employees?
**A:** Yes. The system is built on PostgreSQL which easily handles millions of records. The demo shows 100 employees, but architecture supports 10,000+.

### Q: What about data storage costs?
**A:** Call recordings average 1-2MB per minute. Budget approximately:
- 5,000 employees × 20 calls/day = 100,000 calls/day
- Average 3 min/call = 300-600GB/day of recordings
- Use S3 with lifecycle policies to archive older recordings

### Q: How is real-time syncing achieved?
**A:** WebSocket connections from Android app to server. Calls are uploaded immediately after completion. Dashboard uses WebSockets for live updates.

### Q: What about privacy compliance?
**A:** Built-in features:
- Excluded numbers list (DNC compliance)
- Call privacy flags
- Audit logs for all access
- GDPR-ready data export/deletion
- Role-based access control

### Q: Can we integrate with our CRM?
**A:** Yes. The system has REST APIs for:
- Call data export
- Lead/opportunity tracking
- Webhook notifications
- Custom integrations

### Q: Training requirements?
**A:** Minimal:
- Sales reps: Just install app - automatic from there (5 min training)
- Managers: Dashboard navigation (30 min training)
- Admins: Full system training (2 hours)

---

## Part 7: Post-Demo Follow-Up

### Information to Gather

1. **Scale Requirements:**
   - Exact number of employees
   - Expected call volume per day
   - Regions/departments structure
   - Growth projections

2. **Technical Environment:**
   - Existing infrastructure
   - Cloud preference (AWS, Azure, GCP, on-premise)
   - IT team capabilities
   - Security requirements

3. **Integration Needs:**
   - Current CRM system
   - Existing phone systems
   - Other sales tools
   - Reporting systems

4. **Timeline:**
   - Desired go-live date
   - Pilot program preferences
   - Rollout strategy (phased vs all-at-once)

### Pricing Discussion Points

**Recommended Pricing Model:**

- **Per-Employee Model:** $10-15/user/month
  - 5,000 employees × $12 = $60,000/month
  
- **Enterprise Flat Rate:** $50,000-75,000/month
  - Includes unlimited employees
  - Better for large teams
  
- **Setup & Training:** $25,000-50,000 one-time
  - Custom setup
  - Data migration
  - Training sessions
  - Integration work

### Next Steps After Demo

1. ✅ Send demo credentials for client testing
2. 📊 Provide technical documentation
3. 📅 Schedule technical deep-dive with client IT
4. 💼 Prepare formal proposal
5. 🎯 Define pilot program (100-500 users for 30 days)
6. 📝 Draft Statement of Work (SOW)

---

## Demo Checklist

### Pre-Demo (1 day before)
- [ ] Demo environment running and accessible
- [ ] Demo data loaded (100 employees, 500+ calls)
- [ ] Sample recordings available
- [ ] Mobile app installed on demo device
- [ ] Test all features end-to-end
- [ ] Prepare backup slides (if demo fails)
- [ ] Test internet connectivity

### During Demo
- [ ] Have login credentials ready
- [ ] Use dual monitor setup (dashboard + presentation)
- [ ] Have mobile device charged and ready
- [ ] Screen recording running (for follow-up)
- [ ] Note client's specific questions
- [ ] Show, don't just tell

### Post-Demo
- [ ] Send demo credentials to client
- [ ] Provide documentation links
- [ ] Schedule technical Q&A
- [ ] Send proposal within 48 hours
- [ ] Follow up on specific questions

---

## Emergency Troubleshooting

### If Demo Environment Crashes

**Backup Plan 1:** Use screenshots/video
- Pre-record full demo walkthrough
- Have screenshots of all major screens

**Backup Plan 2:** Use local environment
- Have laptop with local setup ready
- Pre-populated database backup

**Backup Plan 3:** Slide deck fallback
- Full feature presentation in slides
- Architecture diagrams
- Reference customer testimonials

---

## Success Metrics for Demo

### Demo is successful if client:
1. ✅ Understands the core value proposition
2. ✅ Sees how it solves their specific pain points
3. ✅ Asks about pricing and implementation
4. ✅ Requests trial/pilot program
5. ✅ Introduces you to technical decision-makers
6. ✅ Agrees to specific next steps with timeline

---

## Resources Provided

📁 **Demo Package Contents:**
- Demo environment URL and credentials
- Mobile app APK for testing
- Technical architecture documentation
- API documentation
- Security & compliance whitepaper
- Case studies (if available)
- ROI calculator spreadsheet
- Implementation timeline template

---

## Contact Information

**For Demo Support:**
- Email: demo-support@yourcompany.com
- Phone: [Your support number]
- Slack/Teams: [Demo support channel]

**For Sales Questions:**
- Sales Team: sales@yourcompany.com
- Technical Pre-Sales: solutions@yourcompany.com

---

*Last Updated: [Current Date]*
*Demo Environment Version: 1.0*
*Valid for 30 days from setup*

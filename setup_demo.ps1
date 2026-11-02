#############################################
# Call OS Demo Environment Setup Script (Windows)
# PowerShell version for Windows environments
#############################################

$ErrorActionPreference = "Stop"

# Configuration
$DEMO_ORG_NAME = "TechSales Corp Demo"
$NUM_EMPLOYEES = 100
$NUM_CALLS = 500

Write-Host @"

╔════════════════════════════════════════╗
║   Call OS Demo Environment Setup      ║
║          Windows PowerShell           ║
╚════════════════════════════════════════╝

"@ -ForegroundColor Blue

function Write-Step {
    param($Message)
    Write-Host "`n▶ $Message`n" -ForegroundColor Green
}

function Write-Warn {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Check prerequisites
Write-Step "Checking prerequisites..."

$pythonInstalled = Get-Command python -ErrorAction SilentlyContinue
$psqlInstalled = Get-Command psql -ErrorAction SilentlyContinue

if (-not $pythonInstalled) {
    Write-Error "Python is required but not installed. Install from https://python.org"
    exit 1
}

if (-not $psqlInstalled) {
    Write-Error "PostgreSQL is required but not installed. Install from https://postgresql.org"
    exit 1
}

Write-Host "✓ Prerequisites check passed"

# Create demo database
Write-Step "Creating demo database..."

$psqlScript = @"
DROP DATABASE IF EXISTS callos_demo;
CREATE DATABASE callos_demo;
DROP USER IF EXISTS callos_demo_user;
CREATE USER callos_demo_user WITH PASSWORD 'Demo2024Pass!';
GRANT ALL PRIVILEGES ON DATABASE callos_demo TO callos_demo_user;
"@

$psqlScript | psql -U postgres

Write-Host "✓ Database created: callos_demo"

# Configure backend environment
Write-Step "Configuring backend environment..."

Set-Location backend

$secretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

$envContent = @"
# Database
DATABASE_URL=postgresql://callos_demo_user:Demo2024Pass!@localhost:5432/callos_demo

# Security
SECRET_KEY=$secretKey
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Demo Configuration
DEMO_MODE=true
DEMO_ORG_NAME=$DEMO_ORG_NAME

# Storage
RECORDING_STORAGE_PATH=./demo_recordings
MAX_RECORDING_SIZE_MB=100

# Logging
LOG_LEVEL=INFO
"@

$envContent | Out-File -FilePath .env.demo -Encoding UTF8

Write-Host "✓ Environment configured"

# Install Python dependencies
Write-Step "Installing Python dependencies..."

python -m pip install -q -r requirements.txt

Write-Host "✓ Dependencies installed"

# Run migrations
Write-Step "Running database migrations..."

$env:DATABASE_URL = "postgresql://callos_demo_user:Demo2024Pass!@localhost:5432/callos_demo"
python migration_runner.py

Write-Host "✓ Migrations completed"

# Create and run demo data seed script
Write-Step "Creating demo data..."

$seedScript = @'
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from app.auth.password import get_password_hash

db_url = "postgresql://callos_demo_user:Demo2024Pass!@localhost:5432/callos_demo"
engine = create_engine(db_url.replace('postgresql://', 'postgresql+psycopg2://'))

def create_demo_data():
    with engine.connect() as conn:
        # Create organization
        org_result = conn.execute(text("""
            INSERT INTO organizations (name, slug, contact_email, subscription_tier, max_employees, max_devices, is_active, created_at)
            VALUES (:name, :slug, :email, :tier, :max_emp, :max_dev, :active, :created)
            RETURNING id
        """), {
            'name': 'TechSales Corp Demo',
            'slug': 'techsales-demo',
            'email': 'demo@techsales.com',
            'tier': 'enterprise',
            'max_emp': 5000,
            'max_dev': 5000,
            'active': True,
            'created': datetime.utcnow()
        })
        org_id = org_result.fetchone()[0]
        print(f"✓ Created organization (ID: {org_id})")
        
        # Create admin user
        conn.execute(text("""
            INSERT INTO users (email, hashed_password, full_name, is_active, is_superadmin, organization_id, role, created_at)
            VALUES (:email, :password, :name, :active, :superadmin, :org_id, :role, :created)
        """), {
            'email': 'admin@techsales.com',
            'password': get_password_hash('Demo2024!'),
            'name': 'Demo Admin',
            'active': True,
            'superadmin': False,
            'org_id': org_id,
            'role': 'admin',
            'created': datetime.utcnow()
        })
        print("✓ Created admin user")
        
        # Create managers
        for i in range(10):
            conn.execute(text("""
                INSERT INTO users (email, hashed_password, full_name, is_active, is_superadmin, organization_id, role, created_at)
                VALUES (:email, :password, :name, :active, :superadmin, :org_id, :role, :created)
            """), {
                'email': f'manager{i+1}@techsales.com',
                'password': get_password_hash('Demo2024!'),
                'name': f'Sales Manager {i+1}',
                'active': True,
                'superadmin': False,
                'org_id': org_id,
                'role': 'manager',
                'created': datetime.utcnow()
            })
        print("✓ Created 10 managers")
        
        # Create employees and devices
        departments = ["North Region", "South Region", "East Region", "West Region", 
                      "Enterprise Sales", "SMB Sales", "Inside Sales", "Field Sales"]
        
        employee_device_pairs = []
        
        for i in range(100):
            # Employee
            emp_result = conn.execute(text("""
                INSERT INTO employees (employee_id, full_name, email, phone_number, department, position, is_active, organization_id, created_at)
                VALUES (:emp_id, :name, :email, :phone, :dept, :position, :active, :org_id, :created)
                RETURNING id
            """), {
                'emp_id': f'EMP{1000+i}',
                'name': f'Sales Rep {i+1}',
                'email': f'sales{i+1}@techsales.com',
                'phone': f'+1555{i:04d}',
                'dept': random.choice(departments),
                'position': 'Sales Representative',
                'active': True,
                'org_id': org_id,
                'created': datetime.utcnow()
            })
            employee_id = emp_result.fetchone()[0]
            
            # Device
            models = ["Samsung Galaxy S23", "Samsung Galaxy A54", "Xiaomi Redmi Note 12", "OnePlus Nord"]
            dev_result = conn.execute(text("""
                INSERT INTO devices (device_id, device_name, device_model, assigned_employee_id, organization_id, is_active, last_seen, created_at)
                VALUES (:dev_id, :name, :model, :emp_id, :org_id, :active, :last_seen, :created)
                RETURNING id
            """), {
                'dev_id': f'DEVICE-{i+1:04d}',
                'name': f'Sales Phone {i+1}',
                'model': random.choice(models),
                'emp_id': employee_id,
                'org_id': org_id,
                'active': True,
                'last_seen': datetime.utcnow() - timedelta(minutes=random.randint(1, 60)),
                'created': datetime.utcnow()
            })
            device_id = dev_result.fetchone()[0]
            employee_device_pairs.append((device_id, employee_id))
        
        print(f"✓ Created 100 employees and devices")
        
        # Create calls
        call_types = ["outgoing", "incoming"]
        call_statuses = ["completed", "missed", "rejected", "busy"]
        
        for _ in range(500):
            device_id, employee_id = random.choice(employee_device_pairs)
            call_date = datetime.utcnow() - timedelta(
                days=random.randint(0, 7),
                hours=random.randint(8, 18),
                minutes=random.randint(0, 59)
            )
            
            call_type = random.choice(call_types)
            status = random.choice(call_statuses)
            duration = random.randint(30, 600) if status == "completed" else 0
            
            conn.execute(text("""
                INSERT INTO calls (phone_number, contact_name, call_type, call_status, duration, timestamp, device_id, employee_id, organization_id, has_recording, has_transcript)
                VALUES (:phone, :contact, :type, :status, :duration, :timestamp, :device_id, :emp_id, :org_id, :recording, :transcript)
            """), {
                'phone': f'+1555{random.randint(10000, 99999)}',
                'contact': f'Customer {random.randint(1, 1000)}',
                'type': call_type,
                'status': status,
                'duration': duration,
                'timestamp': call_date,
                'device_id': device_id,
                'emp_id': employee_id,
                'org_id': org_id,
                'recording': duration > 60 and random.random() > 0.3,
                'transcript': duration > 120 and random.random() > 0.5
            })
        
        print(f"✓ Created 500 call records")
        
        conn.commit()
        print("\n✅ Demo data created successfully!")

try:
    create_demo_data()
    print(f"\n{'='*50}")
    print("DEMO LOGIN CREDENTIALS")
    print(f"{'='*50}")
    print(f"Admin:    admin@techsales.com / Demo2024!")
    print(f"Managers: manager1-10@techsales.com / Demo2024!")
    print(f"{'='*50}\n")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
'@

$seedScript | Out-File -FilePath seed_demo_temp.py -Encoding UTF8
python seed_demo_temp.py
Remove-Item seed_demo_temp.py

Write-Host "✓ Demo data seeded"

# Start backend server
Write-Step "Starting backend server..."

$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}

Start-Sleep -Seconds 3

if ($backendJob.State -eq "Running") {
    Write-Host "✓ Backend server started (Job ID: $($backendJob.Id))"
    Write-Host "  API running at: http://localhost:8000"
    $backendJob.Id | Out-File -FilePath demo_backend.pid
} else {
    Write-Error "Backend server failed to start"
    Receive-Job -Job $backendJob
    exit 1
}

Set-Location ..

# Setup frontend
if (Test-Path "frontend") {
    Write-Step "Setting up frontend..."
    
    Set-Location frontend
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Warn "Installing frontend dependencies (this may take a few minutes)..."
        npm install
    }
    
    # Create demo environment
    $frontendEnv = @"
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_APP_NAME=Call OS Demo
"@
    
    $frontendEnv | Out-File -FilePath .env.demo -Encoding UTF8
    
    Write-Host "✓ Frontend configured"
    
    # Start dev server
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run dev -- --port 5173
    }
    
    Start-Sleep -Seconds 3
    
    if ($frontendJob.State -eq "Running") {
        Write-Host "✓ Frontend server started (Job ID: $($frontendJob.Id))"
        Write-Host "  App running at: http://localhost:5173"
        $frontendJob.Id | Out-File -FilePath demo_frontend.pid
    } else {
        Write-Warn "Frontend server may have failed"
    }
    
    Set-Location ..
}

# Print summary
Write-Host @"

╔════════════════════════════════════════════════════════════╗
║          🎉 Demo Environment Ready! 🎉                    ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "📱 Access Points:" -ForegroundColor Blue
Write-Host "  Frontend: http://localhost:5173"
Write-Host "  Backend:  http://localhost:8000"
Write-Host "  API Docs: http://localhost:8000/docs"

Write-Host "`n🔑 Login Credentials:" -ForegroundColor Blue
Write-Host "  Admin:    admin@techsales.com / Demo2024!"
Write-Host "  Manager:  manager1@techsales.com / Demo2024!"

Write-Host "`n📊 Demo Data:" -ForegroundColor Blue
Write-Host "  Organization: $DEMO_ORG_NAME"
Write-Host "  Employees:    $NUM_EMPLOYEES"
Write-Host "  Devices:      $NUM_EMPLOYEES"
Write-Host "  Call Records: $NUM_CALLS"

Write-Host "`n🛠 Management Commands:" -ForegroundColor Blue
Write-Host "  Stop demo:    .\stop_demo.ps1"
Write-Host "  View jobs:    Get-Job"

Write-Host "`n📖 Documentation:" -ForegroundColor Blue
Write-Host "  Demo Guide:   docs\DEMO_SETUP_GUIDE.md"

Write-Host "`n💡 Tip: The demo is now running. Open http://localhost:5173 in your browser!`n" -ForegroundColor Yellow

# Create stop script
$stopScript = @'
Write-Host "Stopping demo environment..." -ForegroundColor Yellow

if (Test-Path "backend\demo_backend.pid") {
    $jobId = Get-Content "backend\demo_backend.pid"
    Stop-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Item "backend\demo_backend.pid"
    Write-Host "✓ Backend stopped" -ForegroundColor Green
}

if (Test-Path "frontend\demo_frontend.pid") {
    $jobId = Get-Content "frontend\demo_frontend.pid"
    Stop-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Item "frontend\demo_frontend.pid"
    Write-Host "✓ Frontend stopped" -ForegroundColor Green
}

Write-Host "Demo environment stopped" -ForegroundColor Green
'@

$stopScript | Out-File -FilePath stop_demo.ps1 -Encoding UTF8

Write-Host "✓ Created stop_demo.ps1 script"
Write-Host "`nSetup complete!" -ForegroundColor Green

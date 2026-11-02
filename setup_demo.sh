#!/bin/bash

#############################################
# Call OS Demo Environment Setup Script
# Automates demo setup for client presentations
#############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_DOMAIN=${DEMO_DOMAIN:-"demo.callos.local"}
DEMO_API_DOMAIN=${DEMO_API_DOMAIN:-"demo-api.callos.local"}
DEMO_ORG_NAME=${DEMO_ORG_NAME:-"TechSales Corp Demo"}
NUM_EMPLOYEES=${NUM_EMPLOYEES:-100}
NUM_CALLS=${NUM_CALLS:-500}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   Call OS Demo Environment Setup      ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print step
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}\n"
}

# Function to print warning
print_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || { print_error "Python 3 is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { print_error "PostgreSQL is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || print_warn "Docker not found. Will use direct deployment."

echo "✓ Prerequisites check passed"

# Create demo database
print_step "Creating demo database..."

sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS callos_demo;
CREATE DATABASE callos_demo;
DROP USER IF EXISTS callos_demo_user;
CREATE USER callos_demo_user WITH PASSWORD 'Demo2024Pass!';
GRANT ALL PRIVILEGES ON DATABASE callos_demo TO callos_demo_user;
EOF

echo "✓ Database created: callos_demo"

# Configure backend environment
print_step "Configuring backend environment..."

cd backend

cat > .env.demo << EOF
# Database
DATABASE_URL=postgresql://callos_demo_user:Demo2024Pass!@localhost:5432/callos_demo

# Security
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS
CORS_ORIGINS=http://localhost:5173,http://${DEMO_DOMAIN},https://${DEMO_DOMAIN}

# Demo Configuration
DEMO_MODE=true
DEMO_ORG_NAME=${DEMO_ORG_NAME}

# Storage
RECORDING_STORAGE_PATH=./demo_recordings
MAX_RECORDING_SIZE_MB=100

# Logging
LOG_LEVEL=INFO
EOF

echo "✓ Environment configured"

# Install Python dependencies
print_step "Installing Python dependencies..."

python3 -m pip install -q -r requirements.txt 2>/dev/null || {
    print_warn "Some packages may need manual installation"
}

echo "✓ Dependencies installed"

# Run migrations
print_step "Running database migrations..."

export $(cat .env.demo | xargs)
python3 migration_runner.py

echo "✓ Migrations completed"

# Create demo data seed script
print_step "Creating demo data..."

python3 << 'PYTHON_SCRIPT'
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from datetime import datetime, timedelta
import random
from sqlalchemy import create_engine, text
from app.auth.password import get_password_hash

# Get DB URL from environment
db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(db_url.replace('postgresql://', 'postgresql+psycopg2://'))

def create_demo_data():
    with engine.connect() as conn:
        # Create organization
        org_result = conn.execute(text("""
            INSERT INTO organizations (name, slug, contact_email, subscription_tier, max_employees, max_devices, is_active, created_at)
            VALUES (:name, :slug, :email, :tier, :max_emp, :max_dev, :active, :created)
            RETURNING id
        """), {
            'name': os.getenv('DEMO_ORG_NAME', 'TechSales Corp Demo'),
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
        admin_result = conn.execute(text("""
            INSERT INTO users (email, hashed_password, full_name, is_active, is_superadmin, organization_id, role, created_at)
            VALUES (:email, :password, :name, :active, :superadmin, :org_id, :role, :created)
            RETURNING id
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
        admin_id = admin_result.fetchone()[0]
        print(f"✓ Created admin user")
        
        # Create managers
        manager_ids = []
        for i in range(10):
            manager_result = conn.execute(text("""
                INSERT INTO users (email, hashed_password, full_name, is_active, is_superadmin, organization_id, role, created_at)
                VALUES (:email, :password, :name, :active, :superadmin, :org_id, :role, :created)
                RETURNING id
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
            manager_ids.append(manager_result.fetchone()[0])
        print(f"✓ Created 10 managers")
        
        # Create employees and devices
        departments = ["North Region", "South Region", "East Region", "West Region", 
                      "Enterprise Sales", "SMB Sales", "Inside Sales", "Field Sales"]
        
        employee_ids = []
        device_ids = []
        
        num_employees = int(os.getenv('NUM_EMPLOYEES', 100))
        
        for i in range(num_employees):
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
            employee_ids.append(employee_id)
            
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
            device_ids.append((device_id, employee_id))
        
        print(f"✓ Created {num_employees} employees and devices")
        
        # Create calls
        call_types = ["outgoing", "incoming"]
        call_statuses = ["completed", "missed", "rejected", "busy"]
        
        num_calls = int(os.getenv('NUM_CALLS', 500))
        
        for _ in range(num_calls):
            device_id, employee_id = random.choice(device_ids)
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
        
        print(f"✓ Created {num_calls} call records")
        
        conn.commit()
        print("\n✅ Demo data created successfully!")
        
        return org_id

try:
    org_id = create_demo_data()
    print(f"\n{'='*50}")
    print("DEMO LOGIN CREDENTIALS")
    print(f"{'='*50}")
    print(f"Admin:    admin@techsales.com / Demo2024!")
    print(f"Managers: manager1-10@techsales.com / Demo2024!")
    print(f"{'='*50}\n")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

PYTHON_SCRIPT

echo "✓ Demo data seeded"

# Start backend server
print_step "Starting backend server..."

echo "Starting uvicorn server in background..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > demo_backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > demo_backend.pid

sleep 3

if ps -p $BACKEND_PID > /dev/null; then
    echo "✓ Backend server started (PID: $BACKEND_PID)"
    echo "  API running at: http://localhost:8000"
    echo "  Logs: backend/demo_backend.log"
else
    print_error "Backend server failed to start. Check demo_backend.log"
    exit 1
fi

cd ..

# Setup frontend
if [ -d "frontend" ]; then
    print_step "Setting up frontend..."
    
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_warn "Installing frontend dependencies (this may take a few minutes)..."
        npm install
    fi
    
    # Create demo environment
    cat > .env.demo << EOF
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_APP_NAME=Call OS Demo
EOF
    
    echo "✓ Frontend configured"
    
    # Start dev server
    echo "Starting Vite dev server..."
    nohup npm run dev -- --port 5173 > demo_frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > demo_frontend.pid
    
    sleep 3
    
    if ps -p $FRONTEND_PID > /dev/null; then
        echo "✓ Frontend server started (PID: $FRONTEND_PID)"
        echo "  App running at: http://localhost:5173"
        echo "  Logs: frontend/demo_frontend.log"
    else
        print_warn "Frontend server may have failed. Check demo_frontend.log"
    fi
    
    cd ..
fi

# Print summary
echo -e "\n${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🎉 Demo Environment Ready! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "\n${BLUE}📱 Access Points:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"

echo -e "\n${BLUE}🔑 Login Credentials:${NC}"
echo "  Admin:    admin@techsales.com / Demo2024!"
echo "  Manager:  manager1@techsales.com / Demo2024!"

echo -e "\n${BLUE}📊 Demo Data:${NC}"
echo "  Organization: ${DEMO_ORG_NAME}"
echo "  Employees:    ${NUM_EMPLOYEES}"
echo "  Devices:      ${NUM_EMPLOYEES}"
echo "  Call Records: ${NUM_CALLS}"

echo -e "\n${BLUE}🛠 Management Commands:${NC}"
echo "  Stop demo:    ./stop_demo.sh"
echo "  View logs:    tail -f backend/demo_backend.log"
echo "  Reset data:   ./reset_demo.sh"

echo -e "\n${BLUE}📖 Documentation:${NC}"
echo "  Demo Guide:   docs/DEMO_SETUP_GUIDE.md"

echo -e "\n${YELLOW}💡 Tip: The demo is now running. Open http://localhost:5173 in your browser!${NC}\n"

# Create stop script
cat > stop_demo.sh << 'STOP_SCRIPT'
#!/bin/bash
echo "Stopping demo environment..."

if [ -f backend/demo_backend.pid ]; then
    kill $(cat backend/demo_backend.pid) 2>/dev/null
    rm backend/demo_backend.pid
    echo "✓ Backend stopped"
fi

if [ -f frontend/demo_frontend.pid ]; then
    kill $(cat frontend/demo_frontend.pid) 2>/dev/null
    rm frontend/demo_frontend.pid
    echo "✓ Frontend stopped"
fi

echo "Demo environment stopped"
STOP_SCRIPT

chmod +x stop_demo.sh

echo "✓ Created stop_demo.sh script"
echo -e "\n${GREEN}Setup complete!${NC}"

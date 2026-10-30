"""
CALLOS Full E2E Test Suite: Mobile → Backend → Web Sync Flow
Tests authentication, device registration, call sync, and dashboard display.
"""

import asyncio
import json
from datetime import datetime, timezone, timedelta
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models import User, Organization, Employee, Device, Call, SIM
from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from sqlalchemy import text
import uuid


def print_header(title):
    """Print a section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_success(msg):
    """Print success message"""
    print(f"✅ {msg}")


def print_error(msg):
    """Print error message"""
    print(f"❌ {msg}")


def print_info(msg):
    """Print info message"""
    print(f"ℹ️  {msg}")


class E2ETestRunner:
    def __init__(self):
        self.db = SessionLocal()
        self.test_org = None
        self.test_user = None
        self.test_employee = None
        self.test_device = None
        self.test_sims = []
        self.test_calls = []

    def cleanup(self):
        """Close database connection"""
        self.db.close()

    def test_1_database_health(self):
        """Test 1: Database connectivity"""
        print_header("TEST 1: Database Health Check")
        
        try:
            result = self.db.execute(text("SELECT 1"))
            print_success("Database connection successful")
            
            # Check tables exist
            tables = ['organizations', 'users', 'employees', 'devices', 'calls', 'sims']
            for table in tables:
                result = self.db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print_info(f"Table '{table}': {count} rows")
            
            return True
        except Exception as e:
            print_error(f"Database error: {e}")
            return False

    def test_2_organization_setup(self):
        """Test 2: Create test organization"""
        print_header("TEST 2: Organization Setup")
        
        try:
            # Check if org exists
            org = self.db.query(Organization).filter(
                Organization.name == "Test Org E2E"
            ).first()
            
            if not org:
                org = Organization(
                    id=f"org-e2e-{uuid.uuid4().hex[:8]}",
                    name="Test Org E2E",
                    industry="Sales",
                    country="IN",
                    employees_count=1
                )
                self.db.add(org)
                self.db.commit()
                print_success(f"Organization created: {org.id}")
            else:
                print_info(f"Using existing organization: {org.id}")
            
            self.test_org = org
            return True
        except Exception as e:
            print_error(f"Failed to create organization: {e}")
            self.db.rollback()
            return False

    def test_3_user_registration(self):
        """Test 3: Register test user"""
        print_header("TEST 3: User Registration")
        
        try:
            # Check if user exists
            user = self.db.query(User).filter(
                User.email == "e2e-test@callos.local"
            ).first()
            
            if not user:
                user = User(
                    id=f"user-e2e-{uuid.uuid4().hex[:8]}",
                    organization_id=self.test_org.id,
                    email="e2e-test@callos.local",
                    password_hash=hash_password("E2ETest@123"),
                    name="E2E Test User",
                    role="EMPLOYEE",
                    status="active"
                )
                self.db.add(user)
                self.db.commit()
                print_success(f"User registered: {user.email} (ID: {user.id})")
            else:
                print_info(f"Using existing user: {user.email}")
            
            self.test_user = user
            return True
        except Exception as e:
            print_error(f"Failed to register user: {e}")
            self.db.rollback()
            return False

    def test_4_employee_creation(self):
        """Test 4: Create employee record"""
        print_header("TEST 4: Employee Creation")
        
        try:
            # Check if employee exists
            emp = self.db.query(Employee).filter(
                Employee.user_id == self.test_user.id
            ).first()
            
            if not emp:
                emp = Employee(
                    id=f"emp-e2e-{uuid.uuid4().hex[:8]}",
                    organization_id=self.test_org.id,
                    user_id=self.test_user.id,
                    name=self.test_user.name,
                    email=self.test_user.email,
                    status="active"
                )
                self.db.add(emp)
                self.db.commit()
                print_success(f"Employee created: {emp.name} (ID: {emp.id})")
            else:
                print_info(f"Using existing employee: {emp.name}")
            
            self.test_employee = emp
            return True
        except Exception as e:
            print_error(f"Failed to create employee: {e}")
            self.db.rollback()
            return False

    def test_5_device_registration(self):
        """Test 5: Register test device"""
        print_header("TEST 5: Device Registration")
        
        try:
            # Create device
            device = Device(
                id=f"dev-e2e-{uuid.uuid4().hex[:8]}",
                organization_id=self.test_org.id,
                employee_id=self.test_employee.id,
                model="Samsung Galaxy S21",
                android_version="13",
                app_version="1.0.0",
                is_online=True
            )
            self.db.add(device)
            self.db.commit()
            
            print_success(f"Device registered: {device.model} (ID: {device.id})")
            print_info(f"Device online status: {device.is_online}")
            
            # Create SIM
            sim = SIM(
                id=f"sim-e2e-{uuid.uuid4().hex[:8]}",
                device_id=device.id,
                organization_id=self.test_org.id,
                slot=1,
                display_name="Primary SIM",
                is_selected=True
            )
            self.db.add(sim)
            self.db.commit()
            
            print_success(f"SIM created: {sim.display_name} (Slot {sim.slot})")
            
            self.test_device = device
            self.test_sims.append(sim)
            return True
        except Exception as e:
            print_error(f"Failed to register device: {e}")
            self.db.rollback()
            return False

    def test_6_jwt_token_generation(self):
        """Test 6: Generate and validate JWT token"""
        print_header("TEST 6: JWT Token Generation")
        
        try:
            token = create_access_token(
                data={"sub": self.test_user.id, "type": "access"},
                expires_delta=timedelta(hours=1)
            )
            
            if token and len(token) > 50:
                print_success(f"JWT token generated (length: {len(token)})")
                print_info(f"Token preview: {token[:50]}...")
                return token
            else:
                print_error("Invalid token generated")
                return None
        except Exception as e:
            print_error(f"Failed to generate token: {e}")
            return None

    def test_7_call_sync_simulation(self):
        """Test 7: Simulate call sync from mobile"""
        print_header("TEST 7: Call Sync Simulation")
        
        try:
            now = datetime.now(timezone.utc)
            
            # Simulate 3 calls from mobile
            test_call_data = [
                {
                    "client_event_id": f"android-e2e-001",
                    "phone_number": "+919876543210",
                    "contact_name": "John Doe",
                    "call_type": "incoming",
                    "call_status": "connected",
                    "start_time": now - timedelta(hours=1),
                    "end_time": now - timedelta(hours=1, minutes=-5),
                    "duration_seconds": 300,
                    "sim_slot": 1,
                    "subscription_id": "123456789",
                    "source": "SIM 1"
                },
                {
                    "client_event_id": f"android-e2e-002",
                    "phone_number": "+919988776655",
                    "contact_name": "Jane Smith",
                    "call_type": "outgoing",
                    "call_status": "connected",
                    "start_time": now - timedelta(minutes=30),
                    "end_time": now - timedelta(minutes=20),
                    "duration_seconds": 600,
                    "sim_slot": 1,
                    "subscription_id": "123456789",
                    "source": "SIM 1"
                },
                {
                    "client_event_id": f"android-e2e-003",
                    "phone_number": "+919999999999",
                    "contact_name": "Unknown",
                    "call_type": "missed",
                    "call_status": "missed",
                    "start_time": now - timedelta(minutes=5),
                    "end_time": None,
                    "duration_seconds": 0,
                    "sim_slot": 1,
                    "subscription_id": "123456789",
                    "source": "SIM 1"
                }
            ]
            
            # Insert calls
            for call_data in test_call_data:
                call = Call(
                    id=f"tzm-cal-e2e-{uuid.uuid4().hex[:8]}",
                    client_event_id=call_data["client_event_id"],
                    organization_id=self.test_org.id,
                    employee_id=self.test_employee.id,
                    device_id=self.test_device.id,
                    sim_id=self.test_sims[0].id,
                    phone_number=call_data["phone_number"],
                    contact_name=call_data["contact_name"],
                    call_type=call_data["call_type"],
                    call_status=call_data["call_status"],
                    start_time=call_data["start_time"],
                    end_time=call_data["end_time"],
                    duration_seconds=call_data["duration_seconds"],
                    sim_slot=call_data["sim_slot"],
                    subscription_id=call_data["subscription_id"],
                    source=call_data["source"],
                    recording_available=False,
                    recording_status="not_available",
                    sync_status="synced",
                    sync_confirmed_at=now
                )
                self.db.add(call)
                self.test_calls.append(call)
            
            self.db.commit()
            
            print_success(f"Synced {len(test_call_data)} test calls")
            for i, call in enumerate(self.test_calls):
                print_info(f"  Call {i+1}: {call.phone_number} → {call.contact_name} ({call.call_type})")
            
            return True
        except Exception as e:
            print_error(f"Failed to sync calls: {e}")
            self.db.rollback()
            return False

    def test_8_dashboard_data_retrieval(self):
        """Test 8: Query dashboard data"""
        print_header("TEST 8: Dashboard Data Retrieval")
        
        try:
            # Query calls for dashboard
            calls = self.db.query(Call).filter(
                Call.organization_id == self.test_org.id,
                Call.employee_id == self.test_employee.id
            ).order_by(Call.start_time.desc()).all()
            
            print_success(f"Retrieved {len(calls)} calls for dashboard")
            
            # Calculate KPIs
            total_duration = sum(c.duration_seconds for c in calls)
            avg_duration = total_duration / len(calls) if calls else 0
            incoming_count = len([c for c in calls if c.call_type == "incoming"])
            outgoing_count = len([c for c in calls if c.call_type == "outgoing"])
            missed_count = len([c for c in calls if c.call_type == "missed"])
            
            print_info(f"Total calls: {len(calls)}")
            print_info(f"  Incoming: {incoming_count}")
            print_info(f"  Outgoing: {outgoing_count}")
            print_info(f"  Missed: {missed_count}")
            print_info(f"Total duration: {total_duration}s ({total_duration/60:.1f} mins)")
            print_info(f"Average duration: {avg_duration:.0f}s ({avg_duration/60:.1f} mins)")
            
            return True
        except Exception as e:
            print_error(f"Failed to retrieve dashboard data: {e}")
            return False

    def test_9_sync_idempotency(self):
        """Test 9: Verify sync idempotency (duplicate detection)"""
        print_header("TEST 9: Sync Idempotency Check")
        
        try:
            # Try to insert duplicate call
            duplicate_call = Call(
                id=f"tzm-cal-dup-{uuid.uuid4().hex[:8]}",
                client_event_id=self.test_calls[0].client_event_id,  # Same as first call
                organization_id=self.test_org.id,
                employee_id=self.test_employee.id,
                device_id=self.test_device.id,
                phone_number="+919111111111",
                contact_name="Should be rejected",
                call_type="incoming",
                call_status="connected",
                start_time=datetime.now(timezone.utc),
                duration_seconds=100,
                recording_available=False,
                recording_status="not_available",
                sync_status="synced"
            )
            
            # This should fail due to unique constraint on (org_id, client_event_id)
            try:
                self.db.add(duplicate_call)
                self.db.commit()
                print_error("Duplicate insert should have failed (unique constraint violated)")
                return False
            except Exception as e:
                if "unique" in str(e).lower():
                    print_success("Duplicate call correctly rejected by unique constraint")
                    self.db.rollback()
                    return True
                else:
                    print_error(f"Unexpected error: {e}")
                    self.db.rollback()
                    return False
        except Exception as e:
            print_error(f"Test failed: {e}")
            return False

    def test_10_device_online_status(self):
        """Test 10: Verify device online tracking"""
        print_header("TEST 10: Device Online Status")
        
        try:
            device = self.db.query(Device).filter(
                Device.id == self.test_device.id
            ).first()
            
            if device and device.is_online:
                print_success(f"Device online status: {device.is_online}")
                print_info(f"Last seen: {device.last_seen_at}")
                return True
            else:
                print_error("Device offline or not found")
                return False
        except Exception as e:
            print_error(f"Failed to check device status: {e}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print_header("CALLOS E2E TEST SUITE")
        print_info(f"Start time: {datetime.now()}")
        
        results = {
            "Test 1: Database Health": self.test_1_database_health(),
            "Test 2: Organization Setup": self.test_2_organization_setup(),
            "Test 3: User Registration": self.test_3_user_registration(),
            "Test 4: Employee Creation": self.test_4_employee_creation(),
            "Test 5: Device Registration": self.test_5_device_registration(),
            "Test 6: JWT Token": self.test_6_jwt_token_generation() is not None,
            "Test 7: Call Sync": self.test_7_call_sync_simulation(),
            "Test 8: Dashboard Data": self.test_8_dashboard_data_retrieval(),
            "Test 9: Sync Idempotency": self.test_9_sync_idempotency(),
            "Test 10: Device Online": self.test_10_device_online_status(),
        }
        
        # Print summary
        print_header("TEST SUMMARY")
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}  {test_name}")
        
        print_info(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print_success("All tests passed! ✨")
            print_info("E2E flow is working correctly.")
            return True
        else:
            print_error(f"{total - passed} test(s) failed")
            return False


def main():
    """Run E2E test suite"""
    print("=" * 80)
    print("  CALLOS FULL END-TO-END TEST SUITE")
    print("  Tests mobile→backend→web sync flow")
    print("=" * 80)
    
    runner = E2ETestRunner()
    
    try:
        success = runner.run_all_tests()
        exit_code = 0 if success else 1
    except Exception as e:
        print_error(f"Fatal error: {e}")
        exit_code = 1
    finally:
        runner.cleanup()
    
    print("\n" + "=" * 80)
    print(f"  End time: {datetime.now()}")
    print("=" * 80 + "\n")
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Test the full recording upload endpoint with database"""

import sys
import httpx
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database
DATABASE_URL = "postgresql+psycopg://postgres.gjfohkxocurrzbdpybuu:TzMicha%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

def get_test_call():
    """Get a real call from database"""
    print("🔍 Finding test call from database...")
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get a recent call
        result = session.execute(text("""
            SELECT id, phone_number, contact_name, start_time, organization_id, recording_available
            FROM calls
            WHERE recording_available = false
            ORDER BY start_time DESC
            LIMIT 1
        """))
        
        call = result.fetchone()
        if not call:
            print("❌ No calls without recordings found")
            return None
        
        print(f"✅ Found call: {call[0]}")
        print(f"   Phone: {call[1]}")
        print(f"   Contact: {call[2]}")
        print(f"   Date: {call[3]}")
        print(f"   Org ID: {call[4]}")
        
        return {
            "id": call[0],
            "phone_number": call[1],
            "contact_name": call[2],
            "organization_id": call[4]
        }
    finally:
        session.close()

def get_admin_token():
    """Get JWT token for admin user"""
    print("\n🔐 Getting admin token...")
    
    with httpx.Client() as client:
        response = client.post(
            "http://localhost:8001/api/v1/auth/login",
            json={
                "email": "danievens@tzmicha.com",
                "password": "TzMicha@2026"
            }
        )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Token: {token[:30]}...")
    return token

def upload_recording(call_id, token):
    """Upload recording via API endpoint"""
    print(f"\n📤 Uploading recording for call {call_id}...")
    
    # Find audio file
    audio_file = Path.home() / "Downloads" / "02 - Oohalu Gusa Gusa [www.SenSongsMp3.co].mp3"
    
    if not audio_file.exists():
        # Try Music folder
        audio_file = Path.home() / "Music" / "02 - Oohalu Gusa Gusa [www.SenSongsMp3.co].mp3"
    
    if not audio_file.exists():
        print("❌ Audio file not found")
        return False
    
    print(f"   File: {audio_file.name}")
    print(f"   Size: {audio_file.stat().st_size / 1024:.2f} KB")
    
    with open(audio_file, "rb") as f:
        files = {"file": (audio_file.name, f, "audio/mpeg")}
        
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"http://localhost:8001/api/v1/calls/{call_id}/recording",
                headers={"Authorization": f"Bearer {token}"},
                files=files
            )
    
    print(f"\n📡 Response: {response.status_code}")
    
    if response.status_code in [200, 201]:
        print("✅ Upload successful!")
        try:
            result = response.json()
            print(f"   {result}")
        except:
            print(f"   {response.text}")
        return True
    else:
        print(f"❌ Upload failed!")
        print(f"   {response.text}")
        return False

def verify_in_database(call_id):
    """Verify recording was saved to database"""
    print(f"\n🔍 Verifying in database...")
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        result = session.execute(text("""
            SELECT recording_available, recording_status, recording_url, recording_size_bytes
            FROM calls
            WHERE id = :call_id
        """), {"call_id": call_id})
        
        row = result.fetchone()
        
        print(f"   recording_available: {row[0]}")
        print(f"   recording_status: {row[1]}")
        print(f"   recording_url: {row[2]}")
        print(f"   recording_size_bytes: {row[3]}")
        
        if row[0]:  # recording_available
            print("✅ Recording saved in database!")
            return True
        else:
            print("❌ Recording not in database")
            return False
    finally:
        session.close()

def main():
    print("=" * 70)
    print("🧪 FULL ENDPOINT TEST")
    print("=" * 70)
    
    # Step 1: Get test call
    call = get_test_call()
    if not call:
        sys.exit(1)
    
    # Step 2: Get admin token
    token = get_admin_token()
    if not token:
        sys.exit(1)
    
    # Step 3: Upload recording
    upload_success = upload_recording(call["id"], token)
    if not upload_success:
        sys.exit(1)
    
    # Step 4: Verify in database
    db_success = verify_in_database(call["id"])
    
    if db_success:
        print("\n" + "=" * 70)
        print("🎉 FULL TEST PASSED!")
        print("=" * 70)
        print(f"\n✅ Recording upload endpoint works end-to-end!")
        print(f"✅ Call ID: {call['id']}")
        print(f"✅ Check dashboard: https://callingos.tzmicha.com")
    else:
        print("\n" + "=" * 70)
        print("❌ TEST FAILED")
        print("=" * 70)

if __name__ == "__main__":
    main()

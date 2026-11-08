#!/usr/bin/env python3
"""
Test script for manual recording upload endpoint
Tests: POST /api/calls/{call_id}/recording
"""

import requests
import os
import sys
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000"  # Local backend
TEST_EMAIL = "danievens@tzmicha.com"
TEST_PASSWORD = "TzMicha@2026"

def login():
    """Login and get JWT token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Login successful! Token: {token[:20]}...")
    return token

def get_test_call_id(token):
    """Get a call ID for testing"""
    print("\n📞 Fetching recent calls...")
    response = requests.get(
        f"{API_BASE_URL}/api/calls?page=1&page_size=10",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to fetch calls: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    data = response.json()
    calls = data.get("calls", [])
    
    if not calls:
        print("❌ No calls found in database")
        sys.exit(1)
    
    # Find a call without recording
    for call in calls:
        if not call.get("recording_available"):
            call_id = call["id"]
            print(f"✅ Found test call: {call_id}")
            print(f"   Phone: {call['phone_number']}")
            print(f"   Contact: {call.get('contact_name', 'Unknown')}")
            print(f"   Date: {call['start_time']}")
            return call_id
    
    # If all have recordings, just use the first one
    call_id = calls[0]["id"]
    print(f"⚠️ Using call with existing recording: {call_id}")
    return call_id

def create_test_audio_file():
    """Create a small test audio file (silent M4A)"""
    print("\n🎵 Creating test audio file...")
    
    # Create a minimal valid M4A file (MPEG-4 container with AAC audio)
    # This is a silent 1-second M4A file
    test_audio_path = Path(__file__).parent / "test_recording.m4a"
    
    # Minimal M4A file header (valid but silent)
    m4a_header = bytes([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,  # ftyp box
        0x4d, 0x34, 0x41, 0x20, 0x00, 0x00, 0x00, 0x00,  # M4A brand
        0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,  # compatible brands
        0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08,
        0x66, 0x72, 0x65, 0x65,                          # free box
    ])
    
    with open(test_audio_path, "wb") as f:
        f.write(m4a_header)
        # Add some padding to make it ~1KB
        f.write(b'\x00' * 1000)
    
    print(f"✅ Test audio file created: {test_audio_path}")
    print(f"   Size: {test_audio_path.stat().st_size} bytes")
    return test_audio_path

def upload_recording(token, call_id, audio_file_path):
    """Upload recording to the API"""
    print(f"\n📤 Uploading recording to call {call_id}...")
    
    with open(audio_file_path, "rb") as f:
        files = {"file": ("test_recording.m4a", f, "audio/mp4")}
        response = requests.post(
            f"{API_BASE_URL}/api/calls/{call_id}/recording",
            headers={"Authorization": f"Bearer {token}"},
            files=files
        )
    
    print(f"📡 Response status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        print("✅ Upload successful!")
        try:
            result = response.json()
            print(f"   Response: {result}")
        except:
            print(f"   Response text: {response.text}")
        return True
    else:
        print(f"❌ Upload failed!")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def verify_recording(token, call_id):
    """Verify the recording was saved"""
    print(f"\n🔍 Verifying recording for call {call_id}...")
    
    response = requests.get(
        f"{API_BASE_URL}/api/calls/{call_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to fetch call: {response.status_code}")
        return False
    
    call = response.json()
    
    print(f"   recording_available: {call.get('recording_available')}")
    print(f"   recording_status: {call.get('recording_status')}")
    print(f"   recording_url: {call.get('recording_url', 'None')[:50] if call.get('recording_url') else 'None'}...")
    print(f"   recording_size_bytes: {call.get('recording_size_bytes')}")
    
    if call.get("recording_available"):
        print("✅ Recording verified in database!")
        return True
    else:
        print("❌ Recording not found in database")
        return False

def cleanup(audio_file_path):
    """Remove test file"""
    if audio_file_path.exists():
        audio_file_path.unlink()
        print(f"\n🧹 Cleaned up test file: {audio_file_path}")

def main():
    print("=" * 60)
    print("🧪 MANUAL RECORDING UPLOAD TEST")
    print("=" * 60)
    
    audio_file_path = None
    
    try:
        # Step 1: Login
        token = login()
        
        # Step 2: Get test call
        call_id = get_test_call_id(token)
        
        # Step 3: Create test audio file
        audio_file_path = create_test_audio_file()
        
        # Step 4: Upload recording
        upload_success = upload_recording(token, call_id, audio_file_path)
        
        if upload_success:
            # Step 5: Verify recording
            verify_success = verify_recording(token, call_id)
            
            if verify_success:
                print("\n" + "=" * 60)
                print("🎉 TEST PASSED!")
                print("=" * 60)
                print(f"\n✅ Manual recording upload works!")
                print(f"✅ Call ID: {call_id}")
                print(f"✅ Check dashboard: {API_BASE_URL.replace('https://', 'https://callingos.')}")
            else:
                print("\n" + "=" * 60)
                print("⚠️ TEST PARTIAL - Upload succeeded but verification failed")
                print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("❌ TEST FAILED - Upload failed")
            print("=" * 60)
    
    finally:
        # Cleanup
        if audio_file_path:
            cleanup(audio_file_path)

if __name__ == "__main__":
    main()

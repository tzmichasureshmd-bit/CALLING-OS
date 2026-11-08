#!/usr/bin/env python3
"""Quick test: Upload audio file directly to Supabase storage"""

import os
import sys
import httpx
from pathlib import Path

# Supabase config from your .env
SUPABASE_URL = "https://gjfohkxocurrzbdpybuu.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZm9oa3hvY3VycnpiZHB5YnV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODM3NzQ2OCwiZXhwIjoyMTAzOTUzNDY4fQ.jKIf6t6Ngd9LGwB7ZxXm32Zgk1Yh81A2ZNvuyF6GgmI"
BUCKET_NAME = "call-recordings"

def find_audio_file():
    """Find any audio file on Windows"""
    # Common Windows audio locations
    search_paths = [
        Path.home() / "Music",
        Path.home() / "Downloads",
        Path("C:/Windows/Media"),  # System sounds
    ]
    
    for search_path in search_paths:
        if not search_path.exists():
            continue
        
        print(f"🔍 Searching in: {search_path}")
        
        # Look for audio files
        for ext in ["*.mp3", "*.m4a", "*.wav", "*.mp4"]:
            files = list(search_path.glob(ext))
            if files:
                audio_file = files[0]
                size_mb = audio_file.stat().st_size / (1024 * 1024)
                if size_mb < 50:  # Use small files only
                    print(f"✅ Found: {audio_file.name} ({size_mb:.2f} MB)")
                    return audio_file
    
    return None

def upload_to_supabase(audio_file):
    """Upload audio file to Supabase storage"""
    if not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_SERVICE_ROLE_KEY not set in environment")
        return False
    
    print(f"\n📤 Uploading to Supabase...")
    print(f"   URL: {SUPABASE_URL}")
    print(f"   Bucket: {BUCKET_NAME}")
    
    # Storage path: org_id/call_id.ext
    test_org_id = "tzm_org_test"
    test_call_id = "tzm_cal_test_001"
    file_ext = audio_file.suffix.lstrip(".")
    storage_path = f"{test_org_id}/{test_call_id}.{file_ext}"
    
    print(f"   Path: {storage_path}")
    
    storage_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{storage_path}"
    
    # Read file
    with open(audio_file, "rb") as f:
        file_content = f.read()
    
    file_size = len(file_content)
    print(f"   Size: {file_size} bytes")
    
    # Upload
    try:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                storage_url,
                content=file_content,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "audio/mpeg",
                    "Content-Length": str(file_size),
                    "x-upsert": "true",
                }
            )
        
        print(f"\n📡 Response: {response.status_code}")
        print(f"   Body: {response.text}")
        
        if response.status_code in [200, 201]:
            print("\n✅ SUCCESS! File uploaded to Supabase")
            print(f"\n🔗 Storage path: {storage_path}")
            print(f"🔗 Full URL: {storage_url}")
            return True
        else:
            print(f"\n❌ FAILED! Status {response.status_code}")
            return False
    
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False

def main():
    print("=" * 70)
    print("🚀 QUICK SUPABASE UPLOAD TEST")
    print("=" * 70)
    
    # Find audio file
    audio_file = find_audio_file()
    if not audio_file:
        print("\n❌ No audio file found!")
        print("💡 Put an MP3/M4A file in your Downloads or Music folder")
        sys.exit(1)
    
    # Upload
    success = upload_to_supabase(audio_file)
    
    if success:
        print("\n" + "=" * 70)
        print("🎉 TEST PASSED - Supabase storage works!")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("❌ TEST FAILED - Check Supabase credentials")
        print("=" * 70)

if __name__ == "__main__":
    main()

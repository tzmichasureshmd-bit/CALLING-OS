"""
Push Notification Service for CallNexa
Sends Firebase Cloud Messaging (FCM) push notifications to devices
"""
import os
import json
import httpx
from typing import Optional, Dict, Any
from app.database import get_db
from sqlalchemy import text

# FCM API endpoint
FCM_API_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

# Will be set from env or Supabase
FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "")
FCM_SERVICE_ACCOUNT = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "")


async def send_push_notification(
    device_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Send push notification to a specific device.
    
    Args:
        device_id: The device identifier (from devices table)
        title: Notification title
        body: Notification body text
        data: Optional data payload
    
    Returns:
        True if sent successfully, False otherwise
    """
    try:
        # Get FCM token from database
        db = next(get_db())
        result = db.execute(
            text("""
                SELECT fcm_token 
                FROM devices 
                WHERE id = :device_id 
                AND fcm_token IS NOT NULL
            """),
            {"device_id": device_id}
        ).fetchone()
        
        if not result or not result.fcm_token:
            print(f"No FCM token found for device {device_id}")
            return False
        
        fcm_token = result.fcm_token
        
        # Build FCM message
        message = {
            "message": {
                "token": fcm_token,
                "notification": {
                    "title": title,
                    "body": body
                },
                "data": data or {},
                "android": {
                    "priority": "high",
                    "notification": {
                        "channel_id": "system_alerts",
                        "sound": "default",
                        "color": "#14b8a6"
                    }
                }
            }
        }
        
        # Get OAuth2 token (if using service account)
        # For now, use HTTP v1 API with server key
        # TODO: Implement proper OAuth2 flow
        
        # Send via FCM legacy API (simpler for now)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                headers={
                    "Authorization": f"key={os.getenv('FCM_SERVER_KEY', '')}",
                    "Content-Type": "application/json"
                },
                json={
                    "to": fcm_token,
                    "notification": {
                        "title": title,
                        "body": body
                    },
                    "data": data or {},
                    "priority": "high"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                print(f"✅ Push notification sent to device {device_id}")
                return True
            else:
                print(f"❌ FCM error: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Push notification error: {str(e)}")
        return False


async def notify_device_connection_request(device_id: str, org_name: str) -> bool:
    """
    Send push notification when someone clicks 'Connect' on a device.
    
    Args:
        device_id: The device ID
        org_name: The organization name
    
    Returns:
        True if sent successfully
    """
    return await send_push_notification(
        device_id=device_id,
        title="🔗 Connection Request",
        body=f"{org_name} wants to connect to your device",
        data={
            "type": "connection_request",
            "device_id": device_id,
            "action": "open_app"
        }
    )


async def notify_device_status_change(device_id: str, status: str) -> bool:
    """
    Notify device about status changes (online, offline, disconnected).
    """
    status_messages = {
        "online": "✅ Device is now online",
        "offline": "⏸️ Device went offline",
        "disconnected": "🔌 Device disconnected from dashboard"
    }
    
    return await send_push_notification(
        device_id=device_id,
        title="Device Status Update",
        body=status_messages.get(status, f"Status changed to {status}"),
        data={
            "type": "status_change",
            "device_id": device_id,
            "status": status
        }
    )


async def notify_call_logged(device_id: str, call_type: str, duration: int) -> bool:
    """
    Notify device that a call was logged from the web dashboard.
    """
    return await send_push_notification(
        device_id=device_id,
        title="📞 Call Logged",
        body=f"{call_type.capitalize()} call logged ({duration}s)",
        data={
            "type": "call_logged",
            "device_id": device_id,
            "call_type": call_type
        }
    )

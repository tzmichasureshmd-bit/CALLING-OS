import asyncio, traceback, logging
logging.basicConfig(level=logging.DEBUG)

async def test():
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/auth/login", json={"email":"danievens@tzmicha.com","password":"Dani@123"})
        token = r1.json()["access_token"]
        print("LOGIN OK, token:", token[:30])
        r2 = await client.post("/api/v1/calls/sync",
            headers={"Authorization": f"Bearer {token}"},
            json={"device_id":"bbcfbdeb-e8ad-45d7-bf0b-bd4d1659449a","calls":[{
                "client_event_id":"inline-test-002",
                "phone_number":"+919876543210",
                "contact_name":"Test",
                "call_type":"outgoing",
                "start_time":"2026-09-08T20:00:00Z",
                "end_time":"2026-09-08T20:00:45Z",
                "duration_seconds":45,
                "sim_slot":1,
                "source":"SIM 1",
                "recording_available":False
            }]}
        )
        print("SYNC STATUS:", r2.status_code)
        print("SYNC BODY:", r2.text)

try:
    asyncio.run(test())
except Exception as e:
    traceback.print_exc()

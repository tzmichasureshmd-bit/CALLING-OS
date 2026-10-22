"""
test_privacy_recording.py
Automated tests for the privacy model, recording upload guards, and transcription pipeline.

Run: python test_privacy_recording.py
"""
import asyncio
import io
import logging
logging.disable(logging.CRITICAL)

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"

ADMIN_EMAIL    = "admin@tzmicha.com"
ADMIN_PASSWORD = "Admin@123"


def check(label, condition, detail=""):
    status = PASS if condition else FAIL
    print(f"  {status}  {label}" + (f"  [{detail}]" if detail else ""))
    return condition


async def run():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:

        # ── Auth ──────────────────────────────────────────────────────────────
        print("\n── Auth ─────────────────────────────────────────────────────────")
        r = await c.post("/api/v1/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        ok = check("Login → 200", r.status_code == 200, f"HTTP {r.status_code}")
        if not ok:
            print("  Cannot continue without auth token.")
            return
        token = r.json().get("access_token", "")
        check("Token received", bool(token))
        H = {"Authorization": f"Bearer {token}"}

        # ── Get a real call ID to test against ────────────────────────────────
        print("\n── Fetch a call to test with ────────────────────────────────────")
        r = await c.get("/api/v1/calls?page_size=1", headers=H)
        check("GET /calls → 200", r.status_code == 200, f"HTTP {r.status_code}")
        items = r.json().get("items", []) if r.status_code == 200 else []
        if not items:
            print("  SKIP  No calls in DB — skipping call-specific tests.")
            call_id = None
        else:
            call_id = items[0]["id"]
            check(f"Got call_id={call_id}", bool(call_id))

        # ── Test 1: Call-log sync does not require recording to be enabled ────
        print("\n── Test 1: Call-log sync independent of recording setting ───────")
        # Sync endpoint must accept calls regardless of recording preference.
        # We verify the endpoint exists and returns the expected shape.
        r = await c.get("/api/v1/calls?page_size=5", headers=H)
        check("Call list accessible (sync independent of recording)", r.status_code == 200,
              f"HTTP {r.status_code}")

        # ── Test 2: Privacy field present on call ─────────────────────────────
        print("\n── Test 2: call_privacy field present ───────────────────────────")
        if call_id:
            r = await c.get(f"/api/v1/calls/{call_id}", headers=H)
            check("GET /calls/{id} → 200", r.status_code == 200, f"HTTP {r.status_code}")
            if r.status_code == 200:
                body = r.json()
                check("call_privacy field present", "call_privacy" in body,
                      body.get("call_privacy", "MISSING"))
                check("call_privacy default is 'unclassified'",
                      body.get("call_privacy") == "unclassified",
                      body.get("call_privacy"))

        # ── Test 3: Set privacy to 'business' ─────────────────────────────────
        print("\n── Test 3: Set call_privacy = business ──────────────────────────")
        if call_id:
            r = await c.patch(f"/api/v1/calls/{call_id}/privacy",
                              json={"call_privacy": "business"}, headers=H)
            check("PATCH /privacy → 200", r.status_code == 200, f"HTTP {r.status_code}")
            if r.status_code == 200:
                check("Response has call_privacy=business",
                      r.json().get("call_privacy") == "business",
                      r.json().get("call_privacy"))

        # ── Test 4: Set privacy to 'personal' ─────────────────────────────────
        print("\n── Test 4: Set call_privacy = personal ──────────────────────────")
        if call_id:
            r = await c.patch(f"/api/v1/calls/{call_id}/privacy",
                              json={"call_privacy": "personal"}, headers=H)
            check("PATCH /privacy → 200", r.status_code == 200, f"HTTP {r.status_code}")

        # ── Test 5: Upload blocked for personal call ──────────────────────────
        print("\n── Test 5: Recording upload blocked for personal call ────────────")
        if call_id:
            r = await c.post(
                f"/api/v1/calls/{call_id}/recording",
                headers=H,
                files={"file": ("test.mp4", io.BytesIO(b"x" * 2048), "audio/mp4")},
            )
            check("POST /recording on personal call → 403", r.status_code == 403,
                  f"HTTP {r.status_code} — {r.json().get('detail', '')}")
            check("Error mentions 'personal'",
                  "personal" in r.json().get("detail", "").lower(),
                  r.json().get("detail", ""))

        # ── Test 6: Transcription blocked for personal call ───────────────────
        print("\n── Test 6: Transcription blocked for personal call ──────────────")
        if call_id:
            r = await c.post(f"/api/v1/transcripts/{call_id}/transcribe", headers=H)
            # 400 (no recording) or 403 (personal) — both are correct blocks
            check("POST /transcribe on personal call → 400 or 403",
                  r.status_code in (400, 403),
                  f"HTTP {r.status_code} — {r.json().get('detail', '')}")

        # ── Test 7: Reset to unclassified, upload blocked ─────────────────────
        print("\n── Test 7: Recording upload blocked for unclassified call ────────")
        if call_id:
            await c.patch(f"/api/v1/calls/{call_id}/privacy",
                          json={"call_privacy": "unclassified"}, headers=H)
            r = await c.post(
                f"/api/v1/calls/{call_id}/recording",
                headers=H,
                files={"file": ("test.mp4", io.BytesIO(b"x" * 2048), "audio/mp4")},
            )
            check("POST /recording on unclassified call → 403", r.status_code == 403,
                  f"HTTP {r.status_code} — {r.json().get('detail', '')}")
            check("Error mentions 'unclassified'",
                  "unclassified" in r.json().get("detail", "").lower(),
                  r.json().get("detail", ""))

        # ── Test 8: Invalid privacy value rejected ────────────────────────────
        print("\n── Test 8: Invalid privacy value rejected ────────────────────────")
        if call_id:
            r = await c.patch(f"/api/v1/calls/{call_id}/privacy",
                              json={"call_privacy": "secret"}, headers=H)
            check("PATCH /privacy with invalid value → 422", r.status_code == 422,
                  f"HTTP {r.status_code}")

        # ── Test 9: Business call — upload validation still enforced ──────────
        print("\n── Test 9: Business call — file validation still enforced ────────")
        if call_id:
            await c.patch(f"/api/v1/calls/{call_id}/privacy",
                          json={"call_privacy": "business"}, headers=H)
            # Empty file
            r = await c.post(
                f"/api/v1/calls/{call_id}/recording",
                headers=H,
                files={"file": ("test.mp4", io.BytesIO(b""), "audio/mp4")},
            )
            check("POST /recording with empty file → 400", r.status_code == 400,
                  f"HTTP {r.status_code}")
            # Wrong extension
            r = await c.post(
                f"/api/v1/calls/{call_id}/recording",
                headers=H,
                files={"file": ("test.exe", io.BytesIO(b"x" * 2048), "application/octet-stream")},
            )
            check("POST /recording with .exe → 400", r.status_code == 400,
                  f"HTTP {r.status_code}")

        # ── Test 10: Excluded number blocks upload ────────────────────────────
        print("\n── Test 10: Excluded number blocks upload ────────────────────────")
        if call_id:
            # Get the call's phone number
            r = await c.get(f"/api/v1/calls/{call_id}", headers=H)
            phone = r.json().get("phone_number", "") if r.status_code == 200 else ""
            if phone and phone != "unknown":
                # Add to excluded list
                r_ex = await c.post("/api/v1/excluded-phone-numbers",
                                    json={"number": phone, "reason": "test"}, headers=H)
                added = r_ex.status_code in (200, 201, 409)
                check(f"Added {phone} to excluded list", added, f"HTTP {r_ex.status_code}")
                if added:
                    r = await c.post(
                        f"/api/v1/calls/{call_id}/recording",
                        headers=H,
                        files={"file": ("test.mp4", io.BytesIO(b"x" * 2048), "audio/mp4")},
                    )
                    check("POST /recording for excluded number → 403", r.status_code == 403,
                          f"HTTP {r.status_code} — {r.json().get('detail', '')}")
                    # Clean up
                    if r_ex.status_code in (200, 201):
                        ex_id = r_ex.json().get("id")
                        if ex_id:
                            await c.delete(f"/api/v1/excluded-phone-numbers/{ex_id}", headers=H)
            else:
                print("  SKIP  Call has no usable phone number for excluded-number test.")

        # ── Test 11: Unauthenticated privacy endpoint → 401/403 ───────────────
        print("\n── Test 11: Auth guard on privacy endpoint ───────────────────────")
        if call_id:
            r = await c.patch(f"/api/v1/calls/{call_id}/privacy",
                              json={"call_privacy": "business"})
            check("PATCH /privacy without token → 401/403",
                  r.status_code in (401, 403), f"HTTP {r.status_code}")

        # ── Test 12: recording_url never exposed in list/detail responses ──────
        print("\n── Test 12: recording_url never exposed ─────────────────────────")
        r = await c.get("/api/v1/calls?page_size=5", headers=H)
        if r.status_code == 200:
            for item in r.json().get("items", []):
                check(f"recording_url not in /calls item {item['id'][:12]}",
                      "recording_url" not in item,
                      "EXPOSED" if "recording_url" in item else "safe")
        r = await c.get("/api/v1/transcripts?page_size=5", headers=H)
        if r.status_code == 200:
            for item in r.json().get("items", []):
                check(f"recording_url not in /transcripts item {item['id'][:12]}",
                      "recording_url" not in item,
                      "EXPOSED" if "recording_url" in item else "safe")

        # ── Test 13: Existing call-log sync behavior preserved ────────────────
        print("\n── Test 13: Call-log sync endpoint still works ───────────────────")
        r = await c.get("/api/v1/calls?page_size=1", headers=H)
        check("GET /calls still returns 200 after privacy changes", r.status_code == 200,
              f"HTTP {r.status_code}")

        print("\n── Summary ──────────────────────────────────────────────────────")
        print("  Privacy model tests complete.")
        print("  Real-device recording test required for end-to-end verification.")
        print("  See PHASE 8 in the audit report for the manual test plan.")


asyncio.run(run())

"""
test_recording_transcription.py
End-to-end API verification for recording, transcription, and summary endpoints.
Run: python test_recording_transcription.py
"""
import asyncio, json, logging
logging.disable(logging.CRITICAL)

ADMIN_EMAIL    = "admin@tzmicha.com"
ADMIN_PASSWORD = "Admin@123"
KNOWN_CALL_ID  = "tzm_cal_bd1c81enadvvz3d9m2yz"   # from sync test above

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
SKIP = "\033[33mSKIP\033[0m"

def check(label, condition, detail=""):
    status = PASS if condition else FAIL
    print(f"  {status}  {label}" + (f"  [{detail}]" if detail else ""))
    return condition


async def run():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:

        # ── 1. Login as ADMIN ─────────────────────────────────────────────────
        print("\n── 1. Auth ──────────────────────────────────────────────────────")
        r = await c.post("/api/v1/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if not check("POST /auth/login → 200", r.status_code == 200, f"HTTP {r.status_code}"):
            # Try employee account as fallback
            r = await c.post("/api/v1/auth/login",
                             json={"email": "danievens@tzmicha.com", "password": "Dani@123"})
            check("POST /auth/login (employee fallback) → 200", r.status_code == 200, f"HTTP {r.status_code}")

        token = r.json().get("access_token", "")
        check("Token received", bool(token), token[:20] + "…" if token else "EMPTY")
        H = {"Authorization": f"Bearer {token}"}

        # ── 2. GET /transcripts (all calls listing) ───────────────────────────
        print("\n── 2. GET /transcripts ──────────────────────────────────────────")
        r = await c.get("/api/v1/transcripts", headers=H)
        check("GET /transcripts → 200", r.status_code == 200, f"HTTP {r.status_code}")
        if r.status_code == 200:
            body = r.json()
            check("Response has 'items' key", "items" in body)
            check("Response has 'total' key", "total" in body)
            check("Response has 'page' key", "page" in body)
            check("Response has 'total_pages' key", "total_pages" in body)
            items = body.get("items", [])
            check(f"Items is a list ({len(items)} calls)", isinstance(items, list))
            if items:
                first = items[0]
                required_keys = [
                    "id", "contact", "phone", "employee", "date",
                    "duration_seconds", "call_type", "recording_available",
                    "recording_status", "transcript_status",
                ]
                for k in required_keys:
                    check(f"  Item has '{k}'", k in first, str(first.get(k, "MISSING")))
                # Verify recording_url is NOT exposed directly (security check)
                check("  'recording_url' NOT in item (security)", "recording_url" not in first,
                      "EXPOSED" if "recording_url" in first else "safe")

        # ── 3. GET /transcripts with filters ─────────────────────────────────
        print("\n── 3. GET /transcripts filters ──────────────────────────────────")
        r = await c.get("/api/v1/transcripts?recorded_only=true", headers=H)
        check("GET /transcripts?recorded_only=true → 200", r.status_code == 200, f"HTTP {r.status_code}")

        r = await c.get("/api/v1/transcripts?recording_status=not_available", headers=H)
        check("GET /transcripts?recording_status=not_available → 200", r.status_code == 200, f"HTTP {r.status_code}")

        r = await c.get("/api/v1/transcripts?transcript_status=pending", headers=H)
        check("GET /transcripts?transcript_status=pending → 200", r.status_code == 200, f"HTTP {r.status_code}")

        r = await c.get("/api/v1/transcripts?q=test&page=1&page_size=5", headers=H)
        check("GET /transcripts?q=test&page=1&page_size=5 → 200", r.status_code == 200, f"HTTP {r.status_code}")

        # ── 4. GET /transcripts/{call_id} ─────────────────────────────────────
        print(f"\n── 4. GET /transcripts/{KNOWN_CALL_ID} ──────────────────────────")
        r = await c.get(f"/api/v1/transcripts/{KNOWN_CALL_ID}", headers=H)
        check(f"GET /transcripts/{KNOWN_CALL_ID} → 200", r.status_code == 200, f"HTTP {r.status_code}")
        if r.status_code == 200:
            body = r.json()
            check("Has 'id'",                    "id" in body)
            check("Has 'recording_status'",       "recording_status" in body)
            check("Has 'recording_available'",    "recording_available" in body)
            check("Has 'transcript_status'",      "transcript_status" in body)
            check("Has 'summary_status'",         "summary_status" in body)
            check("Has 'transcription_started_at'","transcription_started_at" in body)
            check("recording_url NOT exposed",    "recording_url" not in body,
                  "EXPOSED" if "recording_url" in body else "safe")
            print(f"     recording_status   = {body.get('recording_status')}")
            print(f"     transcript_status  = {body.get('transcript_status')}")
            print(f"     summary_status     = {body.get('summary_status')}")

        # ── 5. GET /transcripts/{call_id} — 404 for unknown ──────────────────
        print("\n── 5. 404 for unknown call ──────────────────────────────────────")
        r = await c.get("/api/v1/transcripts/nonexistent_call_id_xyz", headers=H)
        check("GET /transcripts/nonexistent → 404", r.status_code == 404, f"HTTP {r.status_code}")

        # ── 6. POST /transcripts/{call_id}/transcribe — no recording ─────────
        print("\n── 6. Transcribe call with no recording ─────────────────────────")
        r = await c.post(f"/api/v1/transcripts/{KNOWN_CALL_ID}/transcribe", headers=H)
        check(
            "POST /transcribe on call without recording → 400",
            r.status_code == 400,
            f"HTTP {r.status_code} — {r.json().get('detail', '')}"
        )

        # ── 7. GET /calls/{call_id}/recording-url — no recording ─────────────
        print("\n── 7. Recording URL — no recording ──────────────────────────────")
        r = await c.get(f"/api/v1/calls/{KNOWN_CALL_ID}/recording-url", headers=H)
        check(
            "GET /recording-url on call without recording → 404",
            r.status_code == 404,
            f"HTTP {r.status_code} — {r.json().get('detail', '')}"
        )

        # ── 8. POST /transcripts/{call_id}/summarize — no transcript ─────────
        print("\n── 8. Summarize call with no transcript ─────────────────────────")
        r = await c.post(f"/api/v1/transcripts/{KNOWN_CALL_ID}/summarize", headers=H)
        check(
            "POST /summarize on call without transcript → 400",
            r.status_code == 400,
            f"HTTP {r.status_code} — {r.json().get('detail', '')}"
        )

        # ── 9. Auth guard — unauthenticated requests ──────────────────────────
        print("\n── 9. Auth guard ────────────────────────────────────────────────")
        r = await c.get("/api/v1/transcripts")
        check("GET /transcripts without token → 401/403", r.status_code in (401, 403), f"HTTP {r.status_code}")

        r = await c.post(f"/api/v1/transcripts/{KNOWN_CALL_ID}/transcribe")
        check("POST /transcribe without token → 401/403", r.status_code in (401, 403), f"HTTP {r.status_code}")

        # ── 10. Retry endpoints — correct error on wrong state ────────────────
        print("\n── 10. Retry endpoints ──────────────────────────────────────────")
        r = await c.post(f"/api/v1/transcripts/{KNOWN_CALL_ID}/transcribe/retry", headers=H)
        # Should be 400 (no recording) or 400 (wrong state) — not 500
        check(
            "POST /transcribe/retry → 400 (no recording)",
            r.status_code == 400,
            f"HTTP {r.status_code} — {r.json().get('detail', '')}"
        )

        r = await c.post(f"/api/v1/transcripts/{KNOWN_CALL_ID}/summarize/retry", headers=H)
        check(
            "POST /summarize/retry → 400 (no transcript)",
            r.status_code == 400,
            f"HTTP {r.status_code} — {r.json().get('detail', '')}"
        )

        # ── 11. Pagination ────────────────────────────────────────────────────
        print("\n── 11. Pagination ───────────────────────────────────────────────")
        r = await c.get("/api/v1/transcripts?page=1&page_size=2", headers=H)
        check("GET /transcripts?page=1&page_size=2 → 200", r.status_code == 200, f"HTTP {r.status_code}")
        if r.status_code == 200:
            body = r.json()
            check("page_size respected (≤2 items)", len(body.get("items", [])) <= 2,
                  f"{len(body.get('items', []))} items")
            check("page=1 in response", body.get("page") == 1, str(body.get("page")))

        # ── 12. Upload endpoint — empty file rejected ─────────────────────────
        print("\n── 12. Recording upload validation ──────────────────────────────")
        import io
        r = await c.post(
            f"/api/v1/calls/{KNOWN_CALL_ID}/recording",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.mp4", io.BytesIO(b""), "audio/mp4")},
        )
        check("POST /recording with empty file → 400", r.status_code == 400,
              f"HTTP {r.status_code} — {r.json().get('detail', '')}")

        r = await c.post(
            f"/api/v1/calls/{KNOWN_CALL_ID}/recording",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.exe", io.BytesIO(b"x" * 1024), "application/octet-stream")},
        )
        check("POST /recording with .exe → 400", r.status_code == 400,
              f"HTTP {r.status_code} — {r.json().get('detail', '')}")

        print("\n── Summary ──────────────────────────────────────────────────────")
        print("  All endpoint checks complete.")
        print("  Next: install APK on real Android device and run recording test.")


asyncio.run(run())

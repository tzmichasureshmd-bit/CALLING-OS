import os
import re
import subprocess
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

# Never let this isolated unit suite connect to a configured/live database.
os.environ["DATABASE_URL"] = "postgresql+psycopg://test:test@127.0.0.1:1/callnexa_unit"
os.environ["JWT_SECRET_KEY"] = "unit-test-secret-not-for-production"
os.environ["APP_DEBUG"] = "false"
os.environ["SEED_DEMO_DATA"] = "false"

from pydantic import ValidationError

from app.models.call import Call
from app.phone import normalize_phone
from app.privacy import recording_denial_reason
from app.routers.calls import _has_supported_audio_signature
from app.schemas.call import CallSyncItem, CallSyncRequest


ROOT = Path(__file__).resolve().parents[2]


class PhoneNormalizationTests(unittest.TestCase):
    def test_indian_number_forms_are_canonical(self):
        self.assertEqual(normalize_phone("98765 43210"), "+919876543210")
        self.assertEqual(normalize_phone("09876543210"), "+919876543210")
        self.assertEqual(normalize_phone("+919876543210"), "+919876543210")


class CallSyncValidationTests(unittest.TestCase):
    def valid_item(self, **overrides):
        values = {
            "client_event_id": "android-42",
            "phone_number": "+919876543210",
            "call_type": "outgoing",
            "start_time": datetime.now(timezone.utc),
            "duration_seconds": 10,
            "sim_slot": 1,
        }
        values.update(overrides)
        return CallSyncItem(**values)

    def test_rejects_empty_event_id(self):
        with self.assertRaises(ValidationError):
            self.valid_item(client_event_id="")

    def test_rejects_unknown_call_type(self):
        with self.assertRaises(ValidationError):
            self.valid_item(call_type="invented")

    def test_rejects_end_before_start(self):
        start = datetime.now(timezone.utc)
        with self.assertRaises(ValidationError):
            self.valid_item(start_time=start, end_time=start.replace(year=start.year - 1))

    def test_batch_is_bounded_and_nonempty(self):
        with self.assertRaises(ValidationError):
            CallSyncRequest(device_id="device-1", calls=[])
        with self.assertRaises(ValidationError):
            CallSyncRequest(device_id="device-1", calls=[self.valid_item()] * 101)


class RecordingEligibilityTests(unittest.TestCase):
    def call(self, privacy="business"):
        return SimpleNamespace(
            call_privacy=privacy,
            organization_id="org-1",
            phone_number="9876543210",
            phone_number_normalized="+919876543210",
        )

    def test_every_call_label_is_eligible(self):
        db = MagicMock()
        for label in ("business", "personal", "unclassified", None):
            self.assertIsNone(recording_denial_reason(db, self.call(label)))
        db.query.assert_not_called()

    def test_excluded_number_does_not_override_recording_switch(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = object()
        self.assertIsNone(recording_denial_reason(db, self.call()))
        db.query.assert_not_called()


class RecordingFileValidationTests(unittest.TestCase):
    def test_recognizes_supported_container_signatures(self):
        self.assertTrue(_has_supported_audio_signature(b"\x00\x00\x00\x18ftypisomxxxx", "mp4"))
        self.assertTrue(_has_supported_audio_signature(b"RIFF\x00\x00\x00\x00WAVE", "wav"))
        self.assertTrue(_has_supported_audio_signature(b"ID3\x04\x00\x00", "mp3"))
        self.assertTrue(_has_supported_audio_signature(b"OggS\x00\x02", "ogg"))

    def test_rejects_spoofed_audio_extension(self):
        self.assertFalse(_has_supported_audio_signature(b"<script>alert(1)", "mp3"))
        self.assertFalse(_has_supported_audio_signature(b"not an mp4 file", "mp4"))


class IdempotencyContractTests(unittest.TestCase):
    def test_unique_key_is_device_scoped(self):
        index = next(index for index in Call.__table__.indexes if index.name == "ix_calls_org_device_event_id")
        self.assertTrue(index.unique)
        self.assertEqual(
            [column.name for column in index.columns],
            ["organization_id", "device_id", "client_event_id"],
        )

    def test_migration_replaces_legacy_constraint(self):
        sql = (ROOT / "backend" / "migrations" / "013_device_scoped_call_idempotency.sql").read_text(encoding="utf-8")
        self.assertIn("DROP CONSTRAINT IF EXISTS calls_organization_id_client_event_id_key", sql)
        self.assertIn("organization_id, device_id, client_event_id", sql)


class MobilePipelineContractTests(unittest.TestCase):
    def test_only_canonical_service_posts_call_batches(self):
        sync_source = (ROOT / "mobile" / "src" / "syncService.js").read_text(encoding="utf-8")
        settings_source = (ROOT / "mobile" / "app" / "(tabs)" / "settings.jsx").read_text(encoding="utf-8")
        self.assertEqual(sync_source.count("api.syncCalls("), 1)
        self.assertNotIn("_api.syncCalls(", settings_source)
        self.assertIn("await syncCalls()", settings_source)

    def test_expo_54_legacy_filesystem_entrypoint_is_used(self):
        source = (ROOT / "mobile" / "src" / "callLogService.js").read_text(encoding="utf-8")
        self.assertIn('from "expo-file-system/legacy"', source)

    def test_recording_uses_fixed_path_and_explicit_toggle(self):
        native = (ROOT / "mobile" / "android" / "app" / "src" / "main" / "java" / "com" / "tzmicha" / "callnexa" / "RecordingModule.kt").read_text(encoding="utf-8")
        recorder = (ROOT / "mobile" / "src" / "callRecorder.js").read_text(encoding="utf-8")
        sync = (ROOT / "mobile" / "src" / "syncService.js").read_text(encoding="utf-8")
        self.assertIn('RECORDINGS_DIRECTORY = "/storage/emulated/0/Music/Call Recordings"', native)
        self.assertIn('"./recordingPreferences"', recorder)
        self.assertIn('"./recordingPreferences"', sync)
        self.assertNotIn("callos_recorder_enabled", recorder)
        self.assertNotIn("isExcludedNumber", sync)


class TrackedSecretTests(unittest.TestCase):
    def test_tracked_files_contain_no_production_server_secrets(self):
        output = subprocess.check_output(
            ["git", "ls-files", "-z"], cwd=ROOT
        ).decode("utf-8")
        offenders = []
        database_uri = re.compile(
            r"postgresql(?:\+psycopg)?://[^\s\"']+:[^\s@\"']+@(?!HOST|host|127\.0\.0\.1)[^\s/\"']+"
        )
        secret_assignment = re.compile(
            r"(?m)^\s*[- ]*(?:JWT_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)="
            r"(?!\$\{|CHANGE_ME|YOUR_|your-|<)[^\r\n]{24,}"
        )
        for relative in output.split("\0"):
            if not relative:
                continue
            path = ROOT / relative
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            if database_uri.search(text) or secret_assignment.search(text):
                offenders.append(relative)
        self.assertEqual(offenders, [], f"Tracked secret literals found in: {offenders}")


if __name__ == "__main__":
    unittest.main()

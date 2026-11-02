"""Deprecated compatibility entry point; uses the safe ordered migration runner."""
from migration_runner import run
from pathlib import Path

if __name__ == "__main__":
    raise SystemExit(run([Path(__file__).resolve().parent / "migrations" / "001_expand_sims.sql"]))

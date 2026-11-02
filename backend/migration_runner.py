"""Apply ordered CallNexa SQL migrations using DATABASE_URL.

Each migration runs in its own transaction and is recorded with a SHA-256
checksum. The runner fails closed on changed or failed migrations.

Usage:
    python migration_runner.py
    python migration_runner.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
MIGRATIONS_DIR = BASE_DIR / "migrations"


def _database_url() -> str:
    load_dotenv(BASE_DIR / ".env")
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is required")
    if "@host:" in url or "your-project" in url:
        raise RuntimeError("DATABASE_URL still contains placeholder values")
    # SQLAlchemy uses this driver-qualified form; psycopg expects PostgreSQL's URI.
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _discover() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql"))


def _checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(selected: list[Path] | None = None, *, check_only: bool = False) -> int:
    migrations = selected or _discover()
    if not migrations:
        raise RuntimeError("No migration files found")

    with psycopg.connect(
        _database_url(),
        connect_timeout=30,
        options="-c statement_timeout=60000",
        autocommit=True,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    filename VARCHAR(255) PRIMARY KEY,
                    checksum CHAR(64) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("SELECT filename, checksum FROM schema_migrations")
            applied = dict(cur.fetchall())

        pending: list[Path] = []
        for path in migrations:
            digest = _checksum(path)
            previous = applied.get(path.name)
            if previous and previous != digest:
                raise RuntimeError(
                    f"Applied migration {path.name} has changed; create a new migration instead"
                )
            if not previous:
                pending.append(path)

        if check_only:
            if pending:
                print("Pending migrations:")
                for path in pending:
                    print(f"  {path.name}")
                return 1
            print("Database migrations are current.")
            return 0

        for path in pending:
            sql = path.read_text(encoding="utf-8")
            digest = _checksum(path)
            print(f"Applying {path.name}...")
            # Explicit transaction: a failed file is fully rolled back and stops deploy.
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(sql)
                    cur.execute(
                        "INSERT INTO schema_migrations (filename, checksum) VALUES (%s, %s)",
                        (path.name, digest),
                    )
            print(f"Applied {path.name}.")

        if not pending:
            print("No pending migrations.")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report pending migrations without applying them",
    )
    args = parser.parse_args()
    return run(check_only=args.check)


if __name__ == "__main__":
    raise SystemExit(main())

"""Read-only ORM/live-schema compatibility report.

This script never creates, alters, truncates, inserts, updates, or deletes data.
"""

from sqlalchemy import inspect, text

from app.database import Base, engine
from app import models  # noqa: F401 - registers model metadata


def main() -> int:
    inspector = inspect(engine)
    findings: list[str] = []

    for table_name, table in sorted(Base.metadata.tables.items()):
        if not inspector.has_table(table_name):
            findings.append(f"MISSING_TABLE {table_name}")
            continue

        db_columns = {column["name"]: column for column in inspector.get_columns(table_name)}
        model_columns = {column.name: column for column in table.columns}

        for name in sorted(model_columns.keys() - db_columns.keys()):
            findings.append(f"MISSING_COLUMN {table_name}.{name}")
        for name in sorted(db_columns.keys() - model_columns.keys()):
            findings.append(f"UNMODELED_COLUMN {table_name}.{name}")
        for name in sorted(model_columns.keys() & db_columns.keys()):
            if bool(model_columns[name].nullable) != bool(db_columns[name]["nullable"]):
                findings.append(
                    f"NULLABILITY {table_name}.{name} model={model_columns[name].nullable} db={db_columns[name]['nullable']}"
                )

        db_indexes = {index["name"]: index for index in inspector.get_indexes(table_name)}
        for index in table.indexes:
            existing = db_indexes.get(index.name)
            if not existing:
                findings.append(f"MISSING_INDEX {table_name}.{index.name}")
                continue
            expected_columns = [column.name for column in index.columns]
            if existing.get("column_names") != expected_columns or bool(existing.get("unique")) != bool(index.unique):
                findings.append(f"INDEX_MISMATCH {table_name}.{index.name}")

    with engine.connect() as connection:
        max_connections = connection.execute(text("SHOW max_connections")).scalar()

    print(f"Schema findings: {len(findings)}")
    for finding in findings:
        print(finding)
    print(f"Provider max_connections: {max_connections}")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())

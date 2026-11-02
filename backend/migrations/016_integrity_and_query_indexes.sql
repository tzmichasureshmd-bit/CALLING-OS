-- Migration 016: Enforce one employee profile per user and support scoped dashboards.

CREATE UNIQUE INDEX IF NOT EXISTS ix_employees_one_profile_per_user
    ON employees (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_calls_org_emp_start
    ON calls (organization_id, employee_id, start_time DESC);

CREATE INDEX IF NOT EXISTS ix_calls_org_device_start
    ON calls (organization_id, device_id, start_time DESC);

CREATE INDEX IF NOT EXISTS ix_calls_org_type_start
    ON calls (organization_id, call_type, start_time DESC);

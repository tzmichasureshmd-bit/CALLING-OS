-- CallNexa subscription catalog, organization subscriptions, payments and invoice snapshots.
-- Prices are stored as exact INR source values. Do not recalculate them in application code.

CREATE TABLE IF NOT EXISTS subscription_plans (
    id                  VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name                VARCHAR(80) NOT NULL UNIQUE,
    member_limit        INTEGER NOT NULL CHECK (member_limit > 0),
    application_access  JSONB NOT NULL DEFAULT '{"desktop": true, "mobile": true}'::jsonb,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plan_prices (
    id               VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    plan_id          VARCHAR(50) NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    duration         VARCHAR(20) NOT NULL CHECK (duration IN ('1_month', '6_months', '1_year')),
    regular_price    NUMERIC(12,2) NOT NULL CHECK (regular_price >= 0),
    selling_price    NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
    currency         VARCHAR(10) NOT NULL DEFAULT 'INR',
    tax_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscription_plan_price_duration UNIQUE (plan_id, duration)
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id                       VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id          VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id                 VARCHAR(50) NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    plan_price_id           VARCHAR(50) NOT NULL REFERENCES subscription_plan_prices(id) ON DELETE RESTRICT,
    subscription_status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    member_limit             INTEGER NOT NULL CHECK (member_limit > 0),
    start_date               TIMESTAMPTZ,
    expiry_date              TIMESTAMPTZ,
    auto_renew               BOOLEAN NOT NULL DEFAULT FALSE,
    payment_status           VARCHAR(30) NOT NULL DEFAULT 'pending',
    provider_subscription_id VARCHAR(150) UNIQUE,
    cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
    id                  VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id     VARCHAR(50) NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
    payment_provider    VARCHAR(40) NOT NULL DEFAULT 'unconfigured',
    provider_order_id  VARCHAR(150) NOT NULL UNIQUE,
    provider_payment_id VARCHAR(150) UNIQUE,
    provider_event_id  VARCHAR(150) UNIQUE,
    amount             NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency           VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_status     VARCHAR(30) NOT NULL DEFAULT 'pending',
    verified_at        TIMESTAMPTZ,
    raw_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key    VARCHAR(150) UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_org_subscriptions_current
    ON organization_subscriptions (organization_id, subscription_status);
CREATE INDEX IF NOT EXISTS ix_subscription_plan_prices_active
    ON subscription_plan_prices (is_active, effective_from);
CREATE INDEX IF NOT EXISTS ix_subscription_payments_org_status
    ON subscription_payments (organization_id, payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_active_subscription
    ON organization_subscriptions (organization_id)
    WHERE subscription_status IN ('trial', 'active', 'expiring_soon', 'payment_failed');

-- The repository already reads invoices, but older environments may not have
-- the table because its original schema was created outside the checked-in migrations.
CREATE TABLE IF NOT EXISTS invoices (
    id                VARCHAR(50) PRIMARY KEY,
    invoice_number    VARCHAR(50) UNIQUE NOT NULL,
    organization_id   VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period            VARCHAR(30),
    users             SMALLINT DEFAULT 1,
    per_user          NUMERIC(8,2) DEFAULT 99,
    amount            NUMERIC(10,2) NOT NULL,
    currency          VARCHAR(10) DEFAULT 'INR',
    status            VARCHAR(20) DEFAULT 'Paid',
    issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at           TIMESTAMPTZ
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS plan_name VARCHAR(80);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS duration VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS regular_price NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(150);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_expiry_date TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ix_invoices_subscription_id ON invoices (subscription_id);

INSERT INTO subscription_plans (name, member_limit, application_access, is_active, created_at, updated_at)
VALUES
    ('Starter', 5, '{"desktop": true, "mobile": true}'::jsonb, TRUE, NOW(), NOW()),
    ('Growth', 10, '{"desktop": true, "mobile": true}'::jsonb, TRUE, NOW(), NOW()),
    ('Professional', 15, '{"desktop": true, "mobile": true}'::jsonb, TRUE, NOW(), NOW()),
    ('Business', 20, '{"desktop": true, "mobile": true}'::jsonb, TRUE, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    member_limit = EXCLUDED.member_limit,
    application_access = EXCLUDED.application_access,
    updated_at = NOW();

INSERT INTO subscription_plan_prices (plan_id, duration, regular_price, selling_price, currency, tax_configuration, is_active, effective_from, created_at, updated_at)
SELECT p.id, v.duration, v.regular_price, v.selling_price, 'INR', '{}'::jsonb, TRUE, NOW(), NOW(), NOW()
FROM (VALUES
    ('Starter', '1_month', 2458, 1499),
    ('Starter', '6_months', 9750, 5999),
    ('Starter', '1_year', 17500, 6999),
    ('Growth', '1_month', 3083, 1849),
    ('Growth', '6_months', 13500, 8099),
    ('Growth', '1_year', 25000, 9999),
    ('Professional', '1_month', 4542, 2799),
    ('Professional', '6_months', 22250, 13349),
    ('Professional', '1_year', 42500, 16999),
    ('Business', '1_month', 5167, 3099),
    ('Business', '6_months', 26000, 15599),
    ('Business', '1_year', 50000, 19999)
) AS v(plan_name, duration, regular_price, selling_price)
JOIN subscription_plans p ON p.name = v.plan_name
ON CONFLICT (plan_id, duration) DO UPDATE SET
    regular_price = EXCLUDED.regular_price,
    selling_price = EXCLUDED.selling_price,
    currency = EXCLUDED.currency,
    is_active = TRUE,
    updated_at = NOW();

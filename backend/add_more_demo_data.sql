-- Quick Demo Data to Fill Empty Pages in CallNexa
-- Copy and paste these queries into Supabase SQL Editor

-- ================================================================
-- MORE CALLS (to fill Call Logs page)
-- ================================================================

-- Add 20 more calls from last 7 days
INSERT INTO calls (
    organization_id, employee_id, employee_name, 
    phone_number, contact_name, call_type, call_status, 
    start_time, duration_seconds, source
) 
SELECT 
    'tzm_org_zzv78xyk5g954rc5y3np',
    (SELECT id FROM employees WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' ORDER BY RANDOM() LIMIT 1),
    (SELECT name FROM employees WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' ORDER BY RANDOM() LIMIT 1),
    '+9198765' || LPAD(FLOOR(RANDOM() * 100000)::text, 5, '0'),
    CASE FLOOR(RANDOM() * 10)
        WHEN 0 THEN 'Tech Solutions Ltd'
        WHEN 1 THEN 'Global Enterprises'
        WHEN 2 THEN 'Digital Marketing Co'
        WHEN 3 THEN 'Cloud Services Inc'
        WHEN 4 THEN 'Software Dynamics'
        WHEN 5 THEN 'E-commerce Hub'
        WHEN 6 THEN 'Retail Solutions'
        WHEN 7 THEN 'Future Tech'
        WHEN 8 THEN 'Data Analytics Ltd'
        ELSE 'Innovation Corp'
    END,
    CASE WHEN RANDOM() > 0.5 THEN 'outgoing' ELSE 'incoming' END,
    CASE WHEN RANDOM() > 0.2 THEN 'connected' ELSE 'missed' END,
    NOW() - (FLOOR(RANDOM() * 7)::text || ' days')::interval - (FLOOR(RANDOM() * 24)::text || ' hours')::interval,
    FLOOR(RANDOM() * 1800)::int,
    'SIM 1'
FROM generate_series(1, 20);

-- ================================================================
-- MORE LEADS (to fill Leads page)
-- ================================================================

INSERT INTO leads (
    organization_id, name, phone, source, status, priority, 
    employee_id, expected_value, notes
)
SELECT 
    'tzm_org_zzv78xyk5g954rc5y3np',
    CASE n % 15
        WHEN 0 THEN 'Arun Technologies'
        WHEN 1 THEN 'Bright Future Solutions'
        WHEN 2 THEN 'Creative Digital Agency'
        WHEN 3 THEN 'Dynamic Systems'
        WHEN 4 THEN 'Elite Enterprises'
        WHEN 5 THEN 'Fast Track Logistics'
        WHEN 6 THEN 'Green Energy Corp'
        WHEN 7 THEN 'Horizon Innovations'
        WHEN 8 THEN 'Impact Marketing'
        WHEN 9 THEN 'Jyoti Textiles'
        WHEN 10 THEN 'Krishna Exports'
        WHEN 11 THEN 'Lakshmi Trading'
        WHEN 12 THEN 'Metro Solutions'
        WHEN 13 THEN 'Nexus Technologies'
        ELSE 'Omega Industries'
    END,
    '+9198765' || LPAD((50000 + n)::text, 5, '0'),
    CASE n % 5
        WHEN 0 THEN 'Website'
        WHEN 1 THEN 'Referral'
        WHEN 2 THEN 'Cold Call'
        WHEN 3 THEN 'LinkedIn'
        ELSE 'Trade Show'
    END,
    CASE n % 4
        WHEN 0 THEN 'new'
        WHEN 1 THEN 'contacted'
        WHEN 2 THEN 'qualified'
        ELSE 'new'
    END,
    CASE n % 3
        WHEN 0 THEN 'High'
        WHEN 1 THEN 'Medium'
        ELSE 'Low'
    END,
    (SELECT id FROM employees WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' ORDER BY RANDOM() LIMIT 1),
    FLOOR(50000 + RANDOM() * 200000),
    'Initial contact made. Interested in our solutions.'
FROM generate_series(1, 15) as n;

-- ================================================================
-- MORE OPPORTUNITIES (to fill Pipeline page)
-- ================================================================

INSERT INTO opportunities (
    organization_id, name, phone, customer, 
    employee_id, stage, value, probability, 
    close_date, next_action
)
SELECT 
    'tzm_org_zzv78xyk5g954rc5y3np',
    CASE n % 12
        WHEN 0 THEN 'Enterprise Software Deal'
        WHEN 1 THEN 'Cloud Migration Project'
        WHEN 2 THEN 'Digital Transformation'
        WHEN 3 THEN 'CRM Implementation'
        WHEN 4 THEN 'Mobile App Development'
        WHEN 5 THEN 'IT Infrastructure Upgrade'
        WHEN 6 THEN 'Cybersecurity Solutions'
        WHEN 7 THEN 'Data Analytics Platform'
        WHEN 8 THEN 'E-commerce Website'
        WHEN 9 THEN 'Marketing Automation'
        WHEN 10 THEN 'Business Intelligence'
        ELSE 'API Integration Services'
    END,
    '+9198765' || LPAD((60000 + n)::text, 5, '0'),
    CASE n % 10
        WHEN 0 THEN 'ABC Corporation'
        WHEN 1 THEN 'XYZ Industries'
        WHEN 2 THEN 'PQR Technologies'
        WHEN 3 THEN 'LMN Enterprises'
        WHEN 4 THEN 'RST Solutions'
        WHEN 5 THEN 'UVW Systems'
        WHEN 6 THEN 'DEF Innovations'
        WHEN 7 THEN 'GHI Digital'
        WHEN 8 THEN 'JKL Trading'
        ELSE 'MNO Exports'
    END,
    (SELECT id FROM employees WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' ORDER BY RANDOM() LIMIT 1),
    CASE n % 5
        WHEN 0 THEN 'New'
        WHEN 1 THEN 'Contacted'
        WHEN 2 THEN 'Qualified'
        WHEN 3 THEN 'Proposal'
        ELSE 'Negotiation'
    END,
    FLOOR(100000 + RANDOM() * 500000),
    FLOOR(20 + RANDOM() * 70),
    CURRENT_DATE + (FLOOR(RANDOM() * 90)::text || ' days')::interval,
    CASE n % 4
        WHEN 0 THEN 'Follow-up call scheduled'
        WHEN 1 THEN 'Send proposal'
        WHEN 2 THEN 'Demo presentation'
        ELSE 'Waiting for decision'
    END
FROM generate_series(1, 12) as n;

-- ================================================================
-- EXCLUDED NUMBERS (if needed)
-- ================================================================

INSERT INTO excluded_numbers (
    organization_id, number, reason, added_by_id
)
VALUES
    ('tzm_org_zzv78xyk5g954rc5y3np', '+919876000001', 'Spam caller', (SELECT id FROM users WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' LIMIT 1)),
    ('tzm_org_zzv78xyk5g954rc5y3np', '+919876000002', 'Wrong number', (SELECT id FROM users WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' LIMIT 1)),
    ('tzm_org_zzv78xyk5g954rc5y3np', '+919876000003', 'Competitor', (SELECT id FROM users WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' LIMIT 1)),
    ('tzm_org_zzv78xyk5g954rc5y3np', '+919876000004', 'Do not call request', (SELECT id FROM users WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' LIMIT 1)),
    ('tzm_org_zzv78xyk5g954rc5y3np', '+919876000005', 'Blacklisted', (SELECT id FROM users WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ================================================================
-- VERIFY DATA ADDED
-- ================================================================

-- Check counts after adding data
SELECT 'Calls' as table_name, COUNT(*) as total FROM calls WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np'
UNION ALL
SELECT 'Leads', COUNT(*) FROM leads WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np'
UNION ALL
SELECT 'Opportunities', COUNT(*) FROM opportunities WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np'
UNION ALL
SELECT 'Excluded Numbers', COUNT(*) FROM excluded_numbers WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np'
UNION ALL
SELECT 'Employees', COUNT(*) FROM employees WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np'
UNION ALL
SELECT 'Devices', COUNT(*) FROM devices WHERE organization_id = 'tzm_org_zzv78xyk5g954rc5y3np';

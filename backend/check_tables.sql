-- Check all CallNexa database tables and their data counts

-- List all tables
SELECT 
    tablename,
    schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count records in each table
SELECT 'organizations' as table_name, COUNT(*) as record_count FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'devices', COUNT(*) FROM devices
UNION ALL
SELECT 'calls', COUNT(*) FROM calls
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'opportunities', COUNT(*) FROM opportunities
UNION ALL
SELECT 'excluded_numbers', COUNT(*) FROM excluded_numbers
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;

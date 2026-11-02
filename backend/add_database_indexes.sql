-- Database Performance Indexes for CallNexa/CALLOS
-- Run this SQL script to improve query performance

-- ================================================================
-- CALLS TABLE INDEXES (Most Critical)
-- ================================================================

-- Index for calls filtered by organization and sorted by time
CREATE INDEX IF NOT EXISTS idx_calls_org_start 
ON calls(organization_id, start_time DESC);

-- Index for calls filtered by employee
CREATE INDEX IF NOT EXISTS idx_calls_employee_time 
ON calls(employee_id, start_time DESC);

-- Index for calls by organization and employee together
CREATE INDEX IF NOT EXISTS idx_calls_org_employee 
ON calls(organization_id, employee_id, start_time DESC);

-- Index for recent calls - regular index without date filter
-- (Partial indexes with CURRENT_DATE are not allowed in PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_calls_recent 
ON calls(organization_id, start_time DESC, call_type);

-- Index for recording-related queries
CREATE INDEX IF NOT EXISTS idx_calls_recording 
ON calls(organization_id, recording_available, recording_status)
WHERE recording_available = true;

-- Index for transcript queries
CREATE INDEX IF NOT EXISTS idx_calls_transcript 
ON calls(organization_id, transcript_status, transcription_completed_at)
WHERE transcript_status IS NOT NULL;

-- Composite index for analytics queries (call outcome breakdown)
CREATE INDEX IF NOT EXISTS idx_calls_analytics 
ON calls(organization_id, call_type, call_status, start_time DESC);

-- ================================================================
-- EMPLOYEES TABLE INDEXES
-- ================================================================

-- Index for employees by organization and status
CREATE INDEX IF NOT EXISTS idx_employees_org_status 
ON employees(organization_id, status);

-- Index for employee lookup by email
CREATE INDEX IF NOT EXISTS idx_employees_email 
ON employees(email) WHERE email IS NOT NULL;

-- Index for employee lookup by phone
CREATE INDEX IF NOT EXISTS idx_employees_phone 
ON employees(phone) WHERE phone IS NOT NULL;

-- Index for active employees sorted by last activity
CREATE INDEX IF NOT EXISTS idx_employees_active 
ON employees(organization_id, last_active_at DESC)
WHERE status = 'active';

-- ================================================================
-- OPPORTUNITIES TABLE INDEXES
-- ================================================================

-- Index for opportunities by organization and stage
CREATE INDEX IF NOT EXISTS idx_opps_org_stage 
ON opportunities(organization_id, stage, close_date);

-- Index for open opportunities
CREATE INDEX IF NOT EXISTS idx_opps_open 
ON opportunities(organization_id, is_closed)
WHERE is_closed IS NULL OR is_closed = '';

-- Index for closed opportunities
CREATE INDEX IF NOT EXISTS idx_opps_closed 
ON opportunities(organization_id, is_closed, closed_at DESC)
WHERE is_closed IN ('won', 'lost');

-- Index for opportunities by employee
CREATE INDEX IF NOT EXISTS idx_opps_employee 
ON opportunities(employee_id, stage) 
WHERE employee_id IS NOT NULL;

-- Index for hot leads (multiple connects)
CREATE INDEX IF NOT EXISTS idx_opps_hot 
ON opportunities(organization_id, connects, stage)
WHERE connects >= 2;

-- ================================================================
-- LEADS TABLE INDEXES
-- ================================================================

-- Index for leads by organization and status
CREATE INDEX IF NOT EXISTS idx_leads_org_status 
ON leads(organization_id, status);

-- Index for leads by employee
CREATE INDEX IF NOT EXISTS idx_leads_employee 
ON leads(employee_id, status)
WHERE employee_id IS NOT NULL;

-- Index for leads with upcoming follow-ups
CREATE INDEX IF NOT EXISTS idx_leads_followup 
ON leads(organization_id, next_follow_up)
WHERE next_follow_up IS NOT NULL;

-- Index for leads by priority
CREATE INDEX IF NOT EXISTS idx_leads_priority 
ON leads(organization_id, priority, status);

-- ================================================================
-- DEVICES TABLE INDEXES
-- ================================================================

-- Index for devices by organization
CREATE INDEX IF NOT EXISTS idx_devices_org 
ON devices(organization_id, is_online DESC);

-- Index for devices by employee
CREATE INDEX IF NOT EXISTS idx_devices_employee 
ON devices(employee_id)
WHERE employee_id IS NOT NULL;

-- Index for online devices
CREATE INDEX IF NOT EXISTS idx_devices_online 
ON devices(organization_id, last_seen_at DESC)
WHERE is_online = true;

-- ================================================================
-- USERS TABLE INDEXES
-- ================================================================

-- Index for user lookup by email (probably already exists)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Index for users by organization
CREATE INDEX IF NOT EXISTS idx_users_org 
ON users(organization_id, role)
WHERE organization_id IS NOT NULL;

-- ================================================================
-- EXCLUDED_NUMBERS TABLE INDEXES
-- ================================================================

-- Index for excluded numbers by organization
CREATE INDEX IF NOT EXISTS idx_excluded_org 
ON excluded_numbers(organization_id);

-- Index for excluded number lookup
CREATE INDEX IF NOT EXISTS idx_excluded_number 
ON excluded_numbers(organization_id, number);

-- ================================================================
-- AUDIT_LOGS TABLE INDEXES (if exists)
-- ================================================================

-- Index for audit logs by organization and time
CREATE INDEX IF NOT EXISTS idx_audit_org_time 
ON audit_logs(organization_id, timestamp DESC);

-- Index for audit logs by user
CREATE INDEX IF NOT EXISTS idx_audit_user 
ON audit_logs(user_id, timestamp DESC)
WHERE user_id IS NOT NULL;

-- ================================================================
-- INVOICES TABLE INDEXES
-- ================================================================

-- Index for invoices by organization
CREATE INDEX IF NOT EXISTS idx_invoices_org 
ON invoices(organization_id, date DESC);

-- ================================================================
-- VERIFY INDEXES CREATED
-- ================================================================

-- Run this query to see all indexes on the calls table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'calls' ORDER BY indexname;

-- Check index usage statistics
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan DESC;

-- ================================================================
-- MAINTENANCE
-- ================================================================

-- Analyze tables to update statistics after creating indexes
ANALYZE calls;
ANALYZE employees;
ANALYZE opportunities;
ANALYZE leads;
ANALYZE devices;
ANALYZE users;
ANALYZE excluded_numbers;
ANALYZE invoices;

-- Enable auto-vacuum if not already enabled (PostgreSQL best practice)
-- This should be set at the database level, not per-table
-- ALTER DATABASE callos SET log_autovacuum_min_duration = 0;

-- ================================================================
-- NOTES
-- ================================================================

-- 1. These indexes are designed for the most common queries in CallNexa
-- 2. Partial indexes (with WHERE clauses) save space and improve performance
-- 3. Indexes are automatically used by PostgreSQL query planner
-- 4. Monitor index usage with pg_stat_user_indexes
-- 5. Run ANALYZE periodically to keep statistics up-to-date
-- 6. Consider VACUUM FULL during off-peak hours if database is heavily written

-- ================================================================
-- PERFORMANCE MONITORING QUERIES
-- ================================================================

-- Find slow queries (enable pg_stat_statements extension first)
-- SELECT query, calls, mean_exec_time, max_exec_time 
-- FROM pg_stat_statements 
-- ORDER BY mean_exec_time DESC 
-- LIMIT 10;

-- Check table bloat
-- SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check missing indexes (queries with sequential scans)
-- SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
-- FROM pg_stat_user_tables
-- WHERE seq_scan > 0
-- ORDER BY seq_tup_read DESC
-- LIMIT 10;

-- ================================================================
-- DONE
-- ================================================================

SELECT 'Database indexes created successfully!' as status;

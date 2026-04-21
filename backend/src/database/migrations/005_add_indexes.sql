-- ============================================
-- FILE 5: src/database/migrations/005_add_indexes.sql
-- ============================================
-- Additional performance indexes and optimizations

-- ====================
-- Users Performance Indexes
-- ====================

-- Index for finding users by partial username (for search)
CREATE INDEX idx_users_username_trgm ON users USING gin(username gin_trgm_ops);

-- Index for guest user cleanup
CREATE INDEX idx_users_guest_created ON users(created_at) 
    WHERE is_guest = true;

-- Index for banned users
CREATE INDEX idx_users_banned ON users(id) 
    WHERE is_banned = true;

-- ====================
-- Friendships Performance Indexes
-- ====================

-- Index for getting online friends
CREATE INDEX idx_friendships_online_friends ON friendships(user_id, friend_id) 
    WHERE status = 'accepted';

-- Index for mutual friends query
CREATE INDEX idx_friendships_mutual ON friendships(user_id, friend_id, status) 
    WHERE status = 'accepted';

-- ====================
-- Sessions Performance Indexes
-- ====================

-- Index for finding user's session history
CREATE INDEX idx_sessions_user_history ON sessions(user1_id, started_at DESC) 
    WHERE status = 'ended';

CREATE INDEX idx_sessions_user2_history ON sessions(user2_id, started_at DESC) 
    WHERE status = 'ended';

-- Index for session statistics queries
CREATE INDEX idx_sessions_stats ON sessions(session_type, status, started_at);

-- Index for finding sessions between two users
CREATE INDEX idx_sessions_between_users ON sessions(
    LEAST(user1_id, user2_id),
    GREATEST(user1_id, user2_id)
);

-- ====================
-- Reports Performance Indexes
-- ====================

-- Index for reports by user with reason
CREATE INDEX idx_reports_user_reason ON reports(reported_user_id, reason, created_at DESC);

-- Index for moderator dashboard
CREATE INDEX idx_reports_moderator ON reports(status, created_at DESC) 
    WHERE status IN ('pending', 'reviewed');

-- ====================
-- Full Text Search (Optional)
-- ====================

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for username search
DROP INDEX IF EXISTS idx_users_username_trgm;
CREATE INDEX idx_users_username_trgm ON users USING gin(username gin_trgm_ops);

-- ====================
-- Statistics and Analytics Views
-- ====================

-- View for active users count
CREATE OR REPLACE VIEW v_active_users AS
SELECT 
    COUNT(*) as total_active,
    COUNT(*) FILTER (WHERE is_guest = false) as registered_active,
    COUNT(*) FILTER (WHERE is_guest = true) as guest_active
FROM users
WHERE last_seen > NOW() - INTERVAL '5 minutes'
  AND is_banned = false;

-- View for session statistics
CREATE OR REPLACE VIEW v_session_stats AS
SELECT 
    session_type,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
    COUNT(*) FILTER (WHERE status = 'ended') as ended_sessions,
    AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as avg_duration_seconds,
    COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as sessions_24h
FROM sessions
GROUP BY session_type;

-- View for report statistics
CREATE OR REPLACE VIEW v_report_stats AS
SELECT 
    reason,
    COUNT(*) as total_reports,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_reports,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as reports_7d
FROM reports
GROUP BY reason;

-- View for user statistics
CREATE OR REPLACE VIEW v_user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_guest = false) as registered_users,
    COUNT(*) FILTER (WHERE is_guest = true) as guest_users,
    COUNT(*) FILTER (WHERE is_banned = true) as banned_users,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
    COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '5 minutes') as online_users
FROM users;

-- ====================
-- Maintenance Functions
-- ====================

-- Function to clean up old guest users
CREATE OR REPLACE FUNCTION cleanup_old_guests(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM users
        WHERE is_guest = true
          AND created_at < NOW() - (days_old || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_old_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM sessions
        WHERE started_at < NOW() - (days_old || ' days')::INTERVAL
          AND status != 'active'
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old reports
CREATE OR REPLACE FUNCTION cleanup_old_reports(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM reports
        WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
          AND status IN ('resolved', 'dismissed')
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS VOID AS $$
BEGIN
    ANALYZE users;
    ANALYZE friendships;
    ANALYZE sessions;
    ANALYZE reports;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- Performance Tuning
-- ====================

-- Increase statistics target for important columns
ALTER TABLE users ALTER COLUMN username SET STATISTICS 1000;
ALTER TABLE users ALTER COLUMN last_seen SET STATISTICS 1000;
ALTER TABLE sessions ALTER COLUMN started_at SET STATISTICS 1000;
ALTER TABLE reports ALTER COLUMN created_at SET STATISTICS 1000;

-- Set autovacuum settings for high-traffic tables
ALTER TABLE sessions SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE users SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- ====================
-- Comments
-- ====================

COMMENT ON VIEW v_active_users IS 'Real-time count of active users';
COMMENT ON VIEW v_session_stats IS 'Session statistics by type';
COMMENT ON VIEW v_report_stats IS 'Report statistics by reason';
COMMENT ON VIEW v_user_stats IS 'Overall user statistics';
COMMENT ON FUNCTION cleanup_old_guests IS 'Remove guest users older than specified days';
COMMENT ON FUNCTION cleanup_old_sessions IS 'Remove old ended sessions';
COMMENT ON FUNCTION cleanup_old_reports IS 'Remove old resolved/dismissed reports';

-- Grant permissions on views
GRANT SELECT ON v_active_users TO PUBLIC;
GRANT SELECT ON v_session_stats TO PUBLIC;
GRANT SELECT ON v_report_stats TO PUBLIC;
GRANT SELECT ON v_user_stats TO PUBLIC;
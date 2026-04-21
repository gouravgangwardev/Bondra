-- ============================================
-- FILE 4: src/database/migrations/004_create_reports.sql
-- ============================================
-- Create reports table for moderation

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT reports_reason_check CHECK (reason IN (
        'inappropriate_content',
        'harassment',
        'spam',
        'underage',
        'violence',
        'other'
    )),
    CONSTRAINT reports_status_check CHECK (status IN (
        'pending',
        'reviewed',
        'resolved',
        'dismissed'
    )),
    CONSTRAINT reports_users_different CHECK (reporter_id != reported_user_id),
    CONSTRAINT reports_description_length CHECK (char_length(description) <= 1000)
);

-- Create indexes for reports
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX idx_reports_session_id ON reports(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_reports_reason ON reports(reason);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_reviewed_at ON reports(reviewed_at DESC) WHERE reviewed_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_reports_reported_status ON reports(reported_user_id, status);
CREATE INDEX idx_reports_reporter_created ON reports(reporter_id, created_at DESC);
CREATE INDEX idx_reports_status_created ON reports(status, created_at DESC);

-- Partial index for pending reports
CREATE INDEX idx_reports_pending ON reports(created_at DESC) 
    WHERE status = 'pending';

-- Partial index for recent reports (last 7 days)
CREATE INDEX idx_reports_recent ON reports(created_at DESC) 
    WHERE created_at > NOW() - INTERVAL '7 days';

-- Function to count reports for a user
CREATE OR REPLACE FUNCTION get_user_report_count(user_uuid UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM reports
    WHERE reported_user_id = user_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to get pending report count
CREATE OR REPLACE FUNCTION get_pending_reports_count()
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM reports
    WHERE status = 'pending';
$$ LANGUAGE SQL STABLE;

-- Comments
COMMENT ON TABLE reports IS 'Stores user reports for moderation';
COMMENT ON COLUMN reports.reason IS 'Report reason category';
COMMENT ON COLUMN reports.description IS 'Detailed description of the issue';
COMMENT ON COLUMN reports.status IS 'Report status: pending, reviewed, resolved, dismissed';
COMMENT ON COLUMN reports.reviewed_by IS 'Admin/moderator who reviewed the report';
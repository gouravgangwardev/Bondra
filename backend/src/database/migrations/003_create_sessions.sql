-- ============================================
-- FILE 3: src/database/migrations/003_create_sessions.sql
-- ============================================
-- Create sessions table for chat sessions

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_type VARCHAR(20) NOT NULL,
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT sessions_type_check CHECK (session_type IN ('video', 'audio', 'text')),
    CONSTRAINT sessions_status_check CHECK (status IN ('active', 'ended', 'abandoned')),
    CONSTRAINT sessions_users_different CHECK (user1_id != user2_id),
    CONSTRAINT sessions_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Create indexes for sessions
CREATE INDEX idx_sessions_user1_id ON sessions(user1_id);
CREATE INDEX idx_sessions_user2_id ON sessions(user2_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_type ON sessions(session_type);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_ended_at ON sessions(ended_at DESC) WHERE ended_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_sessions_user1_status ON sessions(user1_id, status);
CREATE INDEX idx_sessions_user2_status ON sessions(user2_id, status);
CREATE INDEX idx_sessions_type_status ON sessions(session_type, status);
CREATE INDEX idx_sessions_users_pair ON sessions(user1_id, user2_id);

-- Partial index for active sessions
CREATE INDEX idx_sessions_active ON sessions(started_at DESC) 
    WHERE status = 'active';

-- Partial index for recent sessions
CREATE INDEX idx_sessions_recent ON sessions(started_at DESC) 
    WHERE started_at > NOW() - INTERVAL '24 hours';

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION get_session_duration(session_id UUID)
RETURNS INTERVAL AS $$
    SELECT COALESCE(ended_at, NOW()) - started_at
    FROM sessions
    WHERE id = session_id;
$$ LANGUAGE SQL STABLE;

-- Comments
COMMENT ON TABLE sessions IS 'Stores chat session information';
COMMENT ON COLUMN sessions.session_type IS 'Type of session: video, audio, or text';
COMMENT ON COLUMN sessions.status IS 'Session status: active, ended, or abandoned';
COMMENT ON COLUMN sessions.started_at IS 'When the session started';
COMMENT ON COLUMN sessions.ended_at IS 'When the session ended (null if active)';
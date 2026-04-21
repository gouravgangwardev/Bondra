-- ============================================
-- FILE 2: src/database/migrations/002_create_friendships.sql
-- ============================================
-- Create friendships table for friend system

CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    CONSTRAINT friendships_not_self CHECK (user_id != friend_id),
    CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id)
);

-- Create trigger for friendships table
CREATE TRIGGER update_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for friendships
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friendships_created_at ON friendships(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_friendships_user_status ON friendships(user_id, status);
CREATE INDEX idx_friendships_friend_status ON friendships(friend_id, status);
CREATE INDEX idx_friendships_users_pair ON friendships(user_id, friend_id);

-- Partial indexes for better performance
CREATE INDEX idx_friendships_pending ON friendships(friend_id, created_at) 
    WHERE status = 'pending';
CREATE INDEX idx_friendships_accepted ON friendships(user_id) 
    WHERE status = 'accepted';

-- Comments
COMMENT ON TABLE friendships IS 'Stores friendship relationships and requests';
COMMENT ON COLUMN friendships.user_id IS 'User who initiated the friendship';
COMMENT ON COLUMN friendships.friend_id IS 'User who received the request';
COMMENT ON COLUMN friendships.status IS 'Friendship status: pending, accepted, rejected, blocked';

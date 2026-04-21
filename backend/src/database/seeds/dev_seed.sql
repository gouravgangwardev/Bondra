// ============================================
// FILE 2: src/database/seeds/dev_seed.sql
// ============================================
-- Development seed data for testing
-- Run this only in development environment

-- Insert test users
INSERT INTO users (username, email, password_hash, is_guest, is_banned) VALUES
-- Regular users (password: Test1234)
('john_doe', 'john@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, false),
('jane_smith', 'jane@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, false),
('alice_wonder', 'alice@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, false),
('bob_builder', 'bob@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, false),
('charlie_brown', 'charlie@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, false),

-- Guest users
('Guest_001', NULL, NULL, true, false),
('Guest_002', NULL, NULL, true, false),
('Guest_003', NULL, NULL, true, false),

-- Banned user (for testing)
('banned_user', 'banned@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH.l4NQQhUu2', false, true);

-- Update last_seen for some users to simulate activity
UPDATE users SET last_seen = NOW() - INTERVAL '2 minutes' WHERE username IN ('john_doe', 'jane_smith');
UPDATE users SET last_seen = NOW() - INTERVAL '1 hour' WHERE username IN ('alice_wonder', 'bob_builder');
UPDATE users SET last_seen = NOW() - INTERVAL '1 day' WHERE username = 'charlie_brown';

-- Insert friendships
INSERT INTO friendships (user_id, friend_id, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'john_doe'),
    (SELECT id FROM users WHERE username = 'jane_smith'),
    'accepted';

INSERT INTO friendships (user_id, friend_id, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'john_doe'),
    (SELECT id FROM users WHERE username = 'alice_wonder'),
    'accepted';

INSERT INTO friendships (user_id, friend_id, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'alice_wonder'),
    (SELECT id FROM users WHERE username = 'bob_builder'),
    'pending';

INSERT INTO friendships (user_id, friend_id, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'charlie_brown'),
    (SELECT id FROM users WHERE username = 'john_doe'),
    'pending';

INSERT INTO friendships (user_id, friend_id, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'bob_builder'),
    (SELECT id FROM users WHERE username = 'banned_user'),
    'blocked';

-- Insert sample sessions
INSERT INTO sessions (session_type, user1_id, user2_id, status, started_at, ended_at) 
SELECT 
    'video',
    (SELECT id FROM users WHERE username = 'john_doe'),
    (SELECT id FROM users WHERE username = 'jane_smith'),
    'ended',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 45 minutes';

INSERT INTO sessions (session_type, user1_id, user2_id, status, started_at, ended_at) 
SELECT 
    'audio',
    (SELECT id FROM users WHERE username = 'alice_wonder'),
    (SELECT id FROM users WHERE username = 'bob_builder'),
    'ended',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '23 hours 50 minutes';

INSERT INTO sessions (session_type, user1_id, user2_id, status, started_at) 
SELECT 
    'text',
    (SELECT id FROM users WHERE username = 'Guest_001'),
    (SELECT id FROM users WHERE username = 'Guest_002'),
    'active',
    NOW() - INTERVAL '5 minutes';

INSERT INTO sessions (session_type, user1_id, user2_id, status, started_at, ended_at) 
SELECT 
    'video',
    (SELECT id FROM users WHERE username = 'john_doe'),
    (SELECT id FROM users WHERE username = 'alice_wonder'),
    'ended',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '15 minutes';

-- Insert sample reports
INSERT INTO reports (reporter_id, reported_user_id, session_id, reason, description, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'john_doe'),
    (SELECT id FROM users WHERE username = 'banned_user'),
    (SELECT id FROM sessions WHERE status = 'ended' LIMIT 1),
    'harassment',
    'User was being very rude and offensive during the chat',
    'resolved';

INSERT INTO reports (reporter_id, reported_user_id, reason, description, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'jane_smith'),
    (SELECT id FROM users WHERE username = 'Guest_003'),
    'inappropriate_content',
    'User was sharing inappropriate content',
    'pending';

INSERT INTO reports (reporter_id, reported_user_id, reason, description, status) 
SELECT 
    (SELECT id FROM users WHERE username = 'alice_wonder'),
    (SELECT id FROM users WHERE username = 'banned_user'),
    'spam',
    'User was spamming the chat',
    'resolved';

-- Display summary
DO $$
DECLARE
    user_count INTEGER;
    friendship_count INTEGER;
    session_count INTEGER;
    report_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO friendship_count FROM friendships;
    SELECT COUNT(*) INTO session_count FROM sessions;
    SELECT COUNT(*) INTO report_count FROM reports;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================';
    RAISE NOTICE 'Seed Data Summary:';
    RAISE NOTICE '=================================';
    RAISE NOTICE 'Users created: %', user_count;
    RAISE NOTICE 'Friendships created: %', friendship_count;
    RAISE NOTICE 'Sessions created: %', session_count;
    RAISE NOTICE 'Reports created: %', report_count;
    RAISE NOTICE '=================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Credentials:';
    RAISE NOTICE 'Username: john_doe';
    RAISE NOTICE 'Password: Test1234';
    RAISE NOTICE '=================================';
END $$;

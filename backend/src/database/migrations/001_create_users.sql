-- ============================================
-- FILE 1: src/database/migrations/001_create_users.sql
-- ============================================
-- Create users table with all necessary fields

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    avatar_url VARCHAR(500),
    is_guest BOOLEAN DEFAULT false NOT NULL,
    is_banned BOOLEAN DEFAULT false NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add constraints
ALTER TABLE users ADD CONSTRAINT users_username_length CHECK (char_length(username) >= 3);
ALTER TABLE users ADD CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL);
ALTER TABLE users ADD CONSTRAINT users_password_or_guest CHECK (password_hash IS NOT NULL OR is_guest = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_is_guest ON users(is_guest);
CREATE INDEX idx_users_is_banned ON users(is_banned);
CREATE INDEX idx_users_last_seen ON users(last_seen DESC);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Create partial index for active users (last seen within 5 minutes)
CREATE INDEX idx_users_active ON users(last_seen) 
    WHERE last_seen > NOW() - INTERVAL '5 minutes' AND is_banned = false;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.username IS 'Unique username (3-50 characters)';
COMMENT ON COLUMN users.email IS 'User email address (optional for guests)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (null for guests)';
COMMENT ON COLUMN users.is_guest IS 'Whether user is a guest account';
COMMENT ON COLUMN users.is_banned IS 'Whether user is banned';
COMMENT ON COLUMN users.last_seen IS 'Last activity timestamp';

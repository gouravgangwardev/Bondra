-- ============================================
-- Migration 006: Add is_admin column to users
-- Fixes Bug 4: adminMiddleware now checks this column instead of username === 'admin'
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Grant admin to a known superuser if needed (replace 'your_admin_username'):
-- UPDATE users SET is_admin = TRUE WHERE username = 'your_admin_username';

-- ==============================================================================
-- migrate_add_admin.sql
-- HabitFlow — Additive Migration for Admin Panel
-- Run this script ONCE on TiDB Cloud via their SQL editor.
-- This script ONLY ADDS new columns/tables. It will NOT delete any data.
-- ==============================================================================

-- SAFETY: Only run ALTER if column doesn't already exist (TiDB-safe approach)
-- Add 'status' column to users table for Ban/Unban feature
ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `status` ENUM('active', 'banned') NOT NULL DEFAULT 'active'
    COMMENT 'admin-controlled account status';

-- Add 'source' column to app_feedback (maps to 'source' in API)
ALTER TABLE `app_feedback`
    ADD COLUMN IF NOT EXISTS `source` VARCHAR(50) NOT NULL DEFAULT 'Web'
    COMMENT 'Platform source: Web, Android, iOS';

-- ==============================================================================
-- VERIFY: Show updated table structures
-- ==============================================================================
DESCRIBE `users`;
DESCRIBE `app_feedback`;

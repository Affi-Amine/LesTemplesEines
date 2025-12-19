
-- Migration: Add 'required_staff_count' to services
-- Default is 1 (standard service)
ALTER TABLE services ADD COLUMN IF NOT EXISTS required_staff_count INTEGER DEFAULT 1;

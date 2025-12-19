
-- Migration: Add 'blocked' status to appointments
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed','pending','in_progress','completed','cancelled','no_show','blocked'));

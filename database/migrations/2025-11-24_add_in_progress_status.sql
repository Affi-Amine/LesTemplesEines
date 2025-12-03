-- Migration: Add 'in_progress' status to appointments
-- Recreate the CHECK constraint to include the new value using plain SQL

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed','pending','in_progress','completed','cancelled','no_show'));

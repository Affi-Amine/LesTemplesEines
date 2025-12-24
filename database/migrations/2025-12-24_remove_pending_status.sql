
-- Remove 'pending' from appointments status check constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed','in_progress','completed','cancelled','no_show','blocked'));

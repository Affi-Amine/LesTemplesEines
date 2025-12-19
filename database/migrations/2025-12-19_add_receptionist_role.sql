
-- Add 'receptionist' to the allowed roles in staff table
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN ('therapist', 'assistant', 'manager', 'admin', 'receptionist'));

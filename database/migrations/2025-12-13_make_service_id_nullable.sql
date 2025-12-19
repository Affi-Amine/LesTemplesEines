
-- Make service_id nullable for blocked slots
ALTER TABLE appointments ALTER COLUMN service_id DROP NOT NULL;

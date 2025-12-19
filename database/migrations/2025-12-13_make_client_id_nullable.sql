
-- Make client_id nullable for blocked slots
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;

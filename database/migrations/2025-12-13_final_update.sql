
-- ============================================================================
-- UPDATE SCRIPT: 2025-12-13
-- Description: Adds multi-provider support, blocked slots, and payment updates.
-- ============================================================================

-- 1. Enable UUID extension if not exists (just in case)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create appointment_assignments table for multi-provider support
CREATE TABLE IF NOT EXISTS appointment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(appointment_id, staff_id)
);

-- 3. Add RLS policies for appointment_assignments
ALTER TABLE appointment_assignments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_assignments' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON appointment_assignments FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_assignments' AND policyname = 'Enable insert for authenticated users only') THEN
        CREATE POLICY "Enable insert for authenticated users only" ON appointment_assignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_assignments' AND policyname = 'Enable update for authenticated users only') THEN
        CREATE POLICY "Enable update for authenticated users only" ON appointment_assignments FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_assignments' AND policyname = 'Enable delete for authenticated users only') THEN
        CREATE POLICY "Enable delete for authenticated users only" ON appointment_assignments FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 4. Update appointments table for 'blocked' status
-- Recreate the CHECK constraint to include 'blocked' status
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed','pending','in_progress','completed','cancelled','no_show','blocked'));

-- 5. Make columns nullable to support 'blocked' slots (which may not have client or service)
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN service_id DROP NOT NULL;

-- 6. Ensure payment columns exist (idempotent check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'payment_status') THEN
        ALTER TABLE appointments ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'payment_method') THEN
        ALTER TABLE appointments ADD COLUMN payment_method VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'amount_paid_cents') THEN
        ALTER TABLE appointments ADD COLUMN amount_paid_cents INTEGER DEFAULT 0;
    END IF;
END $$;

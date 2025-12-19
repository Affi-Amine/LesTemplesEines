
-- Create appointment_assignments table for multi-provider support
CREATE TABLE IF NOT EXISTS appointment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(appointment_id, staff_id)
);

-- Add RLS policies
ALTER TABLE appointment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON appointment_assignments
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON appointment_assignments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON appointment_assignments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON appointment_assignments
  FOR DELETE USING (auth.role() = 'authenticated');

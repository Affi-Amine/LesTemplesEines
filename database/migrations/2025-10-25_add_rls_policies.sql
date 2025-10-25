-- RLS Policies for Public Access
-- This allows the anon key to read public data from tables

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to active salons" ON salons;
DROP POLICY IF EXISTS "Allow public read access to active services" ON services;
DROP POLICY IF EXISTS "Allow public read access to active staff" ON staff;
DROP POLICY IF EXISTS "Allow authenticated read access to clients" ON clients;
DROP POLICY IF EXISTS "Allow public read access to appointments" ON appointments;
DROP POLICY IF EXISTS "Allow authenticated full access to salons" ON salons;
DROP POLICY IF EXISTS "Allow authenticated full access to services" ON services;
DROP POLICY IF EXISTS "Allow authenticated full access to staff" ON staff;
DROP POLICY IF EXISTS "Allow authenticated full access to clients" ON clients;
DROP POLICY IF EXISTS "Allow authenticated full access to appointments" ON appointments;

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Salons: Allow public read access to active salons
CREATE POLICY "Allow public read access to active salons"
ON salons FOR SELECT
TO anon
USING (is_active = true);

-- Services: Allow public read access to active services
CREATE POLICY "Allow public read access to active services"
ON services FOR SELECT
TO anon
USING (is_active = true);

-- Staff: Allow public read access to active staff (excluding password_hash)
CREATE POLICY "Allow public read access to active staff"
ON staff FOR SELECT
TO anon
USING (is_active = true);

-- Clients: Allow authenticated users to read client data
CREATE POLICY "Allow authenticated read access to clients"
ON clients FOR SELECT
TO authenticated
USING (true);

-- Appointments: Allow public read access (for booking availability)
CREATE POLICY "Allow public read access to appointments"
ON appointments FOR SELECT
TO anon
USING (true);

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated full access to salons"
ON salons FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to services"
ON services FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to staff"
ON staff FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to clients"
ON clients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to appointments"
ON appointments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

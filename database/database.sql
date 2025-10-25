-- ============================================================================
-- LES TEMPLES - SALON BOOKING SYSTEM
-- Database Schema for Supabase (PostgreSQL)
-- ============================================================================
-- This file contains the complete database structure for the Les Temples
-- multi-salon booking and management system.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SALONS TABLE
-- Stores information about each salon location (Les Temples)
-- ----------------------------------------------------------------------------
CREATE TABLE salons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    siret VARCHAR(14), -- French business registration number
    opening_hours JSONB DEFAULT '{}', -- Store hours by day: {"monday": {"open": "10:00", "close": "20:00"}}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. SERVICES TABLE
-- Stores massage services/prestations offered by salons
-- ----------------------------------------------------------------------------
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL, -- Duration in minutes
    price_cents INTEGER NOT NULL, -- Price in cents to avoid floating point issues
    category VARCHAR(100), -- e.g., "Détente", "Thérapeutique", "Sportif"
    image_url TEXT,
    is_visible BOOLEAN DEFAULT true, -- If false, hidden from public booking
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. STAFF TABLE
-- Stores employee/therapist information with authentication credentials
-- ----------------------------------------------------------------------------
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- Bcrypt hashed password
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('therapist', 'assistant', 'manager', 'admin')),
    photo_url TEXT,
    specialties TEXT[] DEFAULT '{}', -- Array of service IDs or specialty names
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. STAFF_AVAILABILITY TABLE
-- Stores recurring and specific date availability for staff members
-- ----------------------------------------------------------------------------
CREATE TABLE staff_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday (null for specific dates)
    start_time TIME, -- e.g., "09:00"
    end_time TIME, -- e.g., "17:00"
    is_recurring BOOLEAN DEFAULT true, -- True for weekly recurring, false for specific dates
    specific_date DATE, -- Used when is_recurring = false
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint: either recurring with day_of_week OR specific with specific_date
    CHECK (
        (is_recurring = true AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
        (is_recurring = false AND specific_date IS NOT NULL AND day_of_week IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 5. CLIENTS TABLE
-- Stores customer information and loyalty data
-- ----------------------------------------------------------------------------
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL UNIQUE, -- Primary identifier for clients
    email VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    internal_notes TEXT, -- Private notes visible only to staff
    loyalty_status VARCHAR(50) DEFAULT 'regular' CHECK (loyalty_status IN ('regular', 'vip', 'inactive')),
    total_spent_cents INTEGER DEFAULT 0, -- Total lifetime spending in cents
    visit_count INTEGER DEFAULT 0, -- Number of completed visits
    last_visit_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. APPOINTMENTS TABLE
-- Stores all booking/reservation information
-- ----------------------------------------------------------------------------
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'completed', 'cancelled', 'no_show')),
    client_notes TEXT, -- Notes from client (visible to staff)
    internal_notes TEXT, -- Private staff notes
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    payment_method VARCHAR(50), -- e.g., "cash", "card", "check", "other"
    amount_paid_cents INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure appointment times make sense
    CHECK (end_time > start_time)
);

-- ----------------------------------------------------------------------------
-- 7. PAYMENTS TABLE
-- Stores detailed payment transaction records
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'check', 'other')),
    reference VARCHAR(255), -- Transaction reference or check number
    notes TEXT,
    recorded_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. LOYALTY_POINTS TABLE
-- Stores loyalty points balance for each client
-- ----------------------------------------------------------------------------
CREATE TABLE loyalty_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_redeemed INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. LOYALTY_TRANSACTIONS TABLE
-- Stores history of loyalty points earned/redeemed
-- ----------------------------------------------------------------------------
CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_id UUID NOT NULL REFERENCES loyalty_points(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired')),
    points_amount INTEGER NOT NULL, -- Positive for earned, negative for redeemed/expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. ACTIVITY_LOGS TABLE
-- Stores audit trail of all critical actions for security and compliance
-- ----------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    actor_id UUID, -- Staff member ID who performed the action
    action_type VARCHAR(100) NOT NULL, -- e.g., "appointment_created", "appointment_cancelled", "payment_recorded"
    entity_type VARCHAR(50) NOT NULL, -- e.g., "appointment", "client", "staff"
    entity_id UUID, -- ID of the affected entity
    changes JSONB, -- Store before/after values: {"field": {"old": "value1", "new": "value2"}}
    ip_address INET, -- IP address of the actor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Salons
CREATE INDEX idx_salons_slug ON salons(slug);
CREATE INDEX idx_salons_is_active ON salons(is_active);

-- Services
CREATE INDEX idx_services_salon_id ON services(salon_id);
CREATE INDEX idx_services_is_visible ON services(is_visible);
CREATE INDEX idx_services_is_active ON services(is_active);

-- Staff
CREATE INDEX idx_staff_salon_id ON staff(salon_id);
CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_is_active ON staff(is_active);

-- Staff Availability
CREATE INDEX idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX idx_staff_availability_day_of_week ON staff_availability(day_of_week);
CREATE INDEX idx_staff_availability_specific_date ON staff_availability(specific_date);

-- Clients
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_loyalty_status ON clients(loyalty_status);

-- Appointments
CREATE INDEX idx_appointments_salon_id ON appointments(salon_id);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_payment_status ON appointments(payment_status);

-- Composite index for conflict checking
CREATE INDEX idx_appointments_staff_time ON appointments(staff_id, start_time, end_time);

-- Payments
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_recorded_by ON payments(recorded_by_staff_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Loyalty Points
CREATE INDEX idx_loyalty_points_client_id ON loyalty_points(client_id);

-- Loyalty Transactions
CREATE INDEX idx_loyalty_transactions_loyalty_id ON loyalty_transactions(loyalty_id);
CREATE INDEX idx_loyalty_transactions_appointment_id ON loyalty_transactions(appointment_id);

-- Activity Logs
CREATE INDEX idx_activity_logs_salon_id ON activity_logs(salon_id);
CREATE INDEX idx_activity_logs_actor_id ON activity_logs(actor_id);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON salons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Note: Enable RLS policies based on your authentication requirements
-- These are examples and should be adjusted based on your security needs

-- Enable RLS on all tables
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (customize based on your auth setup)

-- Salons: Public read access for active salons
CREATE POLICY "Public salons are viewable by everyone"
    ON salons FOR SELECT
    USING (is_active = true);

-- Services: Public read access for visible services
CREATE POLICY "Public services are viewable by everyone"
    ON services FOR SELECT
    USING (is_visible = true AND is_active = true);

-- Staff: Only authenticated staff can view staff data
-- Note: Adjust based on your JWT claims structure
CREATE POLICY "Staff can view all staff"
    ON staff FOR SELECT
    USING (auth.role() = 'authenticated');

-- Appointments: Staff can view appointments for their salon
-- Note: This assumes JWT contains salon_id claim
CREATE POLICY "Staff can view salon appointments"
    ON appointments FOR SELECT
    USING (
        salon_id IN (
            SELECT salon_id FROM staff
            WHERE id = auth.uid()
        )
    );

-- Clients: Staff can view all clients
CREATE POLICY "Staff can view all clients"
    ON clients FOR SELECT
    USING (auth.role() = 'authenticated');

-- Activity Logs: Only managers and admins can view logs
CREATE POLICY "Managers and admins can view logs"
    ON activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE id = auth.uid()
            AND role IN ('manager', 'admin')
        )
    );

-- ============================================================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- ============================================================================

-- Function to check for appointment conflicts
CREATE OR REPLACE FUNCTION check_appointment_conflict(
    p_staff_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE staff_id = p_staff_id
      AND status IN ('confirmed', 'pending')
      AND (id != p_exclude_appointment_id OR p_exclude_appointment_id IS NULL)
      AND (
          (start_time < p_end_time AND end_time > p_start_time)
      );

    RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to update client statistics after appointment
CREATE OR REPLACE FUNCTION update_client_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update when appointment is marked as completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE clients
        SET
            visit_count = visit_count + 1,
            last_visit_date = NEW.start_time::DATE,
            total_spent_cents = total_spent_cents + NEW.amount_paid_cents
        WHERE id = NEW.client_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_stats_trigger
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stats();

-- Function to create activity log
CREATE OR REPLACE FUNCTION create_activity_log(
    p_salon_id UUID,
    p_actor_id UUID,
    p_action_type VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_changes JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO activity_logs (salon_id, actor_id, action_type, entity_type, entity_id, changes, ip_address)
    VALUES (p_salon_id, p_actor_id, p_action_type, p_entity_type, p_entity_id, p_changes, p_ip_address)
    RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA SEED (Optional - for development/testing)
-- ============================================================================

-- Insert sample salons
INSERT INTO salons (id, name, slug, address, city, phone, email, opening_hours) VALUES
('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Les Temples - Paris', 'temple-paris', '123 Rue de la Paix, 75000 Paris', 'Paris', '+33 1 23 45 67 89', 'paris@lestemples.fr',
'{"monday": {"open": "10:00", "close": "20:00"}, "tuesday": {"open": "10:00", "close": "20:00"}, "wednesday": {"open": "10:00", "close": "20:00"}, "thursday": {"open": "10:00", "close": "20:00"}, "friday": {"open": "10:00", "close": "21:00"}, "saturday": {"open": "09:00", "close": "21:00"}, "sunday": {"open": "10:00", "close": "19:00"}}'::jsonb),

('d290f1ee-6c54-4b01-90e6-d701748f0852', 'Les Temples - Lyon', 'temple-lyon', '456 Avenue de la République, 69000 Lyon', 'Lyon', '+33 4 72 34 56 78', 'lyon@lestemples.fr',
'{"monday": {"open": "10:00", "close": "20:00"}, "tuesday": {"open": "10:00", "close": "20:00"}, "wednesday": {"open": "10:00", "close": "20:00"}, "thursday": {"open": "10:00", "close": "20:00"}, "friday": {"open": "10:00", "close": "21:00"}, "saturday": {"open": "09:00", "close": "21:00"}, "sunday": {"open": "10:00", "close": "19:00"}}'::jsonb),

('d290f1ee-6c54-4b01-90e6-d701748f0853', 'Les Temples - Marseille', 'temple-marseille', '789 Boulevard de la Corniche, 13000 Marseille', 'Marseille', '+33 4 91 23 45 67', 'marseille@lestemples.fr',
'{"monday": {"open": "10:00", "close": "20:00"}, "tuesday": {"open": "10:00", "close": "20:00"}, "wednesday": {"open": "10:00", "close": "20:00"}, "thursday": {"open": "10:00", "close": "20:00"}, "friday": {"open": "10:00", "close": "21:00"}, "saturday": {"open": "09:00", "close": "21:00"}, "sunday": {"open": "10:00", "close": "19:00"}}'::jsonb);

-- Note: Add more sample data as needed for development
-- Services, Staff (with hashed passwords), etc.

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for upcoming appointments with all related data
CREATE OR REPLACE VIEW upcoming_appointments AS
SELECT
    a.id,
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.client_notes,
    a.internal_notes,
    sal.name AS salon_name,
    sal.city AS salon_city,
    c.first_name || ' ' || c.last_name AS client_name,
    c.phone AS client_phone,
    c.email AS client_email,
    st.first_name || ' ' || st.last_name AS staff_name,
    st.role AS staff_role,
    ser.name AS service_name,
    ser.duration_minutes,
    ser.price_cents
FROM appointments a
JOIN salons sal ON a.salon_id = sal.id
JOIN clients c ON a.client_id = c.id
JOIN staff st ON a.staff_id = st.id
JOIN services ser ON a.service_id = ser.id
WHERE a.start_time >= NOW()
  AND a.status IN ('confirmed', 'pending')
ORDER BY a.start_time;

-- View for staff schedule
CREATE OR REPLACE VIEW staff_schedules AS
SELECT
    s.id AS staff_id,
    s.first_name || ' ' || s.last_name AS staff_name,
    s.role,
    sal.name AS salon_name,
    sa.day_of_week,
    sa.start_time,
    sa.end_time,
    sa.is_recurring,
    sa.specific_date
FROM staff s
JOIN salons sal ON s.salon_id = sal.id
LEFT JOIN staff_availability sa ON s.id = sa.staff_id
WHERE s.is_active = true
ORDER BY s.last_name, sa.day_of_week, sa.start_time;

-- ============================================================================
-- COMPLETION
-- ============================================================================
-- Database schema creation complete.
-- Remember to:
-- 1. Set up proper environment variables for Supabase connection
-- 2. Configure RLS policies based on your authentication setup
-- 3. Add additional sample data for testing if needed
-- 4. Run migrations when making schema changes
-- ============================================================================


-- 1. Create staff_availability table if it doesn't exist
CREATE TABLE IF NOT EXISTS staff_availability (
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

-- 2. Populate default availability for all staff (Monday-Saturday, 09:00-19:00)
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_recurring)
SELECT id, day, '09:00'::TIME, '19:00'::TIME, true
FROM staff s
CROSS JOIN generate_series(1, 6) AS day
WHERE NOT EXISTS (
    SELECT 1 FROM staff_availability sa WHERE sa.staff_id = s.id
);

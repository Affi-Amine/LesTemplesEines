
-- 1. Ensure 'is_visible' column exists in services
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- 2. Create Duo Service
DO $$
DECLARE
    paris_salon_id UUID;
BEGIN
    -- Find the salon in Paris
    SELECT id INTO paris_salon_id FROM salons WHERE city ILIKE 'Paris' LIMIT 1;

    IF paris_salon_id IS NULL THEN
        RAISE NOTICE 'No salon found in Paris. Creating one...';
        INSERT INTO salons (name, slug, city, address, phone, email, is_active)
        VALUES ('Les Temples - Paris', 'les-temples-paris', 'Paris', '123 Rue de Rivoli', '0123456789', 'paris@temples.com', true)
        RETURNING id INTO paris_salon_id;
    END IF;

    -- Create "Massage Duo" service requiring 2 staff
    INSERT INTO services (
        salon_id,
        name,
        description,
        duration_minutes,
        price_cents,
        category,
        required_staff_count,
        is_active,
        is_visible
    ) VALUES (
        paris_salon_id,
        'Massage Duo Signature',
        'Un moment de détente partagé à deux. Nécessite deux praticiens simultanément.',
        60,
        18000, -- 180.00€
        'Détente',
        2, -- REQUIRES 2 STAFF
        true,
        true
    );
    
    RAISE NOTICE 'Service Massage Duo created for salon ID: %', paris_salon_id;

END $$;

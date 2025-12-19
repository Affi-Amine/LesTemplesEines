
DO $$
DECLARE
    v_service_id UUID;
    v_staff_1_id UUID;
    v_staff_2_id UUID;
    v_salon_id UUID;
BEGIN
    -- Get Salon ID (Paris)
    SELECT id INTO v_salon_id FROM salons WHERE city ILIKE 'Paris' LIMIT 1;

    -- Get Service ID
    SELECT id INTO v_service_id FROM services WHERE name = 'Massage Duo Signature' AND salon_id = v_salon_id LIMIT 1;

    -- Get Staff IDs
    SELECT id INTO v_staff_1_id FROM staff WHERE first_name ILIKE '%Jean%' AND last_name ILIKE '%Dupot%' LIMIT 1;
    SELECT id INTO v_staff_2_id FROM staff WHERE (first_name ILIKE '%Admin%' OR last_name ILIKE '%Temples%') AND salon_id = v_salon_id LIMIT 1;

    RAISE NOTICE 'Service ID: %', v_service_id;
    RAISE NOTICE 'Staff 1 ID: %', v_staff_1_id;
    RAISE NOTICE 'Staff 2 ID: %', v_staff_2_id;
END $$;

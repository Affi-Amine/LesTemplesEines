
DO $$
DECLARE
    v_start_date DATE := '2025-12-15';
    v_staff_1_id UUID;
    v_staff_2_id UUID;
    v_salon_id UUID;
BEGIN
    -- 1. Find Staff IDs
    SELECT id, salon_id INTO v_staff_1_id, v_salon_id FROM staff WHERE first_name ILIKE '%Jean%' AND last_name ILIKE '%Dupot%' LIMIT 1;
    SELECT id INTO v_staff_2_id FROM staff WHERE (first_name ILIKE '%Admin%' OR last_name ILIKE '%Temples%') AND salon_id = v_salon_id LIMIT 1;

    RAISE NOTICE 'Debug for Date: %', v_start_date;
    RAISE NOTICE 'Staff 1: %, ID: %', 'Jean Dupot', v_staff_1_id;
    RAISE NOTICE 'Staff 2: %, ID: %', 'Admin', v_staff_2_id;
    RAISE NOTICE 'Salon ID: %', v_salon_id;

    -- 2. Check Appointments
    RAISE NOTICE '--- Appointments for Staff 1 ---';
    FOR r IN (SELECT start_time, end_time, status FROM appointments WHERE staff_id = v_staff_1_id AND start_time::DATE = v_start_date) LOOP
        RAISE NOTICE '  % - % (%)', r.start_time, r.end_time, r.status;
    END LOOP;

    RAISE NOTICE '--- Appointments for Staff 2 ---';
    FOR r IN (SELECT start_time, end_time, status FROM appointments WHERE staff_id = v_staff_2_id AND start_time::DATE = v_start_date) LOOP
        RAISE NOTICE '  % - % (%)', r.start_time, r.end_time, r.status;
    END LOOP;

    -- 3. Check Assignments (Multi-staff)
    RAISE NOTICE '--- Assignments for Staff 1 ---';
    FOR r IN (
        SELECT a.start_time, a.end_time, a.status 
        FROM appointment_assignments aa 
        JOIN appointments a ON a.id = aa.appointment_id 
        WHERE aa.staff_id = v_staff_1_id AND a.start_time::DATE = v_start_date
    ) LOOP
        RAISE NOTICE '  % - % (%)', r.start_time, r.end_time, r.status;
    END LOOP;

    RAISE NOTICE '--- Assignments for Staff 2 ---';
    FOR r IN (
        SELECT a.start_time, a.end_time, a.status 
        FROM appointment_assignments aa 
        JOIN appointments a ON a.id = aa.appointment_id 
        WHERE aa.staff_id = v_staff_2_id AND a.start_time::DATE = v_start_date
    ) LOOP
        RAISE NOTICE '  % - % (%)', r.start_time, r.end_time, r.status;
    END LOOP;

    -- 4. Check Availability/Shifts
    RAISE NOTICE '--- Shifts for Staff 1 ---';
    -- 1 = Monday
    FOR r IN (SELECT * FROM staff_availability WHERE staff_id = v_staff_1_id AND (day_of_week = 1 OR specific_date = v_start_date)) LOOP
        RAISE NOTICE '  Recurring: %, Day: %, Date: %, Start: %, End: %', r.is_recurring, r.day_of_week, r.specific_date, r.start_time, r.end_time;
    END LOOP;

    RAISE NOTICE '--- Shifts for Staff 2 ---';
    FOR r IN (SELECT * FROM staff_availability WHERE staff_id = v_staff_2_id AND (day_of_week = 1 OR specific_date = v_start_date)) LOOP
        RAISE NOTICE '  Recurring: %, Day: %, Date: %, Start: %, End: %', r.is_recurring, r.day_of_week, r.specific_date, r.start_time, r.end_time;
    END LOOP;
    
    -- 5. Check Salon Hours
    RAISE NOTICE '--- Salon Hours ---';
    FOR r IN (SELECT opening_hours FROM salons WHERE id = v_salon_id) LOOP
        RAISE NOTICE '  %', r.opening_hours;
    END LOOP;

END $$;

-- Verification en lecture seule : chaque ligne doit afficher ok = true.
WITH move_function AS (
  SELECT to_regprocedure('public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid)') AS oid
)
SELECT 'Deplacement manuel et journal : fonction installee' AS controle,
       (SELECT oid IS NOT NULL FROM move_function) AS ok
UNION ALL
SELECT 'Deplacement : execution reservee au serveur',
       (SELECT COALESCE(has_function_privilege('service_role', oid, 'EXECUTE'), false)
         AND NOT COALESCE(has_function_privilege('anon', oid, 'EXECUTE'), true)
         AND NOT COALESCE(has_function_privilege('authenticated', oid, 'EXECUTE'), true)
        FROM move_function)
UNION ALL
SELECT 'Protections anti-chevauchement toujours actives',
       (SELECT count(*) = 2 FROM pg_catalog.pg_trigger
        WHERE (tgrelid = to_regclass('public.appointments') AND tgname = 'guard_appointment_interval'
            OR tgrelid = to_regclass('public.appointment_assignments') AND tgname = 'guard_appointment_assignment_interval')
          AND tgenabled IN ('O', 'A'))
UNION ALL
SELECT 'Journal : RLS active',
       COALESCE((SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = to_regclass('public.activity_logs')), false)
UNION ALL
SELECT 'Cadenas : choix du client enregistre',
       EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'appointments'
          AND column_name = 'client_requested_staff_ids' AND udt_name = '_uuid' AND is_nullable = 'NO')
UNION ALL
SELECT 'Etoiles : couleur de prestation disponible',
       EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'planning_color' AND data_type = 'text')
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = to_regclass('public.services') AND conname = 'services_planning_color_check');

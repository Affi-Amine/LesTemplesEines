-- LES TEMPLES : diagnostic OBSERVABLE qui annule toujours toutes ses modifications.
-- Exécuter tout le fichier en une seule fois dans le SQL Editor, sans transaction manuelle.
-- SUCCÈS ATTENDU : erreur volontaire PZ001 avec TEST_DEPLACEMENT_OK.
-- Cette erreur est la preuve du déplacement temporaire complet ET force son annulation.
-- Tout autre code indique un test échoué ou abandonné ; rien n'est sauvegardé non plus.
-- Préflight : PZ002 protections/triggers inattendus ; PZ003 calendrier occupé ;
-- PZ004 aucun compte admin/réception non réservable ; PZ005 aucun RDV de plus de 90 jours admissible.
-- Le DO est le seul ordre SQL : aucun COMMIT, aucun objet durable, aucun ID/nom client affiché.

DO $test$
DECLARE
  selected_actor uuid;
  booking public.appointments%ROWTYPE;
  members uuid[];
  request_id uuid := gen_random_uuid();
  response jsonb;
  expected_start timestamptz;
  expected_end timestamptz;
  error_code text;
BEGIN
  -- Refuse unknown active triggers before any row lock or temporary data write.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid IN ('public.appointments'::regclass,'public.appointment_assignments'::regclass,'public.activity_logs'::regclass)
      AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
      AND NOT ((t.tgrelid='public.appointments'::regclass AND t.tgfoid=to_regprocedure('public.guard_appointment_interval()'))
        OR (t.tgrelid='public.appointment_assignments'::regclass AND t.tgfoid=to_regprocedure('public.guard_appointment_assignment_interval()')))
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass
      AND tgfoid=to_regprocedure('public.guard_appointment_interval()') AND tgenabled IN ('O','A')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointment_assignments'::regclass
      AND tgfoid=to_regprocedure('public.guard_appointment_assignment_interval()') AND tgenabled IN ('O','A')
  ) OR NOT COALESCE(position('les_temples.salon_drag_appointment_id' IN pg_get_functiondef(to_regprocedure('public.guard_appointment_interval()')))>0,false)
    OR NOT COALESCE(position('les_temples.salon_drag_appointment_id' IN pg_get_functiondef(to_regprocedure('public.guard_appointment_assignment_interval()')))>0,false) THEN
    RAISE EXCEPTION USING ERRCODE='PZ002', MESSAGE='Préflight des protections non conforme.';
  END IF;
  PERFORM pg_catalog.set_config('role','service_role',true);
  PERFORM pg_catalog.set_config('lock_timeout','1s',true);
  -- Do not queue behind a live booking or interrupt another calendar write.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0)) THEN
    RAISE EXCEPTION USING ERRCODE='PZ003', MESSAGE='Calendrier occupé, test non exécuté.';
  END IF;
  SELECT id INTO selected_actor FROM public.staff
    WHERE role IN ('admin','receptionist') AND is_active IS FALSE
    ORDER BY role,id LIMIT 1;
  IF selected_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PZ004', MESSAGE='Aucun compte administratif non réservable à tester.';
  END IF;
  SELECT a.* INTO booking FROM public.appointments a
    WHERE a.end_time < clock_timestamp()-interval '90 days'
      AND a.status IN ('confirmed','completed')
      AND a.updated_at IS NOT NULL AND a.service_id IS NOT NULL
      AND pg_catalog.isfinite(a.start_time) AND pg_catalog.isfinite(a.end_time)
      AND a.end_time>a.start_time
      AND extract(second FROM a.start_time)=0
      AND mod(extract(minute FROM a.start_time)::integer,15)=0
      AND NOT EXISTS (
        SELECT 1 FROM (
          SELECT a.staff_id AS staff_id
          UNION SELECT x.staff_id FROM public.appointment_assignments x WHERE x.appointment_id=a.id
        ) team LEFT JOIN public.staff s ON s.id=team.staff_id
        WHERE s.id IS NULL OR s.salon_id IS DISTINCT FROM a.salon_id OR s.is_active IS DISTINCT FROM true
          OR COALESCE(s.role,'') NOT IN ('therapist','assistant','manager','admin')
      )
    ORDER BY a.end_time,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PZ005', MESSAGE='Aucun ancien rendez-vous admissible.';
  END IF;
  SELECT array_agg(member ORDER BY primary_order,member) INTO members FROM (
    SELECT member,min(primary_order) AS primary_order FROM (
      SELECT booking.staff_id AS member,0 AS primary_order
      UNION ALL SELECT x.staff_id,1 FROM public.appointment_assignments x WHERE x.appointment_id=booking.id
    ) original_team WHERE member IS NOT NULL GROUP BY member
  ) normalized;
  expected_start := booking.start_time+interval '15 minutes';
  expected_end := booking.end_time+interval '15 minutes';
  response := public.salon_drag_appointment_atomic(
    booking.salon_id,booking.id,booking.updated_at,expected_start,members,selected_actor,request_id);
  IF response->'appointment'->>'id' IS DISTINCT FROM booking.id::text
    OR response->'change'->>'id' IS NULL
    OR response->'change'->>'actor_id' IS DISTINCT FROM selected_actor::text
    OR (response->'appointment'->>'start_time')::timestamptz IS DISTINCT FROM expected_start
    OR (response->'appointment'->>'end_time')::timestamptz IS DISTINCT FROM expected_end
    OR response->'change'->'changes'->'after'->'staff_ids' IS DISTINCT FROM to_jsonb(members)
    OR ((response->'appointment') - ARRAY['start_time','end_time','updated_at','assignments','staff','client','service','salon'])
       IS DISTINCT FROM (to_jsonb(booking) - ARRAY['start_time','end_time','updated_at'])
    OR NOT EXISTS (SELECT 1 FROM public.activity_logs l WHERE l.id=(response->'change'->>'id')::uuid
      AND l.entity_id=booking.id AND l.actor_id=selected_actor AND l.changes->>'request_id'=request_id::text) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Contrôle interne du déplacement ou du journal non conforme.';
  END IF;
  RAISE EXCEPTION USING ERRCODE='PZ001', MESSAGE='TEST_DEPLACEMENT_OK : déplacement et journal vérifiés. Cette exception volontaire a annulé toutes les modifications du test.';
EXCEPTION WHEN OTHERS OR query_canceled OR assert_failure THEN
  GET STACKED DIAGNOSTICS error_code=RETURNED_SQLSTATE;
  IF error_code='PZ001' THEN RAISE; END IF;
  -- Never copy SQLERRM, row values, identifiers, names or contact details to the UI.
  RAISE EXCEPTION USING ERRCODE=error_code,
    MESSAGE='TEST_DEPLACEMENT_ECHEC : SQLSTATE ' || error_code || '. Aucune modification du test ne sera sauvegardée.';
END
$test$;

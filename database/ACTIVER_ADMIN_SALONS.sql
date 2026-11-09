-- LES TEMPLES : activation des trois fonctionnalites admin (9 novembre 2026).
-- Dans Supabase > SQL Editor, executer TOUT ce fichier sur le projet Les Temples.
-- Regroupe les trois migrations ci-dessous dans une seule transaction.
-- Aucun rendez-vous existant n'est deplace, aucun choix historique n'est invente.
-- Cree le journal activity_logs s'il manque.
-- Prerequis : autres tables du schema, service_items et protections anti-chevauchement.
-- Si un prerequis manque, le paquet echoue sans appliquer les trois migrations.
-- IMPORTANT : ne pas rejouer ensuite 2026-10-25_client_appointment_management.sql
-- sans rejouer aussi la migration salon_drag (elle met a jour les memes fonctions).
BEGIN;

DO $prerequisites$
DECLARE required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY['salons', 'staff', 'services', 'clients', 'appointments', 'appointment_assignments', 'staff_services', 'staff_availability'] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'Prerequis manquant : public.%.', required_table
        USING HINT = 'Ne pas rejouer le schema initial. Relever le nom de la table manquante pour appliquer uniquement sa migration.';
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'service_items') THEN
    RAISE EXCEPTION 'Prerequis manquant : appointments.service_items.'
      USING HINT = 'Executer database/migrations/2026-10-24_appointment_service_items.sql, puis relancer ce fichier.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = to_regclass('public.appointments') AND tgname = 'guard_appointment_interval'
      AND tgfoid = to_regprocedure('public.guard_appointment_interval()') AND tgenabled IN ('O', 'A'))
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = to_regclass('public.appointment_assignments') AND tgname = 'guard_appointment_assignment_interval'
      AND tgfoid = to_regprocedure('public.guard_appointment_assignment_interval()') AND tgenabled IN ('O', 'A')) THEN
    RAISE EXCEPTION 'Prerequis manquant : les deux protections anti-chevauchement doivent etre actives.'
      USING HINT = 'Verifier database/migrations/2026-10-25_client_appointment_management.sql avant de relancer ce fichier.';
  END IF;
END
$prerequisites$;

-- 1. 20261109003751_salon_drag_appointment_atomic.sql
-- Manual moves belong only to the salon dashboard's authenticated server route.
-- Ordinary booking/admin/client writers retain the same interval guards.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND tgname='guard_appointment_interval' AND tgenabled<>'D') OR
     NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointment_assignments'::regclass AND tgname='guard_appointment_assignment_interval' AND tgenabled<>'D') THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Installez les protections anti-chevauchement avant le déplacement manuel du salon.';
  END IF;
END $$;

-- Some deployed databases do not contain the journal from the initial schema.
-- Preserve snapshots when their salon, actor or appointment is later removed.
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  actor_id uuid,
  action_type varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_salon_drag_request_idx
  ON public.activity_logs ((changes->>'request_id'))
  WHERE action_type='salon_appointment_moved' AND changes->>'source'='salon_drag';
CREATE INDEX IF NOT EXISTS activity_logs_salon_drag_history_idx
  ON public.activity_logs (salon_id,created_at DESC,id)
  WHERE action_type='salon_appointment_moved' AND changes->>'source'='salon_drag';

CREATE OR REPLACE FUNCTION public.guard_appointment_interval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff_ids uuid[];
BEGIN
  -- SECURITY DEFINER changes current_user here. The invoker-only RPC checks
  -- current_user=service_role before setting this transaction-local, row-specific context.
  IF TG_OP='UPDATE' AND pg_catalog.current_setting('role',true)='service_role' AND
     pg_catalog.current_setting('les_temples.salon_drag_appointment_id',true)=NEW.id::text THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('confirmed','pending','blocked','in_progress') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('confirmed','pending','blocked','in_progress') AND
       (NEW.start_time,NEW.end_time,NEW.staff_id,NEW.salon_id) IS NOT DISTINCT FROM
       (OLD.start_time,OLD.end_time,OLD.staff_id,OLD.salon_id) THEN RETURN NEW; END IF;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  SELECT array_agg(DISTINCT staff_id) INTO staff_ids FROM (
    SELECT NEW.staff_id AS staff_id UNION SELECT x.staff_id FROM public.appointment_assignments x WHERE x.appointment_id=NEW.id
  ) team WHERE staff_id IS NOT NULL;
  IF EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id<>NEW.id
      AND a.status IN ('confirmed','pending','blocked','in_progress')
      AND a.start_time<NEW.end_time AND a.end_time>NEW.start_time
      AND (a.staff_id=ANY(staff_ids) OR EXISTS (SELECT 1 FROM public.appointment_assignments x WHERE x.appointment_id=a.id AND x.staff_id=ANY(staff_ids)))
  ) THEN RAISE EXCEPTION USING ERRCODE='23P01', MESSAGE='Ce créneau vient d’être réservé. Choisissez un autre horaire.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_appointment_assignment_interval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE booking public.appointments%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF pg_catalog.current_setting('role',true)='service_role' AND
     pg_catalog.current_setting('les_temples.salon_drag_appointment_id',true)=NEW.appointment_id::text THEN RETURN NEW; END IF;
  SELECT * INTO booking FROM public.appointments WHERE id=NEW.appointment_id;
  IF NOT FOUND OR booking.status NOT IN ('confirmed','pending','blocked','in_progress') THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id<>booking.id
      AND a.status IN ('confirmed','pending','blocked','in_progress')
      AND a.start_time<booking.end_time AND a.end_time>booking.start_time
      AND (a.staff_id=NEW.staff_id OR EXISTS (SELECT 1 FROM public.appointment_assignments x WHERE x.appointment_id=a.id AND x.staff_id=NEW.staff_id))
  ) THEN RAISE EXCEPTION USING ERRCODE='23P01', MESSAGE='Cette masseuse n’est plus disponible sur tout le créneau.'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.salon_drag_appointment_atomic(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_start_time timestamptz,
  p_staff_ids uuid[],
  p_actor_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  booking public.appointments%ROWTYPE;
  actor public.staff%ROWTYPE;
  previous_change public.activity_logs%ROWTYPE;
  change_entry public.activity_logs%ROWTYPE;
  members uuid[]; original_members uuid[];
  before_state jsonb; after_state jsonb; actor_state jsonb; client_state jsonb; service_state jsonb;
  result jsonb; previous_override text; replayed boolean := false;
  move_duration interval;
  overrides text[] := ARRAY[]::text[]; target_end timestamptz; target_day date; day_key text;
  opening jsonb; hours jsonb; salon_open timestamptz; salon_close timestamptz;
  member_id uuid; service_ids uuid[]; shift_mode text; periods tstzmultirange;
BEGIN
  IF current_user<>'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Déplacement réservé au serveur du salon.'; END IF;
  IF p_salon_id IS NULL OR p_appointment_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL OR
     p_expected_updated_at IS NULL OR p_start_time IS NULL OR NOT pg_catalog.isfinite(p_start_time) OR
     EXTRACT(SECOND FROM p_start_time)<>0 OR mod(EXTRACT(MINUTE FROM p_start_time)::integer,15)<>0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Choisissez un rendez-vous, une version et un horaire valide par quart d’heure.';
  END IF;
  IF p_staff_ids IS NULL OR pg_catalog.cardinality(p_staff_ids)=0 OR array_position(p_staff_ids,NULL) IS NOT NULL OR
     pg_catalog.cardinality(p_staff_ids)<>(SELECT count(DISTINCT member) FROM unnest(p_staff_ids) AS member) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Choisissez une équipe valide sans doublon.';
  END IF;
  members := p_staff_ids;
  SELECT * INTO actor FROM public.staff WHERE id=p_actor_id;
  IF NOT FOUND OR actor.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Ce compte ne peut pas déplacer les rendez-vous de ce salon.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  SELECT * INTO booking FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Rendez-vous introuvable.'; END IF;
  IF booking.salon_id IS DISTINCT FROM p_salon_id THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Ce rendez-vous appartient à un autre salon.'; END IF;
  SELECT array_agg(member ORDER BY primary_order,member) INTO original_members FROM (
    SELECT member,min(primary_order) AS primary_order FROM (
      SELECT booking.staff_id AS member,0 AS primary_order
      UNION ALL SELECT a.staff_id,1 FROM public.appointment_assignments a WHERE a.appointment_id=booking.id
    ) raw_members WHERE member IS NOT NULL GROUP BY member
  ) normalized;
  IF COALESCE(pg_catalog.cardinality(original_members),0)=0 OR pg_catalog.cardinality(members)<>pg_catalog.cardinality(original_members) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le déplacement doit conserver le nombre de masseuses du rendez-vous.';
  END IF;
  IF pg_catalog.cardinality(original_members)>1 THEN
    IF NOT (members @> original_members AND members <@ original_members) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Un rendez-vous duo conserve toute son équipe.';
    END IF;
    members := original_members;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(members) AS member WHERE NOT EXISTS (
    SELECT 1 FROM public.staff s WHERE s.id=member AND s.salon_id=p_salon_id AND s.is_active AND s.role IN ('therapist','assistant','manager','admin')
  )) THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Choisissez des masseuses actives de ce salon.'; END IF;

  SELECT * INTO previous_change FROM public.activity_logs
    WHERE action_type='salon_appointment_moved' AND changes->>'source'='salon_drag' AND changes->>'request_id'=p_request_id::text;
  IF FOUND THEN
    IF previous_change.entity_id IS DISTINCT FROM booking.id OR previous_change.salon_id IS DISTINCT FROM p_salon_id OR
       previous_change.actor_id IS DISTINCT FROM p_actor_id OR
       (previous_change.changes->'after'->>'start_time')::timestamptz IS DISTINCT FROM p_start_time OR
       previous_change.changes->'after'->'staff_ids' IS DISTINCT FROM to_jsonb(members) THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Cette demande a déjà servi à un autre déplacement.';
    END IF;
    change_entry := previous_change;
    replayed := true;
  ELSE
    IF booking.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Ce rendez-vous a été modifié. Actualisez le planning avant de réessayer.';
    END IF;
    move_duration := booking.end_time-booking.start_time;
    IF move_duration<=interval '0 seconds' OR NOT pg_catalog.isfinite(booking.start_time) OR NOT pg_catalog.isfinite(booking.end_time) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La durée enregistrée du rendez-vous est invalide.';
    END IF;
    target_end := p_start_time+move_duration;
    IF p_start_time<clock_timestamp() THEN overrides := array_append(overrides,'past_time'); END IF;
    IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.id<>booking.id
      AND a.status IN ('confirmed','pending','blocked','in_progress') AND a.start_time<target_end AND a.end_time>p_start_time
      AND (a.staff_id=ANY(members) OR EXISTS (SELECT 1 FROM public.appointment_assignments x WHERE x.appointment_id=a.id AND x.staff_id=ANY(members)))) THEN
      overrides := array_append(overrides,'overlap');
    END IF;
    target_day := (p_start_time AT TIME ZONE 'Europe/Paris')::date;
    day_key := (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow FROM target_day)::integer+1];
    SELECT opening_hours INTO opening FROM public.salons WHERE id=p_salon_id;
    IF opening IS NULL OR opening='{}'::jsonb THEN
      opening := '{"monday":{"open":"10:00","close":"20:00"},"tuesday":{"open":"10:00","close":"20:00"},"wednesday":{"open":"10:00","close":"20:00"},"thursday":{"open":"10:00","close":"20:00"},"friday":{"open":"10:00","close":"20:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'::jsonb;
    END IF;
    hours := opening->day_key;
    BEGIN
      IF hours IS NULL OR hours='null'::jsonb OR hours->>'open' IS NULL OR hours->>'close' IS NULL THEN
        overrides := array_append(overrides,'opening_hours');
      ELSE
        salon_open := (target_day+(hours->>'open')::time) AT TIME ZONE 'Europe/Paris';
        salon_close := (target_day+(hours->>'close')::time) AT TIME ZONE 'Europe/Paris';
        IF salon_close<=salon_open OR p_start_time<salon_open OR target_end>salon_close THEN overrides := array_append(overrides,'opening_hours'); END IF;
      END IF;
    EXCEPTION WHEN data_exception THEN
      overrides := array_append(overrides,'opening_hours');
    END;
    service_ids := ARRAY[booking.service_id];
    IF jsonb_typeof(booking.service_items)='array' AND jsonb_array_length(booking.service_items)>0 THEN
      SELECT array_agg((item->>'id')::uuid) INTO service_ids FROM jsonb_array_elements(booking.service_items) item;
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(service_ids) AS selected_service(id) WHERE EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.service_id=selected_service.id)
      AND EXISTS (SELECT 1 FROM unnest(members) AS member WHERE NOT EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.service_id=selected_service.id AND ss.staff_id=member))) THEN
      overrides := array_append(overrides,'qualification');
    END IF;
    FOREACH member_id IN ARRAY members LOOP
      IF EXISTS (SELECT 1 FROM public.staff_availability sa WHERE sa.staff_id=member_id AND NOT sa.is_recurring AND sa.specific_date=target_day) THEN shift_mode := 'specific';
      ELSIF EXISTS (SELECT 1 FROM public.staff_availability sa WHERE sa.staff_id=member_id AND sa.is_recurring) THEN shift_mode := 'recurring';
      ELSE shift_mode := 'default'; END IF;
      IF shift_mode<>'default' THEN
        SELECT range_agg(tstzrange((target_day+sa.start_time) AT TIME ZONE 'Europe/Paris',(target_day+sa.end_time) AT TIME ZONE 'Europe/Paris','[)')) INTO periods
          FROM public.staff_availability sa WHERE sa.staff_id=member_id AND sa.start_time IS NOT NULL AND sa.end_time>sa.start_time
          AND ((shift_mode='specific' AND NOT sa.is_recurring AND sa.specific_date=target_day) OR
            (shift_mode='recurring' AND sa.is_recurring AND sa.day_of_week=extract(dow FROM target_day)::integer));
        IF periods IS NULL OR NOT (periods @> tstzrange(p_start_time,target_end,'[)')) THEN
          IF NOT ('availability'=ANY(overrides)) THEN overrides := array_append(overrides,'availability'); END IF;
        END IF;
      END IF;
    END LOOP;
    SELECT jsonb_build_object('start_time',booking.start_time,'end_time',booking.end_time,'staff_ids',to_jsonb(original_members),
      'staff',COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',concat_ws(' ',s.first_name,s.last_name),'first_name',s.first_name,'last_name',s.last_name,'role',s.role) ORDER BY array_position(original_members,s.id)),'[]'::jsonb))
      INTO before_state FROM public.staff s WHERE s.id=ANY(original_members);
    actor_state := jsonb_build_object('id',actor.id,'name',concat_ws(' ',actor.first_name,actor.last_name),'first_name',actor.first_name,'last_name',actor.last_name,'role',actor.role);
    SELECT jsonb_build_object('id',c.id,'name',concat_ws(' ',c.first_name,c.last_name),'first_name',c.first_name,'last_name',c.last_name) INTO client_state FROM public.clients c WHERE c.id=booking.client_id;
    SELECT jsonb_build_object('id',s.id,'name',s.name) INTO service_state FROM public.services s WHERE s.id=booking.service_id;
    previous_override := pg_catalog.current_setting('les_temples.salon_drag_appointment_id',true);
    BEGIN
      PERFORM pg_catalog.set_config('les_temples.salon_drag_appointment_id',booking.id::text,true);
      DELETE FROM public.appointment_assignments WHERE appointment_id=booking.id;
      UPDATE public.appointments SET start_time=p_start_time,end_time=p_start_time+move_duration,staff_id=members[1],updated_at=clock_timestamp()
        WHERE id=booking.id RETURNING * INTO booking;
      INSERT INTO public.appointment_assignments(appointment_id,staff_id) SELECT booking.id,member FROM unnest(members) AS member;
      SELECT jsonb_build_object('start_time',booking.start_time,'end_time',booking.end_time,'staff_ids',to_jsonb(members),
        'staff',COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',concat_ws(' ',s.first_name,s.last_name),'first_name',s.first_name,'last_name',s.last_name,'role',s.role) ORDER BY array_position(members,s.id)),'[]'::jsonb))
        INTO after_state FROM public.staff s WHERE s.id=ANY(members);
      INSERT INTO public.activity_logs(salon_id,actor_id,action_type,entity_type,entity_id,changes)
        VALUES(p_salon_id,p_actor_id,'salon_appointment_moved','appointment',booking.id,jsonb_build_object(
          'source','salon_drag','request_id',p_request_id,'actor',actor_state,'client',client_state,'service',service_state,
          'before',before_state,'after',after_state,'overrides',to_jsonb(overrides)))
        RETURNING * INTO change_entry;
      PERFORM pg_catalog.set_config('les_temples.salon_drag_appointment_id',COALESCE(previous_override,''),true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('les_temples.salon_drag_appointment_id',COALESCE(previous_override,''),true);
      RAISE;
    END;
  END IF;

  SELECT to_jsonb(booking) || jsonb_build_object(
    'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('staff_id',a.staff_id,'staff',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name))) FROM public.appointment_assignments a JOIN public.staff s ON s.id=a.staff_id WHERE a.appointment_id=booking.id),'[]'::jsonb),
    'staff',(SELECT jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'role',s.role,'phone',s.phone) FROM public.staff s WHERE s.id=booking.staff_id),
    'client',(SELECT to_jsonb(c) FROM public.clients c WHERE c.id=booking.client_id),
    'service',(SELECT to_jsonb(s) FROM public.services s WHERE s.id=booking.service_id),
    'salon',(SELECT jsonb_build_object('id',s.id,'name',s.name,'city',s.city,'address',s.address) FROM public.salons s WHERE s.id=booking.salon_id)
  ) INTO result;
  RETURN jsonb_build_object('appointment',result,'change',to_jsonb(change_entry),'replayed',replayed);
END $$;

REVOKE ALL ON FUNCTION public.guard_appointment_interval() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_appointment_assignment_interval() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';

-- 2. 20261109005631_client_requested_staff_ids.sql
-- A chosen practitioner is different from the staff eventually assigned to a booking.
-- Historical bookings remain unknown (empty): no preference is inferred or backfilled.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_requested_staff_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.appointments.client_requested_staff_ids IS
  'Original practitioners explicitly chosen by the client; empty for automatic assignment or unknown historical choice. Preserved when the appointment is moved.';

NOTIFY pgrst, 'reload schema';

-- 3. 20261109011225_service_planning_color.sql
-- Optional catalogue-only markers. Appointment quotes and payment amounts are unchanged.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS planning_color text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_planning_color_check') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_planning_color_check CHECK (
      planning_color IS NULL OR planning_color IN (
        'tangerine','apricot','coral','raspberry','fuchsia','orchid',
        'periwinkle','cyan','turquoise','olive','cocoa','graphite'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.services.planning_color IS
  'Optional palette code for the service star displayed in the planning; does not affect appointment status, duration or price.';
NOTIFY pgrst, 'reload schema';

COMMIT;

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

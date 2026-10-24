-- Apply only after the existing schema/migrations. No historical backfill.
-- All appointment schedule mutations must go through this service-role RPC.
BEGIN;
-- Keep current URLs, but forbid ambiguous names at the URL boundary.
CREATE UNIQUE INDEX IF NOT EXISTS salons_normalized_slug_unique ON public.salons (lower(btrim(slug)));

CREATE OR REPLACE FUNCTION public.booking_interval_allowed(
  p_staff_id uuid, p_start timestamptz, p_end timestamptz, p_hours jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  d date := (p_start AT TIME ZONE 'Europe/Paris')::date;
  dow integer := extract(dow FROM p_start AT TIME ZONE 'Europe/Paris');
  day_key text := (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[dow + 1];
  hours jsonb; s time; e time; has_specific boolean;
BEGIN
  IF p_end <= p_start OR (p_end AT TIME ZONE 'Europe/Paris')::date <> d THEN RETURN false; END IF;
  IF p_hours IS NULL OR p_hours = '{}'::jsonb THEN
    hours := CASE WHEN dow = 6 THEN '{"open":"09:00","close":"21:00"}'::jsonb
                  WHEN dow = 0 THEN '{"open":"10:00","close":"19:00"}'::jsonb
                  ELSE '{"open":"10:00","close":"20:00"}'::jsonb END;
  ELSE hours := p_hours -> day_key; END IF;
  IF hours IS NULL THEN RETURN false; END IF;
  s := (p_start AT TIME ZONE 'Europe/Paris')::time;
  e := (p_end AT TIME ZONE 'Europe/Paris')::time;
  IF s < (hours->>'open')::time OR e > (hours->>'close')::time THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.staff_availability WHERE staff_id=p_staff_id AND NOT is_recurring AND specific_date=d) INTO has_specific;
  -- range_agg merges overlapping/adjacent shifts, while retaining lunch breaks.
  IF has_specific OR EXISTS(SELECT 1 FROM public.staff_availability WHERE staff_id=p_staff_id AND is_recurring) THEN
    RETURN COALESCE((
      SELECT pg_catalog.range_agg(pg_catalog.tsrange(d + start_time, d + end_time, '[)'))
             @> pg_catalog.tsrange(p_start AT TIME ZONE 'Europe/Paris', p_end AT TIME ZONE 'Europe/Paris', '[)')
      FROM public.staff_availability
      WHERE staff_id=p_staff_id AND start_time IS NOT NULL AND end_time > start_time
        AND ((has_specific AND NOT is_recurring AND specific_date=d)
          OR (NOT has_specific AND is_recurring AND day_of_week=dow))
    ), false);
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_appointment_schedule(
  p_appointment jsonb, p_staff_ids uuid[] DEFAULT NULL, p_appointment_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  previous public.appointments%ROWTYPE;
  candidate public.appointments%ROWTYPE;
  ids uuid[];
  member public.staff%ROWTYPE;
  salon public.salons%ROWTYPE;
  service public.services%ROWTYPE;
  scheduling_changed boolean;
  team_changed boolean;
  reactivating boolean;
  blocking boolean;
BEGIN
  -- The conflict SELECT must get a fresh snapshot after a competing lock is
  -- released. PostgREST defaults to READ COMMITTED; reject stale-snapshot modes.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Cette opération nécessite une transaction READ COMMITTED' USING ERRCODE='40001';
  END IF;
  IF p_appointment_id IS NULL THEN
    candidate := pg_catalog.jsonb_populate_record(NULL::public.appointments, p_appointment);
    candidate.id := pg_catalog.gen_random_uuid();
    candidate.status := COALESCE(candidate.status, 'confirmed');
    candidate.payment_status := COALESCE(candidate.payment_status, 'unpaid');
    candidate.amount_paid_cents := COALESCE(candidate.amount_paid_cents, 0);
    candidate.created_at := pg_catalog.now();
    scheduling_changed := true;
  ELSE
    SELECT * INTO previous FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rendez-vous introuvable' USING ERRCODE='22023'; END IF;
    IF p_appointment ? 'expected_updated_at' AND previous.updated_at IS DISTINCT FROM (p_appointment->>'expected_updated_at')::timestamptz THEN
      RAISE EXCEPTION 'Le rendez-vous a été modifié entre-temps' USING ERRCODE='40001';
    END IF;
    candidate := pg_catalog.jsonb_populate_record(previous, p_appointment - 'expected_updated_at');
    candidate.id := previous.id;
    candidate.created_at := previous.created_at;
    -- Only fields supported by the API can be changed by this operation.
    candidate.client_id := previous.client_id;
    candidate.stripe_checkout_session_id := previous.stripe_checkout_session_id;
    candidate.stripe_payment_intent_id := previous.stripe_payment_intent_id;
    scheduling_changed := (candidate.salon_id, candidate.service_id, candidate.start_time, candidate.end_time, candidate.staff_id)
      IS DISTINCT FROM (previous.salon_id, previous.service_id, previous.start_time, previous.end_time, previous.staff_id);
  END IF;
  IF p_staff_ids IS NOT NULL THEN
    IF cardinality(p_staff_ids)=0 OR array_position(p_staff_ids, NULL) IS NOT NULL THEN
      RAISE EXCEPTION 'Équipe invalide' USING ERRCODE='23514';
    END IF;
    SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT DISTINCT unnest(p_staff_ids) id) x;
    candidate.staff_id := p_staff_ids[1];
    IF p_appointment ? 'staff_id' AND (p_appointment->>'staff_id')::uuid IS DISTINCT FROM candidate.staff_id THEN
      RAISE EXCEPTION 'Praticien principal incohérent' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT array_agg(id ORDER BY id) INTO ids FROM (
      SELECT candidate.staff_id AS id WHERE candidate.staff_id IS NOT NULL
      UNION SELECT staff_id FROM public.appointment_assignments WHERE appointment_id=p_appointment_id
    ) x;
  END IF;
  team_changed := p_appointment_id IS NULL OR (p_staff_ids IS NOT NULL AND ids IS DISTINCT FROM (
    SELECT array_agg(id ORDER BY id) FROM (
      SELECT previous.staff_id id WHERE previous.staff_id IS NOT NULL
      UNION SELECT staff_id FROM public.appointment_assignments WHERE appointment_id=p_appointment_id
    ) x
  ));
  scheduling_changed := scheduling_changed OR team_changed;
  blocking := candidate.status IN ('confirmed','pending','in_progress','blocked');
  reactivating := p_appointment_id IS NOT NULL AND blocking AND previous.status NOT IN ('confirmed','pending','in_progress','blocked');

  IF scheduling_changed OR reactivating THEN
    IF candidate.end_time <= candidate.start_time OR candidate.start_time IS NULL OR candidate.end_time IS NULL OR candidate.start_time < pg_catalog.now() THEN
      RAISE EXCEPTION 'Dates de rendez-vous invalides ou passées' USING ERRCODE='23514';
    END IF;
    IF COALESCE(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'Équipe obligatoire' USING ERRCODE='23514'; END IF;
    SELECT * INTO salon FROM public.salons WHERE id=candidate.salon_id FOR SHARE;
    IF NOT FOUND OR salon.is_active IS NOT TRUE THEN RAISE EXCEPTION 'Salon indisponible' USING ERRCODE='23514'; END IF;
    -- Sorted staff row locks serialize competing bookings, including duo teams.
    PERFORM id FROM public.staff WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
    IF (SELECT count(*) FROM public.staff WHERE id=ANY(ids)) <> cardinality(ids) THEN
      RAISE EXCEPTION 'Praticien introuvable' USING ERRCODE='23514';
    END IF;
    IF candidate.service_id IS NOT NULL THEN
      SELECT * INTO service FROM public.services WHERE id=candidate.service_id FOR SHARE;
      IF NOT FOUND OR service.is_active IS NOT TRUE OR NOT EXISTS (
        SELECT 1 FROM public.service_salons WHERE service_id=candidate.service_id AND salon_id=candidate.salon_id
      ) THEN RAISE EXCEPTION 'Prestation indisponible dans ce salon' USING ERRCODE='23514'; END IF;
      IF candidate.status <> 'blocked' AND cardinality(ids) <> COALESCE(service.required_staff_count,1) THEN
        RAISE EXCEPTION 'Nombre de praticiens incorrect' USING ERRCODE='23514';
      END IF;
    ELSIF candidate.status <> 'blocked' THEN RAISE EXCEPTION 'Prestation obligatoire' USING ERRCODE='23514'; END IF;

    FOR member IN SELECT * FROM public.staff WHERE id=ANY(ids) LOOP
      IF member.salon_id IS DISTINCT FROM candidate.salon_id OR member.is_active IS NOT TRUE OR member.role IS NULL OR member.role NOT IN ('therapist','assistant','manager','admin') THEN
        RAISE EXCEPTION 'Praticien inactif ou affecté à un autre salon' USING ERRCODE='23514';
      END IF;
      IF candidate.status <> 'blocked' THEN
        IF EXISTS(SELECT 1 FROM public.staff_services WHERE staff_id=member.id) AND NOT EXISTS(
          SELECT 1 FROM public.staff_services WHERE staff_id=member.id AND service_id=candidate.service_id
        ) THEN RAISE EXCEPTION 'Praticien non autorisé pour ce soin' USING ERRCODE='23514'; END IF;
        IF NOT public.booking_interval_allowed(member.id, candidate.start_time, candidate.end_time, salon.opening_hours) THEN
          RAISE EXCEPTION 'Créneau en dehors des horaires' USING ERRCODE='23514';
        END IF;
      END IF;
    END LOOP;

    IF blocking AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id <> candidate.id AND a.status IN ('confirmed','pending','in_progress','blocked')
        AND a.start_time < candidate.end_time AND a.end_time > candidate.start_time
        AND (a.staff_id=ANY(ids) OR EXISTS (
          SELECT 1 FROM public.appointment_assignments aa WHERE aa.appointment_id=a.id AND aa.staff_id=ANY(ids)
        ))
    ) THEN RAISE EXCEPTION 'Ce créneau est déjà réservé' USING ERRCODE='23P01'; END IF;
  END IF;

  candidate.updated_at := pg_catalog.now();
  IF p_appointment_id IS NULL THEN
    INSERT INTO public.appointments (id,salon_id,client_id,staff_id,service_id,start_time,end_time,status,
      client_notes,internal_notes,payment_status,payment_method,amount_paid_cents,paid_at,created_at,updated_at)
    VALUES (candidate.id,candidate.salon_id,candidate.client_id,candidate.staff_id,candidate.service_id,
      candidate.start_time,candidate.end_time,candidate.status,candidate.client_notes,candidate.internal_notes,
      candidate.payment_status,candidate.payment_method,candidate.amount_paid_cents,candidate.paid_at,candidate.created_at,candidate.updated_at);
  ELSE
    UPDATE public.appointments SET salon_id=candidate.salon_id,staff_id=candidate.staff_id,service_id=candidate.service_id,
      start_time=candidate.start_time,end_time=candidate.end_time,status=candidate.status,
      client_notes=candidate.client_notes,internal_notes=candidate.internal_notes,payment_status=candidate.payment_status,
      payment_method=candidate.payment_method,amount_paid_cents=candidate.amount_paid_cents,paid_at=candidate.paid_at,
      updated_at=candidate.updated_at WHERE id=candidate.id;
  END IF;
  IF p_staff_ids IS NOT NULL OR p_appointment_id IS NULL THEN
    DELETE FROM public.appointment_assignments WHERE appointment_id=candidate.id;
    INSERT INTO public.appointment_assignments (appointment_id,staff_id) SELECT candidate.id,unnest(ids);
  END IF;
  RETURN candidate.id;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_interval_allowed(uuid,timestamptz,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_appointment_schedule(jsonb,uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_interval_allowed(uuid,timestamptz,timestamptz,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_appointment_schedule(jsonb,uuid[],uuid) TO service_role;
-- Public availability is read-only. Only the server may mutate schedules.
REVOKE INSERT, UPDATE, DELETE ON public.appointments, public.appointment_assignments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_staff_future_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (NEW.salon_id IS DISTINCT FROM OLD.salon_id OR NEW.is_active IS NOT TRUE
      OR NEW.role NOT IN ('therapist','assistant','manager','admin')) AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.end_time > pg_catalog.now() AND a.status IN ('confirmed','pending','in_progress','blocked')
      AND (a.staff_id=NEW.id OR EXISTS (
        SELECT 1 FROM public.appointment_assignments aa WHERE aa.appointment_id=a.id AND aa.staff_id=NEW.id
      ))
  ) THEN RAISE EXCEPTION 'Réaffectez les rendez-vous à venir avant de transférer ou désactiver ce praticien' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_staff_future_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_staff_future_schedule() TO service_role;
CREATE TRIGGER staff_future_schedule_guard BEFORE UPDATE OF salon_id, is_active, role ON public.staff
FOR EACH ROW WHEN ((OLD.salon_id, OLD.is_active, OLD.role) IS DISTINCT FROM (NEW.salon_id, NEW.is_active, NEW.role))
EXECUTE FUNCTION public.guard_staff_future_schedule();
COMMIT;

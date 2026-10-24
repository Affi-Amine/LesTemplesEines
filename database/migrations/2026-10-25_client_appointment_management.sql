-- Private guest access, atomic client changes, and conflict guards for all writers.
BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_management_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_management_links_appointment_idx ON public.appointment_management_links(appointment_id);
ALTER TABLE public.appointment_management_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_management_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_management_links TO service_role;

CREATE TABLE IF NOT EXISTS public.appointment_client_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.appointment_management_links(id),
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('cancel', 'reschedule')),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, request_id)
);
ALTER TABLE public.appointment_client_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_client_changes
  ADD COLUMN IF NOT EXISTS notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sent','failed')),
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
REVOKE ALL ON public.appointment_client_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appointment_client_changes TO service_role;

-- A short calendar write lock serializes interval checks with inserts from the existing
-- booking/admin APIs as well as the guest RPC. No existing rows are rewritten.
CREATE OR REPLACE FUNCTION public.guard_appointment_interval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE staff_ids uuid[];
BEGIN
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
DROP TRIGGER IF EXISTS guard_appointment_interval ON public.appointments;
CREATE TRIGGER guard_appointment_interval BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_interval();

CREATE OR REPLACE FUNCTION public.guard_appointment_assignment_interval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE booking public.appointments%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
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
DROP TRIGGER IF EXISTS guard_appointment_assignment_interval ON public.appointment_assignments;
CREATE TRIGGER guard_appointment_assignment_interval BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_assignment_interval();

CREATE OR REPLACE FUNCTION public.client_change_appointment(
  p_token_hash text, p_appointment_id uuid, p_request_id uuid,
  p_expected_updated_at timestamptz, p_action text, p_start_time timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  access_link public.appointment_management_links%ROWTYPE;
  booking public.appointments%ROWTYPE;
  previous public.appointment_client_changes%ROWTYPE;
  before_value jsonb; after_value jsonb;
  today date; target_day date; duration interval; new_end timestamptz;
  staff_ids uuid[]; v_staff_id uuid; v_service_id uuid; service_ids uuid[];
  opening jsonb; hours jsonb; day_key text; salon_open timestamptz; salon_close timestamptz;
  periods tstzmultirange; shift_mode text;
BEGIN
  SELECT * INTO access_link FROM public.appointment_management_links
    WHERE token_hash=p_token_hash AND revoked_at IS NULL AND expires_at>clock_timestamp();
  IF NOT FOUND OR access_link.appointment_id<>p_appointment_id THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='Lien invalide ou expiré.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  SELECT * INTO booking FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Rendez-vous introuvable.'; END IF;
  SELECT * INTO access_link FROM public.appointment_management_links
    WHERE token_hash=p_token_hash AND appointment_id=booking.id AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='Lien invalide ou expiré.'; END IF;
  SELECT * INTO previous FROM public.appointment_client_changes WHERE appointment_id=booking.id AND request_id=p_request_id;
  IF FOUND THEN
    IF previous.action<>p_action OR (p_action='reschedule' AND (previous.after_state->>'start_time')::timestamptz IS DISTINCT FROM p_start_time) THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Cette demande a déjà été utilisée pour une autre opération.';
    END IF;
    RETURN jsonb_build_object('id',booking.id,'replayed',true);
  END IF;
  IF p_action NOT IN ('cancel','reschedule') OR p_request_id IS NULL THEN RAISE EXCEPTION 'Action invalide.'; END IF;
  today := (clock_timestamp() AT TIME ZONE 'Europe/Paris')::date;
  IF (booking.start_time AT TIME ZONE 'Europe/Paris')::date<=today THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Le jour même ou après le rendez-vous, contactez directement le salon.';
  END IF;
  IF booking.status NOT IN ('confirmed','pending') THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Ce rendez-vous ne peut plus être modifié en ligne.'; END IF;
  IF coalesce(booking.updated_at,booking.created_at,booking.start_time) IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Le rendez-vous a changé. Actualisez la page avant de confirmer.';
  END IF;
  before_value := jsonb_build_object('status',booking.status,'start_time',booking.start_time,'end_time',booking.end_time);
  IF p_action='cancel' THEN
    UPDATE public.appointments SET status='cancelled',updated_at=clock_timestamp() WHERE id=booking.id RETURNING * INTO booking;
  ELSE
    IF p_start_time IS NULL THEN RAISE EXCEPTION 'Choisissez un horaire.'; END IF;
    target_day := (p_start_time AT TIME ZONE 'Europe/Paris')::date;
    IF target_day<=today OR extract(second FROM p_start_time)<>0 OR mod(extract(minute FROM p_start_time)::integer,15)<>0 THEN
      RAISE EXCEPTION 'Choisissez un créneau à partir de demain.';
    END IF;
    duration:=booking.end_time-booking.start_time;
    IF duration<=interval '0 seconds' OR duration>interval '24 hours' THEN RAISE EXCEPTION 'Durée de rendez-vous invalide.'; END IF;
    new_end:=p_start_time+duration;
    SELECT array_agg(DISTINCT member) INTO staff_ids FROM (
      SELECT booking.staff_id AS member UNION SELECT x.staff_id FROM public.appointment_assignments x WHERE x.appointment_id=booking.id
    ) members WHERE member IS NOT NULL;
    IF coalesce(cardinality(staff_ids),0)=0 THEN RAISE EXCEPTION 'Contactez le salon pour choisir votre équipe.'; END IF;
    SELECT opening_hours INTO opening FROM public.salons WHERE id=booking.salon_id;
    IF opening IS NULL OR opening='{}'::jsonb THEN
      opening:='{"monday":{"open":"10:00","close":"20:00"},"tuesday":{"open":"10:00","close":"20:00"},"wednesday":{"open":"10:00","close":"20:00"},"thursday":{"open":"10:00","close":"20:00"},"friday":{"open":"10:00","close":"20:00"},"saturday":{"open":"09:00","close":"21:00"},"sunday":{"open":"10:00","close":"19:00"}}'::jsonb;
    END IF;
    day_key:=(ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow FROM target_day)::integer+1];
    hours:=opening->day_key;
    IF hours IS NULL OR hours='null'::jsonb OR hours->>'open' IS NULL OR hours->>'close' IS NULL THEN RAISE EXCEPTION 'Le salon est fermé ce jour.'; END IF;
    salon_open:=(target_day+(hours->>'open')::time) AT TIME ZONE 'Europe/Paris';
    salon_close:=(target_day+(hours->>'close')::time) AT TIME ZONE 'Europe/Paris';
    IF p_start_time<salon_open OR new_end>salon_close THEN RAISE EXCEPTION 'Ce créneau dépasse les horaires du salon.'; END IF;
    service_ids:=ARRAY[booking.service_id];
    IF jsonb_typeof(to_jsonb(booking)->'service_items')='array' AND jsonb_array_length(to_jsonb(booking)->'service_items')>0 THEN
      SELECT array_agg((item->>'id')::uuid) INTO service_ids FROM jsonb_array_elements(to_jsonb(booking)->'service_items') item;
    END IF;
    FOREACH v_staff_id IN ARRAY staff_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id=v_staff_id AND s.salon_id=booking.salon_id AND s.is_active AND s.role IN ('therapist','assistant','manager','admin')) THEN
        RAISE EXCEPTION 'Votre équipe n’est plus disponible. Contactez le salon.';
      END IF;
      FOREACH v_service_id IN ARRAY service_ids LOOP
        IF EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.service_id=v_service_id) AND
          NOT EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.service_id=v_service_id AND ss.staff_id=v_staff_id) THEN RAISE EXCEPTION 'Votre équipe ne peut plus réaliser ce soin. Contactez le salon.'; END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM public.staff_availability sa WHERE sa.staff_id=v_staff_id AND NOT sa.is_recurring AND sa.specific_date=target_day) THEN shift_mode:='specific';
      ELSIF EXISTS (SELECT 1 FROM public.staff_availability sa WHERE sa.staff_id=v_staff_id AND sa.is_recurring) THEN shift_mode:='recurring';
      ELSE shift_mode:='default'; END IF;
      IF shift_mode<>'default' THEN
        SELECT range_agg(tstzrange(greatest(salon_open,(target_day+sa.start_time) AT TIME ZONE 'Europe/Paris'),least(salon_close,(target_day+sa.end_time) AT TIME ZONE 'Europe/Paris'),'[)')) INTO periods
        FROM public.staff_availability sa WHERE sa.staff_id=v_staff_id AND sa.start_time IS NOT NULL AND sa.end_time>sa.start_time
          AND ((shift_mode='specific' AND NOT sa.is_recurring AND sa.specific_date=target_day) OR
            (shift_mode='recurring' AND sa.is_recurring AND sa.day_of_week=extract(dow FROM target_day)::integer))
          AND (target_day+sa.start_time) AT TIME ZONE 'Europe/Paris'<salon_close
          AND (target_day+sa.end_time) AT TIME ZONE 'Europe/Paris'>salon_open;
        IF periods IS NULL OR NOT (periods @> tstzrange(p_start_time,new_end,'[)')) THEN RAISE EXCEPTION 'Votre équipe n’est pas libre pendant toute la durée du soin.'; END IF;
      END IF;
    END LOOP;
    -- The trigger acquires the calendar lock, checks the complete team and rolls
    -- back this transaction on conflict. The old slot is never released first.
    UPDATE public.appointments SET start_time=p_start_time,end_time=new_end,updated_at=clock_timestamp() WHERE id=booking.id RETURNING * INTO booking;
    UPDATE public.appointment_management_links SET expires_at=greatest(expires_at,new_end+interval '7 days') WHERE appointment_id=booking.id AND revoked_at IS NULL;
  END IF;
  after_value:=jsonb_build_object('status',booking.status,'start_time',booking.start_time,'end_time',booking.end_time);
  INSERT INTO public.appointment_client_changes(appointment_id,link_id,request_id,action,before_state,after_state)
    VALUES(booking.id,access_link.id,p_request_id,p_action,before_value,after_value);
  RETURN jsonb_build_object('id',booking.id,'replayed',false);
END $$;

REVOKE ALL ON FUNCTION public.guard_appointment_interval() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_appointment_assignment_interval() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.client_change_appointment(text,uuid,uuid,timestamptz,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.client_change_appointment(text,uuid,uuid,timestamptz,text,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

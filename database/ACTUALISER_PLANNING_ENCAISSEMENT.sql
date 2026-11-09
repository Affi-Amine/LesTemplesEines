-- LES TEMPLES : actualisation incrémentale du planning et de l’encaissement.
-- À exécuter en entier dans le SQL Editor du projet existant.
-- Remplace uniquement deux fonctions serveur ; aucun rendez-vous ni règlement réel n’est créé ou modifié.

-- 1. 20261109030636_salon_planning_staff_access.sql
-- All active authenticated staff share the access already granted by the planning pages.
-- Appointment identity, displayed salon, complete team, duration, versions and journal stay protected.
BEGIN;

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

REVOKE ALL ON FUNCTION public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- 2. 20261109031021_admin_checkout_appointment_atomic.sql
-- Server-only settlement. Amounts are calculated from the locked booking, never trusted from the browser.
-- The appointment's team and schedule are never rewritten, including manually overlapping bookings.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_checkout_appointment_atomic(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_payments jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  booking public.appointments%ROWTYPE;
  line jsonb;
  amount numeric;
  price numeric := 0;
  already_paid bigint;
  due bigint;
  received numeric := 0;
  method_count integer;
  settlement_method text;
  result jsonb;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Encaissement réservé au serveur authentifié.';
  END IF;
  IF p_appointment_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le rendez-vous et sa version sont obligatoires.';
  END IF;
  SELECT * INTO booking FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Rendez-vous introuvable.'; END IF;
  IF booking.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Ce rendez-vous a été modifié. Actualisez le planning avant d’encaisser.';
  END IF;
  IF booking.status IN ('blocked','cancelled','no_show') OR booking.payment_status='paid' THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Ce rendez-vous ne peut pas être encaissé ou est déjà réglé.';
  END IF;
  IF booking.payment_status='pending' AND booking.payment_method='stripe' THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Un paiement en ligne est en cours. Attendez sa confirmation avant d’encaisser.';
  END IF;

  IF booking.service_items IS NOT NULL AND booking.service_items <> 'null'::jsonb THEN
    IF jsonb_typeof(booking.service_items) <> 'array' OR jsonb_array_length(booking.service_items)=0 THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le montant enregistré des prestations est invalide.';
    END IF;
    FOR line IN SELECT value FROM jsonb_array_elements(booking.service_items) LOOP
      IF jsonb_typeof(line) <> 'object' OR jsonb_typeof(line->'price_cents') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le montant enregistré des prestations est invalide.';
      END IF;
      amount := (line->>'price_cents')::numeric;
      IF amount < 0 OR amount <> trunc(amount) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le montant enregistré des prestations est invalide.';
      END IF;
      price := price + amount;
    END LOOP;
  ELSE
    SELECT s.price_cents INTO price FROM public.services s WHERE s.id=booking.service_id;
  END IF;
  IF price IS NULL OR price < 0 OR price <> trunc(price) OR price > 2147483647 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le prix du rendez-vous est indisponible ou invalide.';
  END IF;
  already_paid := COALESCE(booking.amount_paid_cents,0);
  IF already_paid < 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le cumul déjà réglé est invalide.';
  END IF;
  due := price::bigint - already_paid;
  IF due <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Aucun montant ne reste à encaisser sur ce rendez-vous.';
  END IF;
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Renseignez un à vingt règlements valides.';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(p_payments) LOOP
    IF jsonb_typeof(line) <> 'object' OR line - ARRAY['amount_cents','method'] <> '{}'::jsonb OR
       jsonb_typeof(line->'amount_cents') IS DISTINCT FROM 'number' OR jsonb_typeof(line->'method') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Chaque règlement doit contenir un montant en centimes et un moyen de paiement.';
    END IF;
    amount := (line->>'amount_cents')::numeric;
    IF amount <= 0 OR amount <> trunc(amount) OR amount > 2147483647 OR
       line->>'method' NOT IN ('stripe','gift_card','pack','on_site','cash','card','check','other','treatwell','loyalty') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Montant ou moyen de paiement invalide.';
    END IF;
    received := received + amount;
  END LOOP;
  IF received <> due THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le total encaissé doit correspondre exactement au montant restant.';
  END IF;
  SELECT count(DISTINCT method),min(method) INTO method_count,settlement_method FROM (
    SELECT value->>'method' AS method FROM jsonb_array_elements(p_payments)
    UNION ALL SELECT booking.payment_method WHERE already_paid > 0 AND booking.payment_method IS NOT NULL
  ) methods;
  IF method_count > 1 OR (already_paid > 0 AND booking.payment_method IS NULL) THEN settlement_method := 'mixed'; END IF;

  UPDATE public.appointments SET payment_status='paid', payment_method=settlement_method,
    amount_paid_cents=(already_paid+received)::integer, paid_at=COALESCE(paid_at,clock_timestamp()), updated_at=clock_timestamp()
    WHERE id=booking.id RETURNING * INTO booking;
  INSERT INTO public.payments(appointment_id,amount_cents,method)
    SELECT booking.id,(value->>'amount_cents')::numeric::integer,value->>'method' FROM jsonb_array_elements(p_payments);

  SELECT to_jsonb(booking) || jsonb_build_object(
    'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('staff_id',a.staff_id,'staff',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name))) FROM public.appointment_assignments a JOIN public.staff s ON s.id=a.staff_id WHERE a.appointment_id=booking.id),'[]'::jsonb),
    'staff',(SELECT jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'role',s.role,'phone',s.phone) FROM public.staff s WHERE s.id=booking.staff_id),
    'client',(SELECT to_jsonb(c) FROM public.clients c WHERE c.id=booking.client_id),
    'service',(SELECT to_jsonb(s) FROM public.services s WHERE s.id=booking.service_id),
    'salon',(SELECT jsonb_build_object('id',s.id,'name',s.name,'city',s.city,'address',s.address) FROM public.salons s WHERE s.id=booking.salon_id)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_checkout_appointment_atomic(uuid,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_checkout_appointment_atomic(uuid,timestamptz,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Contrôles en lecture seule : toutes les lignes doivent afficher ok = true.
WITH functions AS (
  SELECT to_regprocedure('public.salon_drag_appointment_atomic(uuid,uuid,timestamptz,timestamptz,uuid[],uuid,uuid)') AS move_oid,
         to_regprocedure('public.admin_checkout_appointment_atomic(uuid,timestamptz,jsonb)') AS checkout_oid
), definitions AS (
  SELECT *, COALESCE(pg_get_functiondef(move_oid), '') AS move_definition,
            COALESCE(pg_get_functiondef(checkout_oid), '') AS checkout_definition
  FROM functions
)
SELECT 'Déplacement au lâcher : fonction installée' AS controle, move_oid IS NOT NULL AS ok FROM definitions
UNION ALL
SELECT 'Encaissement atomique : fonction installée', checkout_oid IS NOT NULL FROM definitions
UNION ALL
SELECT 'Déplacement : exécution réservée au serveur',
       COALESCE(has_function_privilege('service_role', move_oid, 'EXECUTE'), false)
       AND NOT COALESCE(has_function_privilege('anon', move_oid, 'EXECUTE'), true)
       AND NOT COALESCE(has_function_privilege('authenticated', move_oid, 'EXECUTE'), true)
       AND COALESCE((SELECT NOT prosecdef FROM pg_catalog.pg_proc WHERE oid=move_oid), false)
FROM definitions
UNION ALL
SELECT 'Encaissement : exécution réservée au serveur',
       COALESCE(has_function_privilege('service_role', checkout_oid, 'EXECUTE'), false)
       AND NOT COALESCE(has_function_privilege('anon', checkout_oid, 'EXECUTE'), true)
       AND NOT COALESCE(has_function_privilege('authenticated', checkout_oid, 'EXECUTE'), true)
       AND COALESCE((SELECT NOT prosecdef FROM pg_catalog.pg_proc WHERE oid=checkout_oid), false)
FROM definitions
UNION ALL
SELECT 'Déplacement : tous les comptes staff actifs, sans restriction de rôle ou affectation',
       position('IF NOT FOUND OR actor.is_active IS DISTINCT FROM true THEN' IN move_definition)>0
       AND position('actor.role NOT IN' IN move_definition)=0
       AND position('actor.salon_id IS DISTINCT FROM p_salon_id' IN move_definition)=0
FROM definitions
UNION ALL
SELECT 'Déplacement : rendez-vous et équipe restent dans le salon affiché',
       position('booking.salon_id IS DISTINCT FROM p_salon_id' IN move_definition)>0
       AND position('s.salon_id=p_salon_id' IN move_definition)>0
FROM definitions
UNION ALL
SELECT 'Protections anti-chevauchement toujours actives',
       EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
         WHERE tgrelid=to_regclass('public.appointments') AND tgname='guard_appointment_interval'
           AND tgfoid=to_regprocedure('public.guard_appointment_interval()') AND tgenabled IN ('O','A'))
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
         WHERE tgrelid=to_regclass('public.appointment_assignments') AND tgname='guard_appointment_assignment_interval'
           AND tgfoid=to_regprocedure('public.guard_appointment_assignment_interval()') AND tgenabled IN ('O','A'))
UNION ALL
SELECT 'Encaissement : verrou, version et registre des règlements, sans réécriture de l’équipe',
       position('FOR UPDATE' IN checkout_definition)>0
       AND position('booking.updated_at IS DISTINCT FROM p_expected_updated_at' IN checkout_definition)>0
       AND position('INSERT INTO public.payments' IN checkout_definition)>0
       AND position('DELETE FROM public.appointment_assignments' IN checkout_definition)=0
       AND position('INSERT INTO public.appointment_assignments' IN checkout_definition)=0
       AND position('UPDATE public.appointment_assignments' IN checkout_definition)=0
FROM definitions;

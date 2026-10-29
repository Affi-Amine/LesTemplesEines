-- Called only by the authenticated admin API with the service-role client.
-- One transaction replaces the team and time, avoiding conflicts at the OLD time.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointments'::regclass AND tgname='guard_appointment_interval' AND tgenabled<>'D') OR
     NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.appointment_assignments'::regclass AND tgname='guard_appointment_assignment_interval' AND tgenabled<>'D') THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='Installez d’abord 2026-10-25_client_appointment_management.sql : les protections anti-chevauchement sont obligatoires.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reschedule_appointment_atomic(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_updates jsonb,
  p_staff_ids uuid[],
  p_payments jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE booking public.appointments%ROWTYPE; candidate public.appointments%ROWTYPE;
  members uuid[]; result jsonb;
BEGIN
  IF p_updates IS NULL OR pg_catalog.jsonb_typeof(p_updates) <> 'object' OR
    p_updates - ARRAY['updated_at','start_time','end_time','staff_id','salon_id','service_id','service_items','status','client_notes','internal_notes','payment_status','payment_method','amount_paid_cents','paid_at'] <> '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Champs de modification invalides.';
  END IF;
  IF p_staff_ids IS NULL OR pg_catalog.cardinality(p_staff_ids)=0 OR array_position(p_staff_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Une équipe complète est obligatoire.';
  END IF;
  SELECT array_agg(member ORDER BY first_position) INTO members FROM (
    SELECT member, min(position) AS first_position FROM unnest(p_staff_ids) WITH ORDINALITY AS team(member,position) GROUP BY member
  ) normalized;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-calendar-write',0));
  SELECT * INTO booking FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Rendez-vous introuvable.'; END IF;
  IF booking.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Ce rendez-vous a été modifié. Actualisez le planning avant de réessayer.';
  END IF;
  candidate := pg_catalog.jsonb_populate_record(booking,p_updates);
  IF candidate.end_time<=candidate.start_time THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La durée du rendez-vous est invalide.';
  END IF;
  -- Existing interval triggers see the final primary practitioner and final time.
  -- Any failure below rolls back these deletes, the booking and all new assignments.
  DELETE FROM public.appointment_assignments WHERE appointment_id=booking.id;
  UPDATE public.appointments SET
    start_time=candidate.start_time, end_time=candidate.end_time, staff_id=members[1],
    salon_id=candidate.salon_id, service_id=candidate.service_id, service_items=candidate.service_items,
    status=candidate.status, client_notes=candidate.client_notes, internal_notes=candidate.internal_notes,
    payment_status=candidate.payment_status, payment_method=candidate.payment_method,
    amount_paid_cents=candidate.amount_paid_cents, paid_at=candidate.paid_at, updated_at=clock_timestamp()
  WHERE id=booking.id RETURNING * INTO booking;
  INSERT INTO public.appointment_assignments(appointment_id,staff_id)
    SELECT booking.id,member FROM unnest(members) AS member;
  INSERT INTO public.payments(appointment_id,amount_cents,method)
    SELECT booking.id,p.amount_cents,p.method FROM pg_catalog.jsonb_to_recordset(COALESCE(p_payments,'[]'::jsonb)) AS p(amount_cents integer,method text);
  SELECT pg_catalog.to_jsonb(booking) || pg_catalog.jsonb_build_object(
    'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('staff_id',a.staff_id,'staff',jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name))) FROM public.appointment_assignments a JOIN public.staff s ON s.id=a.staff_id WHERE a.appointment_id=booking.id),'[]'::jsonb),
    'staff',(SELECT jsonb_build_object('id',s.id,'first_name',s.first_name,'last_name',s.last_name,'role',s.role,'phone',s.phone) FROM public.staff s WHERE s.id=booking.staff_id),
    'client',(SELECT to_jsonb(c) FROM public.clients c WHERE c.id=booking.client_id),
    'service',(SELECT to_jsonb(s) FROM public.services s WHERE s.id=booking.service_id),
    'salon',(SELECT jsonb_build_object('id',s.id,'name',s.name,'city',s.city,'address',s.address) FROM public.salons s WHERE s.id=booking.salon_id)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_reschedule_appointment_atomic(uuid,timestamptz,jsonb,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reschedule_appointment_atomic(uuid,timestamptz,jsonb,uuid[],jsonb) TO service_role;

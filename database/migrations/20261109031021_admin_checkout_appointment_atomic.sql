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

-- Apply before enabling multiple services in the booking templates.
-- Existing bookings and single-service inserts remain unchanged.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_items jsonb;

COMMENT ON COLUMN public.appointments.service_items IS
  'Server-validated ordered service snapshots: id, name, duration_minutes, price_cents, required_staff_count.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_service_items_array'
  ) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_service_items_array
      CHECK (service_items IS NULL OR
        (jsonb_typeof(service_items) = 'array' AND jsonb_array_length(service_items) BETWEEN 1 AND 8));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

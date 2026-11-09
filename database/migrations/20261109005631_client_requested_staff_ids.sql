-- A chosen practitioner is different from the staff eventually assigned to a booking.
-- Historical bookings remain unknown (empty): no preference is inferred or backfilled.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_requested_staff_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.appointments.client_requested_staff_ids IS
  'Original practitioners explicitly chosen by the client; empty for automatic assignment or unknown historical choice. Preserved when the appointment is moved.';

NOTIFY pgrst, 'reload schema';

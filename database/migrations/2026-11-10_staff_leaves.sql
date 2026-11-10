-- Congés des masseuses ("staff leaves").
--
-- A leave covers whole Paris calendar days [start_date, end_date] inclusive.
-- While a staff member is on leave she takes no booking: the availability
-- APIs hide her slots and every booking/reschedule path refuses the slot
-- (lib/staff/leaves.ts + assertStaffAvailable). Managed from the back office
-- (Administration > Équipe > Congés).

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  -- Staff email of the back-office account that recorded the leave.
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_leaves_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS staff_leaves_staff_idx
  ON public.staff_leaves (staff_id, start_date, end_date);

REVOKE ALL ON public.staff_leaves FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_leaves TO service_role;

COMMIT;

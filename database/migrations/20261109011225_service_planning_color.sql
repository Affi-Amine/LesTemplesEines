-- Optional catalogue-only markers. Appointment quotes and payment amounts are unchanged.
BEGIN;
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

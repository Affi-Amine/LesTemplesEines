-- Colour chosen per prestation, shown on the planning cards and used to filter it.
-- Constrained to the agenda palette (app/appointment-colors.css): every tone there
-- is contrast-checked against its text, which a free hex value would not be.
-- A prestation without a colour keeps the one derived from its id.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS color VARCHAR(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.services'::regclass
      AND conname = 'services_color_palette'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_color_palette
      CHECK (color IS NULL OR color IN ('sky', 'green', 'amber', 'violet', 'teal', 'rose', 'lime', 'blue'));
  END IF;
END $$;

COMMENT ON COLUMN public.services.color IS
  'Agenda tone for this prestation (sky|green|amber|violet|teal|rose|lime|blue); NULL = derived from the id.';

NOTIFY pgrst, 'reload schema';

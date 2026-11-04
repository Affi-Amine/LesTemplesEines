-- Daily cash sheet ("feuille de caisse journalière"), see docs/feuille-de-caisse.md.
--
-- A closure freezes one salon's day: the lines and totals are copied into
-- `sheet` at closing time and the PDF is always rendered from that copy, so
-- later edits to the appointments never change a signed sheet.

BEGIN;

-- One row per salon. Automatic closing is off until an admin turns it on.
CREATE TABLE IF NOT EXISTS public.cash_sheet_settings (
  salon_id UUID PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  auto_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Paris time, HH:MM. Before 05:00 means "close the previous day".
  send_time VARCHAR(5) NOT NULL DEFAULT '23:00' CHECK (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  signer_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_sheet_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  sheet_date DATE NOT NULL,
  reference TEXT NOT NULL,
  signer_name TEXT NOT NULL DEFAULT '',
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Staff email for a manual closure, 'auto' for the scheduled one.
  closed_by TEXT,
  sheet JSONB NOT NULL,
  sent_to TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  UNIQUE (salon_id, sheet_date)
);

CREATE INDEX IF NOT EXISTS cash_sheet_closures_date_idx ON public.cash_sheet_closures (sheet_date DESC);

REVOKE ALL ON public.cash_sheet_settings, public.cash_sheet_closures FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sheet_settings, public.cash_sheet_closures TO service_role;

COMMIT;

-- Back-office management of the Planity / Treatwell synchronisation
-- (/admin/synchronisation). Requires 2026-10-30_platform_sync.sql.
--
-- Planity logins typed in the back office are kept here, encrypted like the
-- sessions (lib/sync/secret-box.ts), so the salon can change its Planity
-- password without a redeploy. The PLANITY_USERNAME / PLANITY_PASSWORD
-- variables stay as a fallback when no row exists.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_credentials (
  platform VARCHAR(20) PRIMARY KEY CHECK (platform IN ('planity', 'treatwell')),
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Who triggered a run from the back office (NULL for the cron).
ALTER TABLE public.platform_sync_runs
  ADD COLUMN IF NOT EXISTS triggered_by TEXT;

REVOKE ALL ON public.platform_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_credentials TO service_role;

COMMIT;

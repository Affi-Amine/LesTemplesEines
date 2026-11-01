-- Planity / Treatwell synchronisation
--
-- Neither platform has a public API. lib/sync talks to the same endpoints their
-- own web apps use (reverse-engineered from network traffic) and mirrors every
-- booking across the three agendas. This migration holds the bookkeeping that
-- makes the job idempotent and lets it tell "who changed what" between runs.
--
-- Run it before deploying the sync code.

BEGIN;

-- Where a booking was first made. The sync never pushes a booking back to the
-- platform it came from.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'site';

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_source_check CHECK (source IN ('site', 'planity', 'treatwell'));

-- One row per (appointment, platform). `snapshot` is the state both sides last
-- agreed on ({start, end, status, staff}); each run compares the local and the
-- remote booking against it, so a change is applied in the direction it was
-- made and the job's own writes never bounce back. NULL while a push is in
-- flight: a crash between "row reserved" and "remote write" leaves a row the
-- next run can recognise instead of a duplicate booking.
CREATE TABLE IF NOT EXISTS public.appointment_platform_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('planity', 'treatwell')),
  external_id TEXT NOT NULL,
  external_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB,
  origin VARCHAR(20) NOT NULL CHECK (origin IN ('pulled', 'pushed', 'matched')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, external_id),
  UNIQUE (appointment_id, platform)
);

-- Manual overrides for the automatic name matching (salon <-> business,
-- staff <-> agenda column, service <-> service). external_id NULL means "never
-- sync this one". external_venue_id is the platform business the staff or
-- service belongs to; for salons it repeats external_id.
CREATE TABLE IF NOT EXISTS public.platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('planity', 'treatwell')),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('salon', 'staff', 'service')),
  local_id UUID NOT NULL,
  external_id TEXT,
  external_venue_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, kind, local_id, external_venue_id)
);

-- Platform sessions (Planity refresh token, Treatwell cookies), encrypted with
-- a key derived from PLATFORM_SYNC_SECRET (lib/sync/secret-box.ts).
CREATE TABLE IF NOT EXISTS public.platform_sessions (
  platform VARCHAR(20) PRIMARY KEY CHECK (platform IN ('planity', 'treatwell')),
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per run, with the full report. Also serves as the run lock.
CREATE TABLE IF NOT EXISTS public.platform_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('dry-run', 'live')),
  status VARCHAR(10) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  report JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS platform_sync_runs_started_idx ON public.platform_sync_runs (started_at DESC);

-- Server only: the API reaches these tables with the service role; the browser
-- roles get nothing (platform_sessions holds platform logins).
REVOKE ALL ON
  public.appointment_platform_links,
  public.platform_mappings,
  public.platform_sessions,
  public.platform_sync_runs
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.appointment_platform_links,
  public.platform_mappings,
  public.platform_sessions,
  public.platform_sync_runs
TO service_role;

COMMIT;

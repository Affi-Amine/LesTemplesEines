import type { createAdminClient } from "@/lib/supabase/admin"
import { loadCredentials, type CredentialsSource } from "@/lib/sync/credentials"
import type { PlatformReport, SyncMode, SyncReport } from "@/lib/sync/engine"
import { resolveMapping, staffLabel, type PlatformMapping } from "@/lib/sync/mappings"
import { createPlanityAdapter } from "@/lib/sync/planity"
import { describeSession, loadSession } from "@/lib/sync/sessions"
import { createTreatwellAdapter, type TreatwellSession } from "@/lib/sync/treatwell"
import { describeTreatwellSession } from "@/lib/sync/treatwell-session"
import type { ExternalVenue, Platform, PlatformAdapter } from "@/lib/sync/types"

// Read models for the back-office page (/admin/synchronisation). Everything
// here is server-side: credentials and cookie values never leave the server,
// only their presence and dates do.

type SupabaseClient = ReturnType<typeof createAdminClient>

export const PLATFORMS: Platform[] = ["planity", "treatwell"]

export interface PlatformStatus {
  credentials: { source: CredentialsSource; username: string | null; updatedAt: string | null }
  session: { updatedAt: string | null; readable: boolean; cookies?: number; expiresAt?: string | null; expired?: boolean; venueId?: string | null }
  /** From the last finished run that covered this platform. */
  lastRun: { at: string; status: PlatformReport["status"]; message?: string; counts?: PlatformReport["counts"]; warnings: number } | null
}

export interface RunSummary {
  id: string
  mode: SyncMode
  status: "running" | "done" | "failed"
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  triggeredBy: string | null
  error: string | null
  platforms: Partial<Record<Platform, { status: PlatformReport["status"]; message?: string; counts: PlatformReport["counts"]; warnings: number }>>
}

export interface SyncStatus {
  mode: SyncMode
  windowDays: number
  cronConfigured: boolean
  secretSource: "dedicated" | "jwt" | "none"
  migrations: { base: boolean; admin: boolean }
  platforms: Record<Platform, PlatformStatus>
  runs: RunSummary[]
}

export function createAdapter(supabase: SupabaseClient, platform: Platform): PlatformAdapter {
  return platform === "planity" ? createPlanityAdapter(supabase) : createTreatwellAdapter(supabase)
}

export function currentMode(): SyncMode {
  return process.env.PLATFORM_SYNC_MODE === "live" ? "live" : "dry-run"
}

function maskUsername(username: string | null | undefined) {
  if (!username) return null
  const [local, domain] = username.split("@")
  if (!domain) return `${local.slice(0, 2)}…`
  return `${local.slice(0, 2)}…@${domain}`
}

function summariseRun(row: {
  id: string
  mode: SyncMode
  status: RunSummary["status"]
  started_at: string
  finished_at: string | null
  triggered_by?: string | null
  error: string | null
  report: SyncReport | null
}): RunSummary {
  const platforms: RunSummary["platforms"] = {}
  for (const [platform, report] of Object.entries(row.report?.platforms || {})) {
    if (!report) continue
    platforms[platform as Platform] = { status: report.status, message: report.message, counts: report.counts, warnings: report.warnings.length }
  }
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.report?.durationMs ?? (row.finished_at ? Date.parse(row.finished_at) - Date.parse(row.started_at) : null),
    triggeredBy: row.triggered_by ?? null,
    error: row.error,
    platforms,
  }
}

export async function getSyncStatus(supabase: SupabaseClient): Promise<SyncStatus> {
  type RunRow = Parameters<typeof summariseRun>[0]
  const columns = "id, mode, status, started_at, finished_at, error, report"
  const order = { ascending: false }
  let migrations = { base: true, admin: true }
  const first = await supabase.from("platform_sync_runs").select(`${columns}, triggered_by`).order("started_at", order).limit(20)
  let error = first.error
  let rows = (first.data || []) as RunRow[]
  if (error && /triggered_by/.test(error.message)) {
    // Base tables present, admin migration not applied yet.
    migrations = { base: true, admin: false }
    const retry = await supabase.from("platform_sync_runs").select(columns).order("started_at", order).limit(20)
    error = retry.error
    rows = (retry.data || []) as RunRow[]
  }
  if (error) migrations = { base: false, admin: false }
  else if (migrations.admin) {
    const probe = await supabase.from("platform_credentials").select("platform").limit(1)
    migrations.admin = !probe.error
  }
  const runs = rows.map(summariseRun)

  const platforms = {} as Record<Platform, PlatformStatus>
  for (const platform of PLATFORMS) {
    const [credentials, session] = await Promise.all([
      loadCredentials(supabase, platform),
      migrations.base ? describeSession(supabase, platform) : Promise.resolve({ updatedAt: null, readable: false }),
    ])
    const status: PlatformStatus = {
      credentials: { source: credentials.source, username: maskUsername(credentials.credentials?.username), updatedAt: credentials.updatedAt },
      session,
      lastRun: null,
    }
    if (platform === "treatwell" && session.readable) {
      status.session = { ...session, ...describeTreatwellSession(await loadSession<TreatwellSession>(supabase, "treatwell")) }
    }
    const last = runs.find((run) => run.status !== "running" && run.platforms[platform])
    if (last) {
      const report = last.platforms[platform]!
      status.lastRun = { at: last.finishedAt || last.startedAt, status: report.status, message: report.message, counts: report.counts, warnings: report.warnings }
    }
    platforms[platform] = status
  }

  return {
    mode: currentMode(),
    windowDays: Number(process.env.PLATFORM_SYNC_DAYS) || 60,
    cronConfigured: Boolean(process.env.CRON_SECRET),
    secretSource: process.env.PLATFORM_SYNC_SECRET ? "dedicated" : process.env.JWT_SECRET ? "jwt" : "none",
    migrations,
    platforms,
    runs,
  }
}

export interface ConnectionTest {
  platform: Platform
  venues: { id: string; name: string; staff: { id: string; name: string }[]; services: number }[]
  mapping: PlatformMapping["summary"]
}

/** Signs in (or reuses the session), lists the platform's venues and shows how they pair with the site. */
export async function testConnection(supabase: SupabaseClient, platform: Platform): Promise<ConnectionTest> {
  const adapter = createAdapter(supabase, platform)
  const venues = await adapter.listVenues()
  const mapping = await resolveMapping(supabase, platform, venues)
  return {
    platform,
    venues: venues.map((venue) => ({ id: venue.id, name: venue.name, staff: venue.staff, services: venue.services.length })),
    mapping: mapping.summary,
  }
}

export interface MappingOverview {
  platform: Platform
  venues: ExternalVenue[] | null
  venuesError: string | null
  salons: { id: string; name: string }[]
  staff: { id: string; salon_id: string; label: string }[]
  services: { id: string; name: string; duration_minutes: number }[]
  overrides: { id: string; kind: "salon" | "staff" | "service"; local_id: string; external_id: string | null; external_venue_id: string }[]
  summary: PlatformMapping["summary"] | null
}

export async function getMappingOverview(supabase: SupabaseClient, platform: Platform): Promise<MappingOverview> {
  const [salons, staff, services, overrides] = await Promise.all([
    supabase.from("salons").select("id, name").eq("is_active", true).order("name"),
    supabase.from("staff").select("id, salon_id, first_name, last_name").eq("is_active", true).order("last_name"),
    supabase.from("services").select("id, name, duration_minutes").eq("is_active", true).order("name"),
    supabase.from("platform_mappings").select("id, kind, local_id, external_id, external_venue_id").eq("platform", platform).order("created_at"),
  ])
  for (const result of [salons, staff, services, overrides]) if (result.error) throw new Error(result.error.message)

  let venues: ExternalVenue[] | null = null
  let venuesError: string | null = null
  let summary: PlatformMapping["summary"] | null = null
  try {
    venues = await createAdapter(supabase, platform).listVenues()
    summary = (await resolveMapping(supabase, platform, venues)).summary
  } catch (error) {
    venuesError = error instanceof Error ? error.message : String(error)
  }

  return {
    platform,
    venues,
    venuesError,
    salons: (salons.data || []).map((s) => ({ id: s.id, name: s.name.trim() })),
    staff: (staff.data || []).map((s) => ({ id: s.id, salon_id: s.salon_id, label: staffLabel(s) || `${s.first_name || ""} ${s.last_name || ""}`.trim() })),
    services: services.data || [],
    overrides: (overrides.data || []) as MappingOverview["overrides"],
    summary,
  }
}

import { after } from "next/server"
import { formatInTimeZone } from "date-fns-tz"

import { createAdapter, currentMode } from "@/lib/sync/admin"
import { runPlatformSync } from "@/lib/sync/engine"
import type { createAdminClient } from "@/lib/supabase/admin"
import type { Platform } from "@/lib/sync/types"

// Immediate synchronisation after a booking changes on the site, so a new,
// moved or cancelled appointment reaches Planity / Treatwell within seconds
// instead of at the next cron run. The work happens after the HTTP response
// (next/server `after`), restricted to the day(s) the booking touches, and
// goes through the same engine as the cron: the run shows in the back-office
// history with `triggered_by = event:<reason>`. The cron remains the safety
// net: when a run is already in progress the event retries a few times, then
// leaves the booking to the next scheduled pass.

const TIMEZONE = "Europe/Paris"
const RETRY_DELAYS_MS = [5_000, 20_000, 45_000]

type SupabaseClient = ReturnType<typeof createAdminClient>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function eventMode() {
  if (currentMode() === "live") return "live" as const
  // Lets a staging deployment show event runs in the history without writing anything.
  return process.env.PLATFORM_SYNC_EVENT_DRY_RUN === "1" ? ("dry-run" as const) : null
}

/**
 * Queues a sync of the Paris day(s) the given instants fall on. Pass both the
 * old and the new start time of a moved booking so both days are reconciled.
 */
export function syncAfterBookingChange(reason: string, ...instants: (string | null | undefined)[]) {
  const mode = eventMode()
  if (!mode) return
  const days = instants
    .filter((value): value is string => Boolean(value) && !Number.isNaN(Date.parse(value as string)))
    .map((value) => formatInTimeZone(new Date(value), TIMEZONE, "yyyy-MM-dd"))
    .sort()
  if (!days.length) return
  const window = { from: days[0], to: days[days.length - 1] }

  try {
    after(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const report = await runPlatformSync({ mode, window, triggeredBy: `event:${reason}` })
          if (!("skipped" in report)) {
            console.log("[sync/trigger] Done", { reason, window, durationMs: report.durationMs })
            return
          }
          if (attempt >= RETRY_DELAYS_MS.length) {
            console.log("[sync/trigger] Left to the next scheduled run", { reason, window })
            return
          }
          await sleep(RETRY_DELAYS_MS[attempt])
        } catch (error) {
          console.error("[sync/trigger] Failed", { reason, window }, error)
          return
        }
      }
    })
  } catch (error) {
    // Outside a request scope (scripts, tests): nothing to defer to.
    console.warn("[sync/trigger] Not scheduled", { reason }, error instanceof Error ? error.message : error)
  }
}

export interface RemoteCopy {
  platform: Platform
  external_ref: Record<string, unknown>
}

/** The platform copies of a booking, to read before the row (and its links) is deleted. */
export async function loadRemoteCopies(supabase: SupabaseClient, appointmentId: string): Promise<RemoteCopy[]> {
  const { data, error } = await supabase
    .from("appointment_platform_links")
    .select("platform, external_ref, snapshot")
    .eq("appointment_id", appointmentId)
  if (error) return []
  return (data || []).filter((row) => row.snapshot).map((row) => ({ platform: row.platform as Platform, external_ref: row.external_ref || {} }))
}

/**
 * A deleted booking takes its links with it (ON DELETE CASCADE), so the engine
 * would never learn it is gone and would re-import the platform copy. Cancel
 * those copies directly instead.
 */
export function cancelRemoteCopiesAfterDelete(supabase: SupabaseClient, appointmentId: string, copies: RemoteCopy[]) {
  if (currentMode() !== "live" || !copies.length) return
  try {
    after(async () => {
      for (const copy of copies) {
        try {
          await createAdapter(supabase, copy.platform).cancelBooking(copy.external_ref)
          console.log("[sync/trigger] Remote copy cancelled after delete", { appointmentId, platform: copy.platform })
        } catch (error) {
          console.error("[sync/trigger] Remote copy not cancelled after delete", { appointmentId, platform: copy.platform }, error)
        }
      }
    })
  } catch (error) {
    console.warn("[sync/trigger] Not scheduled", { appointmentId }, error instanceof Error ? error.message : error)
  }
}

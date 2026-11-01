export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// A first live run can create a large backlog; later runs touch a handful of bookings.
export const maxDuration = 300

import { type NextRequest, NextResponse } from "next/server"

import { isCronAuthorised } from "@/lib/auth/cron"
import { runPlatformSync, type SyncMode } from "@/lib/sync/engine"
import type { Platform } from "@/lib/sync/types"

/**
 * Planity / Treatwell synchronisation (lib/sync/engine.ts).
 *
 * Writes only happen when PLATFORM_SYNC_MODE=live; otherwise every run is a
 * dry run that reports what it would do. `?mode=dry-run` forces a dry run even
 * when live, `?platform=planity` limits the run to one platform.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const mode: SyncMode = process.env.PLATFORM_SYNC_MODE === "live" && params.get("mode") !== "dry-run" ? "live" : "dry-run"
  const requested = params.get("platform")
  const platforms = requested === "planity" || requested === "treatwell" ? [requested as Platform] : undefined

  try {
    const report = await runPlatformSync({ mode, platforms })
    if ("skipped" in report) return NextResponse.json(report, { status: 409 })

    const summary = Object.fromEntries(
      Object.entries(report.platforms).map(([platform, r]) => [platform, { status: r?.status, message: r?.message, counts: r?.counts, warnings: r?.warnings.length }])
    )
    console.log("[cron/platform-sync] Run complete", { mode, durationMs: report.durationMs, ...summary })
    return NextResponse.json(report)
  } catch (error) {
    console.error("[cron/platform-sync] Run failed", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronisation impossible" }, { status: 500 })
  }
}

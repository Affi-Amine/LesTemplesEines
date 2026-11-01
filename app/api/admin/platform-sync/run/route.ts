export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { currentMode } from "@/lib/sync/admin"
import { runPlatformSync } from "@/lib/sync/engine"

const Body = z.object({
  mode: z.enum(["dry-run", "live"]).default("dry-run"),
  platform: z.enum(["planity", "treatwell"]).optional(),
})

/**
 * Runs the sync now, like the cron does. A live run is only possible when the
 * deployment itself is live (PLATFORM_SYNC_MODE=live): the back office cannot
 * switch writes on by itself.
 */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  const { mode, platform } = parsed.data
  if (mode === "live" && currentMode() !== "live") {
    return NextResponse.json({ error: "Le déploiement est en mode simulation (PLATFORM_SYNC_MODE) : une exécution réelle n'est pas possible d'ici." }, { status: 409 })
  }

  try {
    const report = await runPlatformSync({ mode, platforms: platform ? [platform] : undefined, triggeredBy: auth.payload.email })
    if ("skipped" in report) return NextResponse.json(report, { status: 409 })
    console.log("[admin/platform-sync] Manual run", { mode, platform, by: auth.payload.email, durationMs: report.durationMs })
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronisation impossible" }, { status: 500 })
  }
}

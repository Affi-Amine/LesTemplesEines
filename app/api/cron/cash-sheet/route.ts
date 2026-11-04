export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

import { type NextRequest, NextResponse } from "next/server"

import { isCronAuthorised } from "@/lib/auth/cron"
import { runScheduledClosures } from "@/lib/cash-sheet/close"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Closes and emails the daily cash sheet of every salon whose automatic
 * closing is on and whose closing time has passed (lib/cash-sheet/close.ts).
 * Scheduled every 15 minutes in vercel.json; harmless when nothing is due.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const results = await runScheduledClosures(createAdminClient())
    if (results.length) console.log("[cron/cash-sheet]", results)
    return NextResponse.json({ closed: results })
  } catch (error) {
    console.error("[cron/cash-sheet] Run failed", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clôture impossible" }, { status: 500 })
  }
}

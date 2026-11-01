export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAdapter } from "@/lib/sync/admin"
import { clearSession, saveSession } from "@/lib/sync/sessions"
import { describeTreatwellSession, parseTreatwellSessionInput } from "@/lib/sync/treatwell-session"
import { PlatformUnavailableError } from "@/lib/sync/types"

const Body = z.object({
  platform: z.enum(["planity", "treatwell"]),
  /** Treatwell only: the session as exported from a browser (see lib/sync/treatwell-session.ts). */
  input: z.string().max(200_000).optional(),
})

/**
 * Planity: signs in again with the stored login and replaces the session.
 * Treatwell: stores the pasted browser session, then checks it by listing the venues.
 */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  const { platform, input } = parsed.data
  const supabase = createAdminClient()

  try {
    if (platform === "planity") {
      await clearSession(supabase, platform)
      await createAdapter(supabase, platform).login!()
      console.log("[admin/platform-sync] Planity session renewed", { by: auth.payload.email })
      return NextResponse.json({ ok: true })
    }

    const session = parseTreatwellSessionInput(input || "", request.headers.get("user-agent") || undefined)
    await saveSession(supabase, platform, session)
    try {
      const venues = await createAdapter(supabase, platform).listVenues()
      console.log("[admin/platform-sync] Treatwell session imported", { by: auth.payload.email, venues: venues.length })
      return NextResponse.json({ ok: true, session: describeTreatwellSession(session), venues: venues.map((v) => v.name) })
    } catch (error) {
      // Keep nothing that does not work: the next run would only fail with it.
      await clearSession(supabase, platform)
      throw error
    }
  } catch (error) {
    const status = error instanceof PlatformUnavailableError ? 502 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : "Session refusée" }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.pick({ platform: true }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Plateforme requise" }, { status: 400 })
  try {
    await clearSession(createAdminClient(), parsed.data.platform)
    console.log("[admin/platform-sync] Session cleared", { platform: parsed.data.platform, by: auth.payload.email })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression impossible" }, { status: 500 })
  }
}

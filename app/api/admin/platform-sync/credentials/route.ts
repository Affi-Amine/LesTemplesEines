export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAdapter } from "@/lib/sync/admin"
import { clearCredentials, saveCredentials } from "@/lib/sync/credentials"
import { clearSession } from "@/lib/sync/sessions"
import { PLATFORM_LABELS } from "@/lib/sync/types"

const Body = z.object({
  platform: z.enum(["planity", "treatwell"]),
  username: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(500),
})

/** Stores a platform login (encrypted) and signs in with it right away so a typo shows up here, not in the night's run. */
export async function PUT(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Identifiant et mot de passe requis" }, { status: 400 })
  const { platform, username, password } = parsed.data
  if (platform !== "planity") {
    return NextResponse.json({ error: `${PLATFORM_LABELS[platform]} ne permet pas de connexion automatique : importez une session depuis le navigateur.` }, { status: 400 })
  }

  const supabase = createAdminClient()
  try {
    await saveCredentials(supabase, platform, { username, password })
    await clearSession(supabase, platform)
    await createAdapter(supabase, platform).login?.()
    console.log("[admin/platform-sync] Credentials updated", { platform, by: auth.payload.email })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connexion impossible" }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.pick({ platform: true }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Plateforme requise" }, { status: 400 })
  const supabase = createAdminClient()
  try {
    await clearCredentials(supabase, parsed.data.platform)
    await clearSession(supabase, parsed.data.platform)
    console.log("[admin/platform-sync] Credentials removed", { platform: parsed.data.platform, by: auth.payload.email })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suppression impossible" }, { status: 500 })
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { listCashSheetSettings, saveCashSheetSettings } from "@/lib/cash-sheet/settings"
import { createAdminClient } from "@/lib/supabase/admin"

const Body = z.object({
  salon_id: z.string().uuid(),
  auto_enabled: z.boolean(),
  send_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:MM"),
  recipients: z.array(z.string().trim().email()).max(20),
  signer_name: z.string().trim().max(120),
})

/** Per-salon closing settings, for every active salon. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager"])
  if ("response" in auth) return auth.response
  try {
    return NextResponse.json({ salons: await listCashSheetSettings(createAdminClient()), emailEnabled: Boolean(process.env.RESEND_API_KEY), cronConfigured: Boolean(process.env.CRON_SECRET) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paramètres indisponibles" }, { status: 500 })
  }
}

/** Admin only: turning automatic closing on means signed sheets go out without anyone looking. */
export async function PUT(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Paramètres invalides" }, { status: 400 })
  try {
    await saveCashSheetSettings(createAdminClient(), parsed.data)
    console.log("[admin/cash-sheet] Settings saved", { ...parsed.data, by: auth.payload.email })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Enregistrement impossible" }, { status: 500 })
  }
}

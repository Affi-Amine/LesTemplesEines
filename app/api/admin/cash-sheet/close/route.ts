export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { closeCashSheet, getClosure, sendCashSheet } from "@/lib/cash-sheet/close"
import { createAdminClient } from "@/lib/supabase/admin"

const Body = z.object({
  salon_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signer_name: z.string().trim().max(120).default(""),
  send: z.boolean().default(false),
})

/** Freezes the day and, on request, emails the PDF. */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  const { salon_id, date, signer_name, send } = parsed.data
  try {
    const result = await closeCashSheet(createAdminClient(), { salonId: salon_id, date, signerName: signer_name, closedBy: auth.payload.email, send })
    console.log("[admin/cash-sheet] Closed", { salon_id, date, by: auth.payload.email, sent: result.sent })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clôture impossible"
    return NextResponse.json({ error: message }, { status: /déjà clôturée/.test(message) ? 409 : 500 })
  }
}

/** Sends (again) the PDF of an already closed day. */
export async function PUT(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager"])
  if ("response" in auth) return auth.response
  const parsed = Body.pick({ salon_id: true, date: true }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  try {
    const supabase = createAdminClient()
    const closed = await getClosure(supabase, parsed.data.salon_id, parsed.data.date)
    if (!closed) return NextResponse.json({ error: "Cette journée n'est pas clôturée : clôturez-la d'abord." }, { status: 409 })
    const sent = await sendCashSheet(supabase, closed.closure, closed.sheet)
    console.log("[admin/cash-sheet] Sent", { ...parsed.data, by: auth.payload.email, to: sent.to })
    return NextResponse.json({ sent })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible" }, { status: 500 })
  }
}

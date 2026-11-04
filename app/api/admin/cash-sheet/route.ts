export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { loadCashSheet } from "@/lib/cash-sheet/close"
import { createAdminClient } from "@/lib/supabase/admin"

const SheetQuery = z.object({
  salon_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** The sheet for one salon and one day: the frozen copy if closed, otherwise a live preview. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager"])
  if ("response" in auth) return auth.response
  const parsed = SheetQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Salon et date requis" }, { status: 400 })
  try {
    return NextResponse.json(await loadCashSheet(createAdminClient(), parsed.data.salon_id, parsed.data.date))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Feuille indisponible" }, { status: 500 })
  }
}

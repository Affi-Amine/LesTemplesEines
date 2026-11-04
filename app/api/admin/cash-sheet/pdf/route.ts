export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { loadCashSheet } from "@/lib/cash-sheet/close"
import { cashSheetFilename, renderCashSheetPdf } from "@/lib/cash-sheet/pdf"
import { createAdminClient } from "@/lib/supabase/admin"

const Query = z.object({ salon_id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

/** The PDF, from the frozen copy once closed. A preview carries "non clôturée" in its closure field. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager"])
  if ("response" in auth) return auth.response
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Salon et date requis" }, { status: 400 })
  try {
    const { sheet } = await loadCashSheet(createAdminClient(), parsed.data.salon_id, parsed.data.date)
    const pdf = await renderCashSheetPdf(sheet)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${cashSheetFilename(sheet)}"`,
        "cache-control": "private, no-store",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PDF indisponible" }, { status: 500 })
  }
}

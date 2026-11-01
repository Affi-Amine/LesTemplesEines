export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSyncStatus } from "@/lib/sync/admin"

/** Back-office overview of the Planity / Treatwell sync: mode, logins, sessions, recent runs. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  try {
    return NextResponse.json(await getSyncStatus(createAdminClient()))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Statut indisponible" }, { status: 500 })
  }
}

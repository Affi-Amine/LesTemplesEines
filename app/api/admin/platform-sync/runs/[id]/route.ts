export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One run with its full report (actions, warnings, mapping summary). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
  const { data, error } = await createAdminClient()
    .from("platform_sync_runs")
    .select("id, mode, status, started_at, finished_at, error, report")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Exécution introuvable" }, { status: 404 })
  return NextResponse.json(data)
}

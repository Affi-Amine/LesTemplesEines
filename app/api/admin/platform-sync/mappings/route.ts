export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMappingOverview } from "@/lib/sync/admin"

const PlatformParam = z.enum(["planity", "treatwell"])

const Override = z.object({
  platform: PlatformParam,
  kind: z.enum(["salon", "staff", "service"]),
  local_id: z.string().uuid(),
  /** null = never sync this salon / masseuse / service. */
  external_id: z.string().trim().min(1).max(200).nullable(),
  /** The platform venue the column or service belongs to; empty for a salon (it repeats external_id). */
  external_venue_id: z.string().trim().max(200).default(""),
})

/** Local salons, staff and services next to the platform's venues, with the automatic pairing and the manual overrides. */
export async function GET(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const platform = PlatformParam.safeParse(request.nextUrl.searchParams.get("platform"))
  if (!platform.success) return NextResponse.json({ error: "Plateforme requise" }, { status: 400 })
  try {
    return NextResponse.json(await getMappingOverview(createAdminClient(), platform.data))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Associations indisponibles" }, { status: 500 })
  }
}

/** Adds or replaces a manual association; the next run uses it instead of the name matching. */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Override.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Association invalide" }, { status: 400 })
  const row = parsed.data
  if (row.kind === "salon") row.external_venue_id = row.external_id || ""
  else if (!row.external_venue_id) return NextResponse.json({ error: "L'établissement de la plateforme est requis" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from("platform_mappings").upsert(row, { onConflict: "platform,kind,local_id,external_venue_id" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log("[admin/platform-sync] Mapping saved", { ...row, by: auth.payload.email })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Identifiant requis" }, { status: 400 })
  const { error } = await createAdminClient().from("platform_mappings").delete().eq("id", parsed.data.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log("[admin/platform-sync] Mapping removed", { id: parsed.data.id, by: auth.payload.email })
  return NextResponse.json({ ok: true })
}

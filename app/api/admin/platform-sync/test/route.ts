export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { testConnection } from "@/lib/sync/admin"
import { PlatformUnavailableError } from "@/lib/sync/types"

const Body = z.object({ platform: z.enum(["planity", "treatwell"]) })

/** Reads nothing but the venue list: a safe way to check a login or a session. */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin"])
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Plateforme requise" }, { status: 400 })
  try {
    return NextResponse.json(await testConnection(createAdminClient(), parsed.data.platform))
  } catch (error) {
    const status = error instanceof PlatformUnavailableError ? 502 : 500
    return NextResponse.json({ error: error instanceof Error ? error.message : "Test impossible" }, { status })
  }
}

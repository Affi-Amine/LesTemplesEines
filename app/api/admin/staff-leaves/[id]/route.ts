import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
  if ("response" in auth) return auth.response
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Congé invalide" }, { status: 400 })
  }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("staff_leaves").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de supprimer le congé" }, { status: 500 })
  }
}

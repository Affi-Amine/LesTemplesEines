export const runtime = "nodejs"

import { verifyClientPasswordToken } from "@/lib/auth/client-password-token"
import { ensureClientAuthUser } from "@/lib/client-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const SetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = SetPasswordSchema.parse(body)
    const tokenPayload = verifyClientPasswordToken(payload.token)
    const supabase = createAdminClient()

    const { authUserId } = await ensureClientAuthUser({
      email: tokenPayload.email,
    })

    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password: payload.password,
      email_confirm: true,
    })

    if (error) throw error

    return NextResponse.json({ success: true, email: tokenPayload.email })
  } catch (error) {
    console.error("[client-auth] set password error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 })
  }
}

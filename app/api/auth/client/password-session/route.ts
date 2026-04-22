export const runtime = "nodejs"

import { generateClientPasswordSessionToken, verifyClientPasswordToken } from "@/lib/auth/client-password-token"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PasswordSessionSchema = z.object({
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = PasswordSessionSchema.parse(body)
    const tokenPayload = verifyClientPasswordToken(payload.token)

    if (tokenPayload.type !== "setup_password" && tokenPayload.type !== "reset_password") {
      return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 })
    }

    const sessionToken = generateClientPasswordSessionToken(tokenPayload.email)

    return NextResponse.json({
      success: true,
      email: tokenPayload.email,
      session_token: sessionToken,
    })
  } catch (error) {
    console.error("[client-auth] password session error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 })
  }
}

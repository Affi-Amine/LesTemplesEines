export const runtime = "nodejs"

import { findAuthUserByEmail, findClientByEmail } from "@/lib/client-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const AccountStatusSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = AccountStatusSchema.parse(body)
    const normalizedEmail = payload.email.trim().toLowerCase()

    const [client, authUser] = await Promise.all([
      findClientByEmail(normalizedEmail),
      findAuthUserByEmail(normalizedEmail),
    ])

    return NextResponse.json({
      exists: Boolean(client || authUser),
      has_auth_account: Boolean(authUser || client?.auth_user_id),
      has_client_profile: Boolean(client),
    })
  } catch (error) {
    console.error("[client-auth] account status error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to check account status" }, { status: 500 })
  }
}

export const runtime = "nodejs"

import { createClientAccountWithPassword } from "@/lib/client-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const RegisterClientSchema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = RegisterClientSchema.parse(body)

    await createClientAccountWithPassword({
      email: payload.email,
      fullName: payload.full_name,
      password: payload.password,
    })

    return NextResponse.json({
      success: true,
      mode: "direct_password",
      message: "Compte client créé. Vous pouvez maintenant vous connecter.",
    })
  } catch (error) {
    console.error("[client-auth] register error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : "Failed to create client account"
    const status = message.includes("existe déjà") ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

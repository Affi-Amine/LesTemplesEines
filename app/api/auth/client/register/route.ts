export const runtime = "nodejs"

import { ensureClientAccount } from "@/lib/client-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const RegisterClientSchema = z.object({
  full_name: z.string().trim().min(2),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = RegisterClientSchema.parse(body)

    await ensureClientAccount({
      email: payload.email,
      fullName: payload.full_name,
      origin: request.nextUrl.origin,
    })

    return NextResponse.json({
      success: true,
      message: "Compte client préparé. Vérifiez votre boîte mail pour créer votre mot de passe.",
    })
  } catch (error) {
    console.error("[client-auth] register error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create client account" }, { status: 500 })
  }
}

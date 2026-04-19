export const runtime = "nodejs"

import { sendClientResetPasswordEmail } from "@/lib/client-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ResetRequestSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = ResetRequestSchema.parse(body)
    await sendClientResetPasswordEmail({
      email: payload.email,
      origin: request.nextUrl.origin,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[client-auth] reset request error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
  }
}

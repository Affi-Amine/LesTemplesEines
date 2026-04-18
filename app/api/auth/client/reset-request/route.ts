export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { sendEmail } from "@/lib/email/resend"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ResetRequestSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = ResetRequestSchema.parse(body)
    const supabase = createAdminClient()

    const result = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: payload.email.toLowerCase(),
      options: {
        redirectTo: `${getBaseUrl(request.nextUrl.origin)}/auth/callback?next=/reset-password`,
      },
    })

    if (result.error) throw result.error

    const actionLink = result.data.properties?.action_link
    if (actionLink) {
      await sendEmail({
        to: payload.email,
        subject: "Réinitialisez votre mot de passe",
        html: `
          <p>Pour définir un nouveau mot de passe, cliquez ici :</p>
          <p><a href="${actionLink}">${actionLink}</a></p>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[client-auth] reset request error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
  }
}

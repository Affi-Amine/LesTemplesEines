import { NextResponse } from "next/server"
import { EMAIL_FROM, isEmailEnabled } from "@/lib/email/resend"
import { getBaseUrl } from "@/lib/gift-cards"

export async function GET() {
  return NextResponse.json({
    email_enabled: isEmailEnabled,
    email_from: EMAIL_FROM,
    app_url: getBaseUrl(),
  })
}

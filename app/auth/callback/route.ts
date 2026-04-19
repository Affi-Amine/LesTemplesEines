import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") || "/mes-forfaits"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      const resetUrl = new URL("/reset-password", url.origin)
      resetUrl.hash = `error=access_denied&error_code=exchange_failed&error_description=${encodeURIComponent(error.message)}`
      return NextResponse.redirect(resetUrl)
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") || "/mes-forfaits"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { findClientByAuthUserId, findClientByEmail } from "@/lib/client-auth"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()
    let client = await findClientByAuthUserId(authData.user.id)

    if (!client && authData.user.email) {
      const emailClient = await findClientByEmail(authData.user.email.toLowerCase())

      if (emailClient) {
        const { data: linkedClient } = await admin
          .from("clients")
          .update({ auth_user_id: authData.user.id })
          .eq("id", emailClient.id)
          .select("*")
          .single()

        client = linkedClient
      }
    }

    if (!client) {
      return NextResponse.json([], { status: 200 })
    }

    const { data, error } = await admin
      .from("client_packs")
      .select(`
        *,
        client:clients(*),
        pack:packs(*),
        usages:client_pack_usages(
          *,
          appointment:appointments(
            id,
            start_time,
            payment_method,
            service:services(id, name)
          )
        )
      `)
      .eq("client_id", client.id)
      .order("purchase_date", { ascending: false })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[client-packs/me] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch client packs" }, { status: 500 })
  }
}

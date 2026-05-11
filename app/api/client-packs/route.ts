import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { ensureClientAuthUser, findClientByEmail, findClientByPhone } from "@/lib/client-auth"
import { sendPackReadyEmail } from "@/lib/email/packs"
import { getPackPaymentStatus } from "@/lib/packs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const CounterPackSaleSchema = z.object({
  pack_id: z.string().uuid(),
  client_first_name: z.string().trim().min(1),
  client_last_name: z.string().trim().min(1),
  client_phone: z.string().trim().min(1),
  client_email: z.string().trim().email().optional().or(z.literal("")),
  installment_count: z.number().int().min(1).max(3),
  paid_installments: z.number().int().min(0).max(3),
  send_email: z.boolean().optional(),
})

function normalizePhone(phone: string) {
  return phone.replace(/[\s\u00A0\-\.\(\)\/]/g, "").trim()
}

function getCounterPackStatus(installmentCount: number, paidInstallments: number) {
  if (paidInstallments <= 0) {
    return "pending"
  }

  if (installmentCount === 1) {
    return "paid"
  }

  return getPackPaymentStatus(installmentCount, paidInstallments)
}

async function ensureCounterClient(params: {
  email?: string
  firstName: string
  lastName: string
  phone: string
}) {
  const normalizedPhone = normalizePhone(params.phone)
  const normalizedEmail = params.email?.trim().toLowerCase() || ""

  if (normalizedEmail) {
    const { client } = await ensureClientAuthUser({
      email: normalizedEmail,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: normalizedPhone,
    })
    return client
  }

  const supabase = createAdminClient()
  let client = await findClientByPhone(normalizedPhone)

  if (!client) {
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert([{
        email: null,
        first_name: params.firstName,
        last_name: params.lastName,
        phone: normalizedPhone,
      }])
      .select("*")
      .single()

    if (insertError || !newClient) {
      throw new Error(insertError?.message || "Failed to create client")
    }

    await supabase.from("loyalty_points").insert([{
      client_id: newClient.id,
      points_balance: 0,
      total_earned: 0,
      total_redeemed: 0,
    }])

    return newClient
  }

  const updates: Record<string, unknown> = {}
  if (params.firstName && client.first_name !== params.firstName) updates.first_name = params.firstName
  if (params.lastName && client.last_name !== params.lastName) updates.last_name = params.lastName
  if (!client.phone && normalizedPhone) updates.phone = normalizedPhone

  if (Object.keys(updates).length === 0) {
    return client
  }

  const { data: updatedClient, error: updateError } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", client.id)
    .select("*")
    .single()

  if (updateError || !updatedClient) {
    throw new Error(updateError?.message || "Failed to update client")
  }

  return updatedClient
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")
    const status = request.nextUrl.searchParams.get("status")
    const supabase = createAdminClient()

    let query = supabase
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
            service:services(id, name),
            salon:salons(id, name, city)
          )
        )
      `)
      .order("purchase_date", { ascending: false })

    if (status) {
      query = query.eq("payment_status", status)
    }

    const { data, error } = await query

    if (error) throw error
    const rows = data || []

    if (!search) {
      return NextResponse.json(rows)
    }

    const normalized = search.toLowerCase()
    return NextResponse.json(
      rows.filter((row: any) =>
        `${row.client?.first_name || ""} ${row.client?.last_name || ""}`.toLowerCase().includes(normalized)
        || String(row.client?.email || "").toLowerCase().includes(normalized)
        || String(row.pack?.name || "").toLowerCase().includes(normalized)
      )
    )
  } catch (error) {
    console.error("[client-packs] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch client packs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) {
      return auth.response
    }

    const payload = CounterPackSaleSchema.parse(await request.json())
    const supabase = createAdminClient()

    const { data: pack, error: packError } = await supabase
      .from("packs")
      .select("*")
      .eq("id", payload.pack_id)
      .single()

    if (packError || !pack || pack.is_active === false) {
      return NextResponse.json({ error: "Pack introuvable ou inactif" }, { status: 404 })
    }

    if (!pack.allowed_installments?.includes(payload.installment_count)) {
      return NextResponse.json({ error: "Nombre d'echeances non autorise pour ce pack" }, { status: 400 })
    }

    if (payload.paid_installments > payload.installment_count) {
      return NextResponse.json({ error: "Echeances payees invalides" }, { status: 400 })
    }

    const normalizedEmail = payload.client_email?.trim().toLowerCase() || ""
    if (normalizedEmail) {
      const emailClient = await findClientByEmail(normalizedEmail)
      const phoneClient = await findClientByPhone(payload.client_phone)
      if (emailClient && phoneClient && emailClient.id !== phoneClient.id) {
        return NextResponse.json(
          { error: "Cet email et ce telephone appartiennent deja a deux clients differents" },
          { status: 409 }
        )
      }
    }

    const client = await ensureCounterClient({
      email: normalizedEmail,
      firstName: payload.client_first_name,
      lastName: payload.client_last_name,
      phone: payload.client_phone,
    })

    const now = new Date().toISOString()
    const paymentStatus = getCounterPackStatus(payload.installment_count, payload.paid_installments)
    const { data: clientPack, error: insertError } = await supabase
      .from("client_packs")
      .insert([{
        client_id: client.id,
        pack_id: pack.id,
        total_sessions: pack.number_of_sessions,
        remaining_sessions: pack.number_of_sessions,
        installment_count: payload.installment_count,
        paid_installments: payload.paid_installments,
        purchase_date: now,
        payment_status: paymentStatus,
        stripe_subscription_id: null,
        stripe_subscription_schedule_id: null,
        stripe_checkout_session_id: null,
      }])
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
            service:services(id, name),
            salon:salons(id, name, city)
          )
        )
      `)
      .single()

    if (insertError || !clientPack) {
      throw new Error(insertError?.message || "Failed to create client pack")
    }

    if (normalizedEmail && payload.send_email !== false) {
      try {
        await sendPackReadyEmail({
          to: normalizedEmail,
          packName: pack.name,
          totalSessions: pack.number_of_sessions,
          purchaseDate: clientPack.purchase_date,
          price: Number(pack.price),
        })
      } catch (emailError) {
        console.error("[client-packs] Counter sale email error:", emailError)
      }
    }

    return NextResponse.json(clientPack, { status: 201 })
  } catch (error) {
    console.error("[client-packs] POST error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create client pack" }, { status: 500 })
  }
}

import type { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const PhoneSchema = z
  .string()
  .transform((s) => (s || "").replace(/[\s\u00A0\-\.\(\)\/]/g, ""))
  .refine((s) => /^\+?[0-9]{9,}$/.test(s), { message: "Invalid phone number format" })

export const ClientDataSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: PhoneSchema,
  email: z.string().email().optional(),
})

export const BookableAppointmentSchema = z.object({
  salon_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  client_data: ClientDataSchema.optional(),
  staff_id: z.string().uuid().optional(),
  staff_ids: z.array(z.string().uuid()).optional(),
  service_id: z.string().uuid(),
  start_time: z.string(),
  end_time: z.string().optional(),
  client_notes: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["confirmed", "pending", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  payment_status: z.enum(["pending", "paid", "unpaid", "failed", "partial"]).optional(),
  payment_method: z.string().optional(),
  amount_paid_cents: z.number().int().min(0).optional(),
  paid_at: z.string().optional(),
  client_pack_id: z.string().uuid().optional(),
}).refine((data) => data.client_id || data.client_data, {
  message: "Either client_id or client_data must be provided",
}).refine((data) => data.staff_id || (data.staff_ids && data.staff_ids.length > 0), {
  message: "At least one staff member must be assigned",
})

type SupabaseClient = ReturnType<typeof createAdminClient>
export type BookableAppointmentInput = z.infer<typeof BookableAppointmentSchema>

export async function resolveAppointmentTiming(
  supabase: SupabaseClient,
  input: Pick<BookableAppointmentInput, "service_id" | "start_time" | "end_time">
) {
  let endTime = input.end_time

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, required_staff_count")
    .eq("id", input.service_id)
    .single()

  if (serviceError || !service) {
    throw new Error("Service not found")
  }

  if (!endTime) {
    const startDate = new Date(input.start_time)
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000)
    endTime = endDate.toISOString()
  }

  return { endTime, service }
}

export async function validateBookableAppointment(
  supabase: SupabaseClient,
  input: BookableAppointmentInput
) {
  const { endTime, service } = await resolveAppointmentTiming(supabase, input)

  const { data: serviceSalon, error: serviceSalonError } = await supabase
    .from("service_salons")
    .select("service_id")
    .eq("service_id", input.service_id)
    .eq("salon_id", input.salon_id)
    .maybeSingle()

  if (serviceSalonError) {
    throw new Error(serviceSalonError.message)
  }

  if (!serviceSalon) {
    throw new Error("Ce service n'est pas disponible dans le salon selectionne")
  }

  const allStaffIds = input.staff_ids || (input.staff_id ? [input.staff_id] : [])
  for (const staffId of allStaffIds) {
    const { data: conflicts, error: conflictError } = await supabase
      .from("appointments")
      .select("id")
      .eq("staff_id", staffId)
      .in("status", ["confirmed", "pending", "blocked"])
      .lt("start_time", endTime)
      .gt("end_time", input.start_time)

    if (conflictError) {
      throw new Error(conflictError.message)
    }

    if (conflicts && conflicts.length > 0) {
      throw new Error("Un ou plusieurs creneaux ne sont plus disponibles")
    }

    const { data: deepConflicts, error: deepConflictError } = await supabase
      .from("appointment_assignments")
      .select("appointment:appointments!inner(start_time, end_time, status)")
      .eq("staff_id", staffId)
      .filter("appointment.status", "in", '("confirmed","pending","blocked")')
      .filter("appointment.start_time", "lt", endTime)
      .filter("appointment.end_time", "gt", input.start_time)

    if (deepConflictError) {
      throw new Error(deepConflictError.message)
    }

    if (deepConflicts && deepConflicts.length > 0) {
      throw new Error("Un ou plusieurs creneaux ne sont plus disponibles")
    }
  }

  return { endTime, service, allStaffIds }
}

async function resolveClientId(supabase: SupabaseClient, input: BookableAppointmentInput) {
  if (input.client_id) {
    return input.client_id
  }

  if (!input.client_data) {
    throw new Error("Client data is required")
  }

  const { data: existingClient } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", input.client_data.phone)
    .maybeSingle()

  if (existingClient?.id) {
    const updates: Record<string, unknown> = {}
    if (!existingClient.email && input.client_data.email) updates.email = input.client_data.email
    if (!existingClient.first_name) updates.first_name = input.client_data.first_name
    if (!existingClient.last_name) updates.last_name = input.client_data.last_name

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("clients")
        .update(updates)
        .eq("id", existingClient.id)
    }

    return existingClient.id
  }

  if (input.client_data.email) {
    const { data: emailClient } = await supabase
      .from("clients")
      .select("*")
      .eq("email", input.client_data.email)
      .maybeSingle()

    if (emailClient?.id) {
      const updates: Record<string, unknown> = {
        first_name: input.client_data.first_name,
        last_name: input.client_data.last_name,
      }

      if (!emailClient.phone) {
        updates.phone = input.client_data.phone
      }

      await supabase
        .from("clients")
        .update(updates)
        .eq("id", emailClient.id)

      return emailClient.id
    }
  }

  const { data: newClient, error: clientError } = await supabase
    .from("clients")
    .insert([input.client_data])
    .select("id")
    .single()

  if (clientError || !newClient) {
    throw new Error(clientError?.message || "Failed to create client")
  }

  await supabase.from("loyalty_points").insert([{
    client_id: newClient.id,
    points_balance: 0,
    total_earned: 0,
    total_redeemed: 0,
  }])

  return newClient.id
}

async function validateAndConsumePack(
  supabase: SupabaseClient,
  params: {
    clientPackId: string
    clientId: string
    serviceId: string
    appointmentId: string
  }
) {
  const { data: clientPack, error } = await supabase
    .from("client_packs")
    .select(`
      *,
      pack:packs(*)
    `)
    .eq("id", params.clientPackId)
    .eq("client_id", params.clientId)
    .single()

  if (error || !clientPack) {
    throw new Error("Pack client introuvable")
  }

  if (clientPack.remaining_sessions <= 0) {
    throw new Error("Aucune séance restante sur ce forfait")
  }

  if (!clientPack.pack?.allowed_services?.includes(params.serviceId)) {
    throw new Error("Cette prestation n'est pas autorisée pour ce forfait")
  }

  const { error: updateError } = await supabase
    .from("client_packs")
    .update({
      remaining_sessions: clientPack.remaining_sessions - 1,
      payment_status: clientPack.payment_status === "pending" ? "active" : clientPack.payment_status,
    })
    .eq("id", clientPack.id)
    .eq("remaining_sessions", clientPack.remaining_sessions)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { error: usageError } = await supabase
    .from("client_pack_usages")
    .insert([{
      client_pack_id: clientPack.id,
      appointment_id: params.appointmentId,
    }])

  if (usageError) {
    throw new Error(usageError.message)
  }

  return clientPack
}

export async function createBookableAppointment(
  supabase: SupabaseClient,
  input: BookableAppointmentInput,
  options?: {
    paymentRecord?: {
      method: string
      amount_cents: number
      notes?: string | null
      reference?: string | null
    }
  }
) {
  const { endTime, allStaffIds, service } = await validateBookableAppointment(supabase, input)
  const clientId = await resolveClientId(supabase, input)
  const primaryStaffId = input.staff_id || allStaffIds[0]
  const paymentStatus = input.payment_status || "unpaid"
  const paidAt = input.paid_at || (paymentStatus === "paid" ? new Date().toISOString() : null)

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert([{
      salon_id: input.salon_id,
      client_id: clientId,
      staff_id: primaryStaffId,
      service_id: input.service_id,
      start_time: input.start_time,
      end_time: endTime,
      client_notes: input.client_notes || input.notes || null,
      status: input.status || "confirmed",
      payment_status: paymentStatus,
      payment_method: input.payment_method || "on_site",
      amount_paid_cents: input.amount_paid_cents || 0,
      paid_at: paidAt,
    }])
    .select(`
      *,
      client:clients(*),
      staff:staff(id, first_name, last_name, role, phone),
      assignments:appointment_assignments(
        staff:staff(id, first_name, last_name)
      ),
      service:services(*),
      salon:salons(id, name, city, address)
    `)
    .single()

  if (error || !appointment) {
    throw new Error(error?.message || "Failed to create appointment")
  }

  const { error: assignmentError } = await supabase
    .from("appointment_assignments")
    .insert(allStaffIds.map((staffId) => ({
      appointment_id: appointment.id,
      staff_id: staffId,
    })))

  if (assignmentError) {
    throw new Error(assignmentError.message)
  }

  if (options?.paymentRecord && options.paymentRecord.amount_cents > 0) {
    const { error: paymentError } = await supabase
      .from("payments")
      .insert([{
        appointment_id: appointment.id,
        amount_cents: options.paymentRecord.amount_cents,
        method: options.paymentRecord.method,
        notes: options.paymentRecord.notes || null,
        reference: options.paymentRecord.reference || null,
      }])

    if (paymentError) {
      throw new Error(paymentError.message)
    }
  }

  if (input.payment_method === "pack" && input.client_pack_id) {
    await validateAndConsumePack(supabase, {
      clientPackId: input.client_pack_id,
      clientId,
      serviceId: input.service_id,
      appointmentId: appointment.id,
    })

    const { error: packPaymentError } = await supabase
      .from("payments")
      .insert([{
        appointment_id: appointment.id,
        amount_cents: service.price_cents,
        method: "pack",
        notes: `Pack usage ${input.client_pack_id}`,
      }])

    if (packPaymentError) {
      throw new Error(packPaymentError.message)
    }
  }

  return appointment
}

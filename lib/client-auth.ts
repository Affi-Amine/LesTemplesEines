import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { sendEmail } from "@/lib/email/resend"
import { extractFirstAndLastName } from "@/lib/packs"
import { generateClientPasswordToken } from "@/lib/auth/client-password-token"

function normalizePhone(phone?: string | null) {
  return (phone || "").replace(/[\s\u00A0\-\.\(\)\/]/g, "").trim() || null
}

function randomPassword() {
  return `${Math.random().toString(36).slice(2)}A!9${Date.now().toString(36)}`
}

async function sendClientPasswordEmail(params: {
  email: string
  firstName: string
  origin?: string
  type: "setup_password" | "reset_password"
}) {
  const token = generateClientPasswordToken({
    email: params.email,
    type: params.type,
  })

  const actionLink = `${getBaseUrl(params.origin)}/reset-password?token=${encodeURIComponent(token)}`
  const subject = params.type === "setup_password" ? "Créez votre mot de passe" : "Réinitialisez votre mot de passe"
  const intro = params.type === "setup_password"
    ? "Votre compte client a été préparé. Définissez maintenant votre mot de passe pour accéder à vos forfaits et réservations."
    : "Nous avons reçu une demande de réinitialisation. Définissez un nouveau mot de passe pour accéder à votre espace client."

  await sendEmail({
    to: params.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">${subject}</h1>
        <p>Bonjour ${params.firstName},</p>
        <p>${intro}</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="background: #b88932; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none;">
            ${params.type === "setup_password" ? "Créer mon mot de passe" : "Choisir un nouveau mot de passe"}
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p><a href="${actionLink}">${actionLink}</a></p>
      </div>
    `,
  })
}

export async function ensureClientAuthUser(params: {
  email: string
  fullName?: string
  firstName?: string
  lastName?: string
  phone?: string
}) {
  const supabase = createAdminClient()
  const normalizedEmail = params.email.trim().toLowerCase()
  const fallbackName = extractFirstAndLastName(params.fullName || normalizedEmail)
  const first_name = params.firstName?.trim() || fallbackName.first_name
  const last_name = params.lastName?.trim() || fallbackName.last_name
  const phone = normalizePhone(params.phone)

  const { data: emailClient } = await supabase
    .from("clients")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle()

  const { data: phoneClient } = phone
    ? await supabase
        .from("clients")
        .select("*")
        .eq("phone", phone)
        .maybeSingle()
    : { data: null }

  let client = emailClient || phoneClient || null

  if (!client) {
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert([{
        email: normalizedEmail,
        first_name,
        last_name,
        phone,
      }])
      .select("*")
      .single()

    if (insertError || !newClient) {
      throw new Error(insertError?.message || "Failed to create client")
    }

    client = newClient

    await supabase.from("loyalty_points").insert([{
      client_id: newClient.id,
      points_balance: 0,
      total_earned: 0,
      total_redeemed: 0,
    }])
  } else {
    const updates: Record<string, unknown> = {}
    const phoneBelongsToAnotherClient = Boolean(phone && phoneClient && phoneClient.id !== client.id)

    if (!client.email) {
      updates.email = normalizedEmail
    }

    if (first_name && client.first_name !== first_name) {
      updates.first_name = first_name
    }

    if (last_name && client.last_name !== last_name) {
      updates.last_name = last_name
    }

    if (phone && client.phone !== phone && !phoneBelongsToAnotherClient) {
      updates.phone = phone
    }

    if (Object.keys(updates).length > 0) {
      const { data: updatedClient, error: updateError } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", client.id)
        .select("*")
        .single()

      if (updateError || !updatedClient) {
        throw new Error(updateError?.message || "Failed to update client profile")
      }

      client = updatedClient
    }
  }

  if (client.auth_user_id) {
    return { client, authUserId: client.auth_user_id, firstName: client.first_name || first_name }
  }

  const createUserResult = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    password: randomPassword(),
    user_metadata: {
      first_name: client.first_name || first_name,
      last_name: client.last_name || last_name,
      role: "client",
    },
  })

  const authUser = createUserResult.data.user

  if (createUserResult.error && !String(createUserResult.error.message).toLowerCase().includes("already")) {
    throw createUserResult.error
  }

  if (!authUser?.id) {
    throw new Error("Unable to create auth user")
  }

  const { data: updatedClient, error: updateError } = await supabase
    .from("clients")
    .update({ auth_user_id: authUser.id })
    .eq("id", client.id)
    .select("*")
    .single()

  if (updateError || !updatedClient) {
    throw new Error(updateError?.message || "Failed to link auth user")
  }

  return { client: updatedClient, authUserId: authUser.id, firstName: updatedClient.first_name || first_name }
}

export async function ensureClientAccount(params: {
  email: string
  fullName: string
  firstName?: string
  lastName?: string
  phone?: string
  origin?: string
}) {
  const normalizedEmail = params.email.trim().toLowerCase()
  const { client, firstName } = await ensureClientAuthUser({
    email: normalizedEmail,
    fullName: params.fullName,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone,
  })

  await sendClientPasswordEmail({
    email: normalizedEmail,
    firstName,
    origin: params.origin,
    type: "setup_password",
  })

  return {
    client,
    recovery_link: null,
  }
}

export async function sendClientResetPasswordEmail(params: {
  email: string
  origin?: string
}) {
  const { client, firstName } = await ensureClientAuthUser({
    email: params.email,
  })

  await sendClientPasswordEmail({
    email: params.email.trim().toLowerCase(),
    firstName,
    origin: params.origin,
    type: "reset_password",
  })

  return { client }
}

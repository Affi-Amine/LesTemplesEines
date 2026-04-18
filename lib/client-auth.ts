import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/gift-cards"
import { sendEmail } from "@/lib/email/resend"
import { extractFirstAndLastName } from "@/lib/packs"

function randomPassword() {
  return `${Math.random().toString(36).slice(2)}A!9${Date.now().toString(36)}`
}

export async function ensureClientAccount(params: {
  email: string
  fullName: string
  origin?: string
}) {
  const supabase = createAdminClient()
  const normalizedEmail = params.email.trim().toLowerCase()
  const { first_name, last_name } = extractFirstAndLastName(params.fullName)

  let { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (!client) {
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert([{
        email: normalizedEmail,
        first_name,
        last_name,
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
    if (!client.first_name) updates.first_name = first_name
    if (!client.last_name) updates.last_name = last_name

    if (Object.keys(updates).length > 0) {
      const { data: updatedClient, error: updateError } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", client.id)
        .select("*")
        .single()

      if (updateError || !updatedClient) {
        throw new Error(updateError?.message || "Failed to update client")
      }

      client = updatedClient
    }
  }

  if (!client.auth_user_id) {
    const createUserResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      password: randomPassword(),
      user_metadata: {
        first_name,
        last_name,
        role: "client",
      },
    })

    const authUser = createUserResult.data.user

    if (createUserResult.error && !String(createUserResult.error.message).toLowerCase().includes("already")) {
      throw createUserResult.error
    }

    if (authUser?.id) {
      const { data: updatedClient, error: updateError } = await supabase
        .from("clients")
        .update({ auth_user_id: authUser.id })
        .eq("id", client.id)
        .select("*")
        .single()

      if (updateError || !updatedClient) {
        throw new Error(updateError?.message || "Failed to link auth user")
      }

      client = updatedClient
    }
  }

  const redirectTo = `${getBaseUrl(params.origin)}/auth/callback?next=/reset-password`
  const recoveryLinkResult = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: {
      redirectTo,
    },
  })

  if (recoveryLinkResult.error) {
    throw recoveryLinkResult.error
  }

  const actionLink = recoveryLinkResult.data.properties?.action_link

  if (actionLink) {
    await sendEmail({
      to: normalizedEmail,
      subject: "Créez votre mot de passe",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h1 style="font-size: 22px; margin-bottom: 16px;">Votre accès client Les Temples</h1>
          <p>Bonjour ${first_name},</p>
          <p>Votre compte client a été préparé. Définissez maintenant votre mot de passe pour accéder à vos forfaits et réservations.</p>
          <p style="margin: 24px 0;">
            <a href="${actionLink}" style="background: #b88932; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none;">
              Créer mon mot de passe
            </a>
          </p>
          <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
          <p><a href="${actionLink}">${actionLink}</a></p>
        </div>
      `,
    })
  }

  return {
    client,
    recovery_link: actionLink || null,
  }
}

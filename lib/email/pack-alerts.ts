import { sendEmail, isEmailEnabled } from "./resend"

export async function sendPackPaymentFailedAdminEmail(params: {
  clientEmail: string | null
  clientName: string
  clientPhone: string | null
  packName: string
  installmentCount: number | null
  paidInstallments: number | null
}) {
  if (!isEmailEnabled) {
    console.log("[email] Disabled — skipping failed pack admin email")
    return
  }

  const adminEnv = process.env.NOTIFICATIONS_ADMIN_EMAIL
  const adminEmails = adminEnv ? adminEnv.split(",").map((value) => value.trim()).filter(Boolean) : []

  if (adminEmails.length === 0) {
    console.log("[email] NOTIFICATIONS_ADMIN_EMAIL not set — skipping failed pack admin email")
    return
  }

  await sendEmail({
    to: adminEmails,
    subject: `Mensualité forfait échouée - ${params.packName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">Mensualité forfait échouée</h1>
        <p>Un paiement en plusieurs fois a échoué pour un forfait client.</p>
        <ul style="padding-left: 20px;">
          <li><strong>Client :</strong> ${params.clientName}</li>
          <li><strong>Email :</strong> ${params.clientEmail || "Non renseigné"}</li>
          <li><strong>Téléphone :</strong> ${params.clientPhone || "Non renseigné"}</li>
          <li><strong>Forfait :</strong> ${params.packName}</li>
          <li><strong>Échéances payées :</strong> ${params.paidInstallments || 0} / ${params.installmentCount || 1}</li>
        </ul>
        <p>Le statut du forfait a été basculé sur <strong>failed</strong>. Vérifiez l'accès client dans l'admin.</p>
      </div>
    `,
  })
}

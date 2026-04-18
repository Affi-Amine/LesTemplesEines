import { sendEmail } from "@/lib/email/resend"
import { getBaseUrl } from "@/lib/gift-cards"
import { formatEuroAmount } from "@/lib/packs"

export async function sendPackReadyEmail(params: {
  to: string
  packName: string
  totalSessions: number
  purchaseDate: string
  appOrigin?: string
  price: number
}) {
  const accountUrl = `${getBaseUrl(params.appOrigin)}/mes-forfaits`

  await sendEmail({
    to: params.to,
    subject: "Votre pack est prêt 🎁",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">Votre pack est prêt 🎁</h1>
        <p>Votre achat a bien été confirmé.</p>
        <div style="background: #f8f5ee; padding: 16px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>${params.packName}</strong></p>
          <p style="margin: 0;">${params.totalSessions} séance(s)</p>
          <p style="margin: 6px 0 0 0;">Montant: ${formatEuroAmount(params.price)}</p>
          <p style="margin: 6px 0 0 0;">Date d'achat: ${new Date(params.purchaseDate).toLocaleString("fr-FR")}</p>
        </div>
        <p style="margin: 24px 0;">
          <a href="${accountUrl}" style="background: #b88932; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none;">
            Accéder à mon compte
          </a>
        </p>
      </div>
    `,
  })
}

import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"

export function giftCardRecipientSubject(params: { serviceName: string }) {
  return `Vous avez reçu une carte cadeau Les Temples - ${params.serviceName}`
}

export function giftCardRecipientHtml(params: {
  serviceName: string
  code: string
  recipientName?: string | null
  personalMessage?: string | null
}) {
  const code = formatGiftCardCode(params.code)
  const redeemUrl = `${getBaseUrl()}/jai-une-carte-cadeau`

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Une carte cadeau vous attend</h2>
    <p>${params.recipientName ? `Bonjour ${params.recipientName},` : "Bonjour,"}</p>
    <p>Une carte cadeau Les Temples vous a été offerte pour la prestation <strong>${params.serviceName}</strong>.</p>
    <p>Votre carte cadeau est jointe à cet email au format PNG. Vous pouvez la conserver, la transférer ou l’imprimer.</p>
    <div style="margin: 18px 0;">
      <img src="cid:gift-card-preview" alt="Carte cadeau Les Temples" style="display:block; width:100%; max-width:560px; border-radius:18px;" />
    </div>
    ${params.personalMessage ? `<p style="padding: 12px 16px; background: #f6f3ef; border-radius: 8px;"><strong>Message:</strong><br/>${params.personalMessage.replace(/\n/g, "<br/>")}</p>` : ""}
    <p><strong>Code cadeau:</strong> <span style="font-size: 18px; letter-spacing: 1px;">${code}</span></p>
    <p>Pour réserver votre créneau, utilisez ce lien:</p>
    <p><a href="${redeemUrl}">${redeemUrl}</a></p>
  </div>
  `
}

import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"

export function giftCardBuyerSubject(params: { serviceName: string }) {
  return `Votre carte cadeau Les Temples - ${params.serviceName}`
}

export function giftCardBuyerHtml(params: {
  serviceName: string
  code: string
  recipientName?: string | null
}) {
  const code = formatGiftCardCode(params.code)
  const giftUrl = `${getBaseUrl()}/jai-une-carte-cadeau`

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111;">
    <h2 style="margin: 0 0 16px;">Votre carte cadeau est prête</h2>
    <p>Merci pour votre achat chez Les Temples.</p>
    <p><strong>Prestation:</strong> ${params.serviceName}</p>
    ${params.recipientName ? `<p><strong>Destinataire:</strong> ${params.recipientName}</p>` : ""}
    <p><strong>Code cadeau:</strong> <span style="font-size: 18px; letter-spacing: 1px;">${code}</span></p>
    <p style="margin-top: 16px;">Ce code pourra être utilisé sur la page dédiée:</p>
    <p><a href="${giftUrl}">${giftUrl}</a></p>
  </div>
  `
}

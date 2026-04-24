import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"

function escapeHtml(value?: string | null) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function giftCardBuyerSubject(params: { serviceName: string }) {
  return `Votre cadeau Les Temples est prêt - ${params.serviceName}`
}

export function giftCardBuyerHtml(params: {
  buyerName: string
  serviceName: string
  code: string
  recipientName?: string | null
  recipientEmail?: string | null
}) {
  const code = formatGiftCardCode(params.code)
  const giftUrl = `${getBaseUrl()}/jai-une-carte-cadeau`
  const buyerName = escapeHtml(params.buyerName)
  const recipientName = escapeHtml(params.recipientName)
  const recipientEmail = escapeHtml(params.recipientEmail)
  const serviceName = escapeHtml(params.serviceName)

  return `
  <div style="margin:0; padding:32px 20px; background:#f7f1e8; font-family:Georgia, 'Times New Roman', serif; color:#20150e;">
    <div style="max-width:680px; margin:0 auto; background:#fffaf4; border:1px solid #ead8bc; border-radius:28px; overflow:hidden; box-shadow:0 18px 60px rgba(71,42,18,0.10);">
      <div style="padding:28px 32px; background:linear-gradient(135deg,#23160f 0%,#5f4327 60%,#c49a5b 100%); color:#fff7ec;">
        <div style="font-size:12px; letter-spacing:0.28em; text-transform:uppercase; opacity:0.78;">Les Temples</div>
        <h1 style="margin:18px 0 10px; font-size:34px; line-height:1.15;">Votre cadeau est prêt</h1>
        <p style="margin:0; font-size:17px; line-height:1.6; color:rgba(255,247,236,0.88);">
          Merci ${buyerName}. Votre carte cadeau a bien été préparée et peut maintenant être transmise à la personne de votre choix.
        </p>
      </div>

      <div style="padding:32px;">
        <div style="margin:0 0 24px; padding:20px 22px; border-radius:20px; background:#f4eadb;">
          <p style="margin:0; font-size:18px; line-height:1.7;">
            Vous offrez un moment de soin, de calme et d'attention. La carte cadeau jointe à cet email est prête à être envoyée ou imprimée.
          </p>
        </div>

        <div style="margin:0 0 24px;">
          <img src="cid:gift-card-preview" alt="Carte cadeau Les Temples" style="display:block; width:100%; max-width:560px; border-radius:22px; margin:0 auto;" />
        </div>

        <table role="presentation" style="width:100%; border-collapse:collapse; margin:0 0 24px;">
          <tr>
            <td style="width:50%; padding:0 8px 16px 0; vertical-align:top;">
              <div style="padding:18px 20px; border:1px solid #ecdcc3; border-radius:18px; background:#fff;">
                <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:8px;">Offert par</div>
                <div style="font-size:22px; line-height:1.4;">${buyerName}</div>
              </div>
            </td>
            <td style="width:50%; padding:0 0 16px 8px; vertical-align:top;">
              <div style="padding:18px 20px; border:1px solid #ecdcc3; border-radius:18px; background:#fff;">
                <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:8px;">Pour</div>
                <div style="font-size:22px; line-height:1.4;">${recipientName || "Le destinataire de votre choix"}</div>
                ${recipientEmail ? `<div style="margin-top:6px; font-size:14px; color:#6b5641;">${recipientEmail}</div>` : ""}
              </div>
            </td>
          </tr>
        </table>

        <div style="padding:22px; border-radius:20px; border:1px solid #ecdcc3; background:#fff;">
          <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:10px;">Détails de la carte</div>
          <p style="margin:0 0 10px; font-size:18px;"><strong>Prestation offerte :</strong> ${serviceName}</p>
          <p style="margin:0 0 10px; font-size:18px;"><strong>Code cadeau :</strong> <span style="letter-spacing:0.14em;">${code}</span></p>
          <p style="margin:0; font-size:16px; line-height:1.7; color:#5f4a36;">
            Ce code peut être utilisé sur la page dédiée pour réserver le soin :
            <a href="${giftUrl}" style="color:#8d6734; text-decoration:none;">${giftUrl}</a>
          </p>
        </div>
      </div>
    </div>
  </div>
  `
}

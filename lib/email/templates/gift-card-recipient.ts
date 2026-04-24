import { formatGiftCardCode, getBaseUrl } from "@/lib/gift-cards"

function escapeHtml(value?: string | null) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function giftCardRecipientSubject(params: { serviceName: string }) {
  return `Un cadeau bien-être vous attend - ${params.serviceName}`
}

export function giftCardRecipientHtml(params: {
  buyerName: string
  serviceName: string
  code: string
  recipientName?: string | null
  personalMessage?: string | null
}) {
  const code = formatGiftCardCode(params.code)
  const redeemUrl = `${getBaseUrl()}/jai-une-carte-cadeau`
  const buyerName = escapeHtml(params.buyerName)
  const recipientName = escapeHtml(params.recipientName)
  const personalMessage = escapeHtml(params.personalMessage).replace(/\n/g, "<br/>")
  const serviceName = escapeHtml(params.serviceName)

  return `
  <div style="margin:0; padding:32px 20px; background:#f7f1e8; font-family:Georgia, 'Times New Roman', serif; color:#20150e;">
    <div style="max-width:680px; margin:0 auto; background:#fffaf4; border:1px solid #ead8bc; border-radius:28px; overflow:hidden; box-shadow:0 18px 60px rgba(71,42,18,0.10);">
      <div style="padding:28px 32px; background:linear-gradient(135deg,#23160f 0%,#5f4327 60%,#c49a5b 100%); color:#fff7ec;">
        <div style="font-size:12px; letter-spacing:0.28em; text-transform:uppercase; opacity:0.78;">Les Temples</div>
        <h1 style="margin:18px 0 10px; font-size:34px; line-height:1.15;">Un cadeau vous attend</h1>
        <p style="margin:0; font-size:17px; line-height:1.6; color:rgba(255,247,236,0.88);">
          ${recipientName ? `Bonjour ${recipientName},` : "Bonjour,"} ${buyerName} a le plaisir de vous offrir un moment chez Les Temples.
        </p>
      </div>

      <div style="padding:32px;">
        <div style="margin:0 0 24px; padding:22px; border-radius:20px; background:#f4eadb;">
          <p style="margin:0; font-size:20px; line-height:1.75;">
            Parce qu'un vrai cadeau est une attention que l'on s'accorde enfin, ${buyerName} vous offre <strong>${serviceName}</strong>.
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
                <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:8px;">Carte cadeau</div>
                <div style="font-size:18px; line-height:1.5;">${serviceName}</div>
              </div>
            </td>
          </tr>
        </table>

        ${personalMessage ? `
          <div style="margin:0 0 24px; padding:22px; border-radius:20px; border:1px solid #ecdcc3; background:#fff;">
            <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:10px;">Le mot de ${buyerName}</div>
            <div style="font-size:19px; line-height:1.8; color:#3a281d;">${personalMessage}</div>
          </div>
        ` : ""}

        <div style="padding:22px; border-radius:20px; border:1px solid #ecdcc3; background:#fff;">
          <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#8b6b46; margin-bottom:10px;">Pour en profiter</div>
          <p style="margin:0 0 10px; font-size:18px;"><strong>Code cadeau :</strong> <span style="letter-spacing:0.14em;">${code}</span></p>
          <p style="margin:0; font-size:16px; line-height:1.7; color:#5f4a36;">
            Réservez votre moment sur
            <a href="${redeemUrl}" style="color:#8d6734; text-decoration:none;"> ${redeemUrl}</a>
          </p>
        </div>
      </div>
    </div>
  </div>
  `
}

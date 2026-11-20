import { sendEmail, isEmailEnabled } from "./resend"
import { giftCardBuyerHtml, giftCardBuyerSubject, type PhysicalGiftSummary } from "./templates/gift-card-buyer"
import { giftCardRecipientHtml, giftCardRecipientSubject } from "./templates/gift-card-recipient"
import { generateGiftCardAttachment } from "./gift-card-attachment"
import { LOGO_LES_TEMPLES_DATA_URI } from "./assets/logo-les-temples"
import { getPaymentMethodLabel } from "@/lib/payments"
import { DEFAULT_GIFT_CARD_DESIGN, type GiftCardDesign } from "@/lib/gift-card-design"

export type { PhysicalGiftSummary }

/** The logo shown in the email header, inline so it displays without loading anything remote. */
export function logoAttachment() {
  return {
    filename: "logo-les-temples.png",
    content: Buffer.from(LOGO_LES_TEMPLES_DATA_URI.split(",")[1], "base64"),
    contentType: "image/png",
    contentId: "les-temples-logo",
  }
}

export async function sendGiftCardEmails(params: {
  buyerName: string
  buyerEmail: string
  recipientEmail?: string | null
  recipientName?: string | null
  personalMessage?: string | null
  serviceName: string
  code: string
  purchasedAt?: string | null
  paymentMethod?: string | null
  purchaseSource?: "online" | "counter"
  sendRecipientEmail?: boolean
  /** The salons' card design; defaults when the caller has no database at hand. */
  design?: GiftCardDesign
  /** A physical extra bought with the card: told to the buyer, never to the recipient. */
  physicalGift?: PhysicalGiftSummary | null
}) {
  if (!isEmailEnabled) {
    console.warn("[email] Gift card emails skipped because RESEND_API_KEY is not configured")
    return { skipped: true }
  }

  const attachment = await generateGiftCardAttachment(
    {
      buyerName: params.buyerName,
      serviceName: params.serviceName,
      code: params.code,
      recipientName: params.recipientName,
      personalMessage: params.personalMessage,
      purchasedAt: params.purchasedAt,
    },
    params.design || DEFAULT_GIFT_CARD_DESIGN
  )
  const attachments = [attachment, logoAttachment()]

  await sendEmail({
    to: params.buyerEmail,
    subject: giftCardBuyerSubject({ serviceName: params.serviceName }),
    html: giftCardBuyerHtml({
      buyerName: params.buyerName,
      serviceName: params.serviceName,
      code: params.code,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      paymentMethodLabel: params.paymentMethod ? getPaymentMethodLabel(params.paymentMethod) : undefined,
      purchaseSource: params.purchaseSource,
      physicalGift: params.physicalGift,
    }),
    attachments,
  })

  if (params.recipientEmail && params.sendRecipientEmail !== false) {
    await sendEmail({
      to: params.recipientEmail,
      subject: giftCardRecipientSubject({ serviceName: params.serviceName }),
      html: giftCardRecipientHtml({
        buyerName: params.buyerName,
        serviceName: params.serviceName,
        code: params.code,
        recipientName: params.recipientName,
        personalMessage: params.personalMessage,
      }),
      attachments,
    })
  }
}

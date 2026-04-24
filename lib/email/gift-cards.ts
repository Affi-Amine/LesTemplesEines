import { sendEmail, isEmailEnabled } from "./resend"
import { giftCardBuyerHtml, giftCardBuyerSubject } from "./templates/gift-card-buyer"
import { giftCardRecipientHtml, giftCardRecipientSubject } from "./templates/gift-card-recipient"
import { generateGiftCardAttachment } from "./gift-card-attachment"

export async function sendGiftCardEmails(params: {
  buyerName: string
  buyerEmail: string
  recipientEmail?: string | null
  recipientName?: string | null
  personalMessage?: string | null
  serviceName: string
  code: string
}) {
  if (!isEmailEnabled) {
    console.warn("[email] Gift card emails skipped because RESEND_API_KEY is not configured")
    return { skipped: true }
  }

  const attachment = await generateGiftCardAttachment({
    buyerName: params.buyerName,
    serviceName: params.serviceName,
    code: params.code,
    recipientName: params.recipientName,
    personalMessage: params.personalMessage,
  })

  await sendEmail({
    to: params.buyerEmail,
    subject: giftCardBuyerSubject({ serviceName: params.serviceName }),
    html: giftCardBuyerHtml({
      buyerName: params.buyerName,
      serviceName: params.serviceName,
      code: params.code,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
    }),
    attachments: [attachment],
  })

  if (params.recipientEmail) {
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
      attachments: [attachment],
    })
  }
}

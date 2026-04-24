import { sendEmail, isEmailEnabled } from "./resend"
import { giftCardBuyerHtml, giftCardBuyerSubject } from "./templates/gift-card-buyer"
import { giftCardRecipientHtml, giftCardRecipientSubject } from "./templates/gift-card-recipient"
import { generateGiftCardAttachment } from "./gift-card-attachment"

export async function sendGiftCardEmails(params: {
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
    serviceName: params.serviceName,
    code: params.code,
    recipientName: params.recipientName,
    personalMessage: params.personalMessage,
  })

  await sendEmail({
    to: params.buyerEmail,
    subject: giftCardBuyerSubject({ serviceName: params.serviceName }),
    html: giftCardBuyerHtml({
      serviceName: params.serviceName,
      code: params.code,
      recipientName: params.recipientName,
    }),
    attachments: [attachment],
  })

  if (params.recipientEmail) {
    await sendEmail({
      to: params.recipientEmail,
      subject: giftCardRecipientSubject({ serviceName: params.serviceName }),
      html: giftCardRecipientHtml({
        serviceName: params.serviceName,
        code: params.code,
        recipientName: params.recipientName,
        personalMessage: params.personalMessage,
      }),
      attachments: [attachment],
    })
  }
}

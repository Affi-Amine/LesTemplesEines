import { getPaymentMethodLabel } from "@/lib/payments"
import { sendEmail, isEmailEnabled } from "./resend"

const DEFAULT_ADMIN_EMAIL = "reservations@les-temples.com"

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function getAdminEmails() {
  const adminEnv = process.env.NOTIFICATIONS_ADMIN_EMAIL
  return Array.from(
    new Set(
      [DEFAULT_ADMIN_EMAIL, ...(adminEnv ? adminEnv.split(",") : [])]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

export async function sendCounterSaleAdminEmail(params: {
  saleType: "gift_card" | "pack"
  itemName: string
  amountLabel: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  paymentMethod?: string | null
  soldByName?: string | null
  soldByEmail?: string | null
  purchasedAt: string
}) {
  if (!isEmailEnabled) {
    console.log("[email] Disabled — skipping counter sale admin email")
    return
  }

  const adminEmails = getAdminEmails()
  if (adminEmails.length === 0) {
    console.log("[email] No admin sale notification recipients configured")
    return
  }

  const saleLabel = params.saleType === "gift_card" ? "Carte cadeau" : "Pack"
  const seller = [params.soldByName, params.soldByEmail].filter(Boolean).join(" - ") || "Non renseigne"

  await sendEmail({
    to: adminEmails,
    subject: `${saleLabel} vendu en caisse - ${params.itemName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">${escapeHtml(saleLabel)} vendu en caisse</h1>
        <ul style="padding-left: 20px;">
          <li><strong>Produit :</strong> ${escapeHtml(params.itemName)}</li>
          <li><strong>Montant :</strong> ${escapeHtml(params.amountLabel)}</li>
          <li><strong>Moyen de paiement :</strong> ${escapeHtml(getPaymentMethodLabel(params.paymentMethod))}</li>
          <li><strong>Vendu par :</strong> ${escapeHtml(seller)}</li>
          <li><strong>Date :</strong> ${escapeHtml(new Date(params.purchasedAt).toLocaleString("fr-FR"))}</li>
          <li><strong>Client :</strong> ${escapeHtml(params.customerName || "Non renseigne")}</li>
          <li><strong>Email :</strong> ${escapeHtml(params.customerEmail || "Non renseigne")}</li>
          <li><strong>Telephone :</strong> ${escapeHtml(params.customerPhone || "Non renseigne")}</li>
        </ul>
      </div>
    `,
  })
}

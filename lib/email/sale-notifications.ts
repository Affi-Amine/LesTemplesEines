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

import { formatEuros } from "@/lib/gift-card-addons"
import type { PhysicalGiftSummary } from "./templates/gift-card-buyer"

/** A physical extra was bought with an online gift card: the salons have a parcel to prepare. */
export async function sendGiftAddonOrderAdminEmail(params: {
  giftCardCode: string
  buyerName: string
  buyerEmail: string
  serviceName: string
  gift: PhysicalGiftSummary
  /** False when the order row could not be written: the admin must enter it by hand. */
  recorded: boolean
}) {
  if (!isEmailEnabled) {
    console.log("[email] Disabled — skipping physical gift admin email")
    return
  }
  const adminEmails = getAdminEmails()
  if (adminEmails.length === 0) return

  const gift = params.gift
  const total = gift.priceCents * gift.quantity + gift.deliveryFeeCents
  const address = gift.shipping
    ? [gift.shipping.name, gift.shipping.line1, gift.shipping.line2, `${gift.shipping.postal_code} ${gift.shipping.city}`, gift.shipping.country, gift.shipping.phone]
        .filter(Boolean).map((line) => escapeHtml(String(line))).join("<br/>")
    : "À remettre au salon (pas de livraison)"
  const answers = Object.entries(gift.extraAnswers || {}).filter(([, value]) => value)
    .map(([label, value]) => `<li><strong>${escapeHtml(label)} :</strong> ${escapeHtml(value)}</li>`).join("")

  await sendEmail({
    to: adminEmails,
    subject: `${params.recorded ? "Cadeau physique à préparer" : "ATTENTION — cadeau physique non enregistré"} - ${gift.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h1 style="font-size: 22px; margin-bottom: 16px;">Cadeau physique commandé avec une carte cadeau</h1>
        ${params.recorded ? "" : `<p style="padding:12px; background:#fee2e2; color:#991b1b; border-radius:8px;"><strong>La commande n'a pas pu être enregistrée dans le back-office</strong> (migration manquante ?). Le client a payé : notez-la à la main.</p>`}
        <ul style="padding-left: 20px;">
          <li><strong>Cadeau :</strong> ${escapeHtml(gift.name)}${gift.quantity > 1 ? ` × ${gift.quantity}` : ""} — ${escapeHtml(formatEuros(gift.priceCents * gift.quantity))}</li>
          <li><strong>Livraison :</strong> ${escapeHtml(formatEuros(gift.deliveryFeeCents))} — <strong>total ${escapeHtml(formatEuros(total))}</strong></li>
          <li><strong>Carte cadeau :</strong> ${escapeHtml(params.giftCardCode)} (${escapeHtml(params.serviceName)})</li>
          <li><strong>Acheteur :</strong> ${escapeHtml(params.buyerName)} — ${escapeHtml(params.buyerEmail)}</li>
          ${answers}
        </ul>
        <p><strong>Adresse :</strong><br/>${address}</p>
        <p>Suivi : Administration › Cartes cadeaux › Cadeaux physiques.</p>
      </div>
    `,
  })
}

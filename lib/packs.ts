import { z } from "zod"

export const PackSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  price: z.coerce.number().nonnegative(),
  number_of_sessions: z.coerce.number().int().min(1),
  allowed_services: z.array(z.string().uuid()).min(1),
  allowed_installments: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).min(1),
  is_active: z.boolean().optional(),
})

export const PackPurchaseSchema = z.object({
  pack_id: z.string().uuid(),
  installment_count: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  customer_first_name: z.string().trim().min(2),
  customer_last_name: z.string().trim().min(2),
  customer_phone: z.string().trim().min(9),
  customer_email: z.string().email(),
  password: z.string().min(8).optional(),
})

export function eurosToCents(amount: number) {
  return Math.round(amount * 100)
}

export function formatEuroAmount(amount: number) {
  return `${amount.toFixed(2)}€`
}

export function getInstallmentAmounts(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function extractFirstAndLastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: "Client", last_name: "Pack" }
  }

  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "Pack" }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

export function getPackPaymentStatus(installmentCount: number, paidInstallments: number) {
  if (paidInstallments <= 0) return "pending"
  if (paidInstallments >= installmentCount) return "paid"
  return "partially_paid"
}

export function canUseClientPackStatus(status: string) {
  return status === "active" || status === "paid" || status === "partially_paid"
}

/** Money columns of the sheet, in cents. */
export interface SheetAmounts {
  card: number
  cash: number
  treatwell: number
  online: number
  /** Cheque, "sur place" without a method, other. */
  other: number
}

export type VoucherKind = "gift_card" | "pack" | "stamp"

export const VOUCHER_LABELS: Record<VoucherKind, string> = {
  gift_card: "Carte cadeau",
  pack: "Forfait",
  stamp: "Carte tampon",
}

export interface SheetLine {
  appointmentId: string
  /** HH:MM, Paris time. */
  time: string
  /** "Passage" for a walk-in without a client card. */
  client: string
  service: string
  amounts: SheetAmounts
  vouchers: VoucherKind[]
  staff: string
  /** Duration as the sheet prints it: "1.00" = 1 h, "0.30" = 30 min, "1.30" = 1 h 30. */
  duration: string
  status: "paid" | "partial" | "unpaid" | "no_show"
  source?: "site" | "planity" | "treatwell" | "unknown"
  prestationCount?: number
  /** Price of the service(s), used for no-shows and unpaid lines. */
  priceCents: number
}

export interface CashSheet {
  salon: { id: string; name: string; address: string; city: string; email: string | null }
  /** yyyy-MM-dd, Paris. */
  date: string
  reference: string
  signerName: string
  /** ISO; null while the sheet is only a preview. */
  closedAt: string | null
  generatedAt: string
  lines: SheetLine[]
  totals: SheetAmounts
  counts: { lines: number; giftCards: number; packs: number; stamps: number; noShows: number; unpaid: number }
  noShowAmountCents: number
  unpaidAmountCents: number
  /** Absent on old, frozen closures: never reconstruct historical data. */
  activity?: {
    singles: number; duos: number; total: number
    sources: Record<"site" | "planity" | "treatwell" | "unknown", { bookings: number; prestations: number }>
    paid: number; partial: number; outstandingCents: number
  }
}

export const SOURCE_LABELS = { site: "Site / saisie équipe", planity: "Planity", treatwell: "Treatwell", unknown: "Origine non renseignée" }

export function activityRecap(sheet: CashSheet): [string, string][] {
  const a = sheet.activity
  if (!a) return [["Détail prestations / origines", "Non disponible sur cette ancienne clôture"]]
  return [
    ["RDV simples", String(a.singles)], ["RDV duo", String(a.duos)],
    ["Total prestations par masseuse", String(a.total)],
    ...Object.entries(a.sources).map(([source, n]): [string, string] => [SOURCE_LABELS[source as keyof typeof SOURCE_LABELS], `${n.bookings} RDV / ${n.prestations} prestations`]),
    ["RDV réglés", String(a.paid)], ["RDV partiellement réglés", String(a.partial)],
  ]
}

export interface CashSheetSettings {
  salon_id: string
  auto_enabled: boolean
  send_time: string
  recipients: string[]
  signer_name: string
  updated_at?: string
}

export interface CashSheetClosure {
  id: string
  salon_id: string
  sheet_date: string
  reference: string
  signer_name: string
  closed_at: string
  closed_by: string | null
  sent_to: string[]
  sent_at: string | null
}

export const EMPTY_AMOUNTS: SheetAmounts = { card: 0, cash: 0, treatwell: 0, online: 0, other: 0 }

export function sumAmounts(amounts: SheetAmounts) {
  return amounts.card + amounts.cash + amounts.treatwell + amounts.online + amounts.other
}

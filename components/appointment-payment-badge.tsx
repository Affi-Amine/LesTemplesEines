import { getAppointmentPayment, type AppointmentPaymentLike } from "@/lib/appointments/payment-presentation"
import { AppointmentCode, PaymentStatusSymbol } from "@/components/calendar/appointment-payment-marker"
import { StaffChoiceSymbol } from "@/components/calendar/appointment-staff-choice-marker"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function AppointmentPaymentBadge({ appointment, compact = false, iconOnly = false, className }: {
  appointment: AppointmentPaymentLike; compact?: boolean; iconOnly?: boolean; className?: string
}) {
  const payment = getAppointmentPayment(appointment)
  if (!payment) return null
  return <span data-payment-state={payment.state} data-payment-channel={payment.channel}
    title={payment.label} aria-label={payment.label}
    className={cn("inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-[#c7c0b5] bg-[#fbf8f2] font-semibold leading-none text-[#302b24]",
      compact ? "px-1 py-0.5 text-[10px]" : "px-2 py-1 text-xs", iconOnly && "border-0 bg-transparent p-0", className)}>
    <PaymentStatusSymbol paid={payment.state === "paid"} />
    <span className={iconOnly ? "sr-only" : undefined}>{compact ? payment.short : payment.label}</span>
  </span>
}

const codes = [
  ["L", "Payé en ligne"], ["T", "Treatwell"], ["P", "Planity"], ["F", "Forfait"], ["C", "Carte cadeau"],
] as const

export function AppointmentPaymentLegend() {
  return <div data-agenda-legend aria-label="Légende du planning" className="space-y-1.5 text-[11px] leading-4 sm:text-xs">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-muted-foreground">Client</span>
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="appointment-tone appointment-tone-blue h-3 w-3 rounded-sm border" />Attendu</span>
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="appointment-tone appointment-tone-green h-3 w-3 rounded-sm border" />Venu</span>
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="appointment-tone appointment-tone-red h-3 w-3 rounded-sm border border-dashed opacity-55" />Absent</span>
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="appointment-tone appointment-tone-red h-3 w-3 rounded-sm border border-dashed opacity-55" />Annulé</span>
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="appointment-tone appointment-tone-blocked h-3 w-3 rounded-sm border" />Bloqué</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-muted-foreground">Paiement</span>
      <span className="inline-flex items-center gap-1"><PaymentStatusSymbol paid />Payé</span>
      <span className="inline-flex items-center gap-1"><PaymentStatusSymbol paid={false} />À payer, même partiel</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
      {codes.map(([code, label]) => <span key={code} className="inline-flex items-center gap-1"><AppointmentCode code={code} />{label}</span>)}
      <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="rounded border border-[#8a5b12] bg-[#e7bc65] px-0.5 text-[10px] font-black leading-4 text-[#382304]">×2</span>Duo</span>
      <span className="inline-flex items-center gap-1"><StaffChoiceSymbol decorative />Masseuse choisie par le client</span>
      <span className="inline-flex items-center gap-1"><Star aria-hidden="true" className="h-5 w-5" />Couleur de la prestation</span>
    </div>
  </div>
}

function CompactLegendSymbol({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="relative inline-block h-3.5 w-3.5 shrink-0">
    <span className="absolute left-0 top-0 origin-top-left scale-[.7]">{children}</span>
  </span>
}

/** Keep the meaning of every marker visible while leaving room for the phone agenda. */
export function CompactAppointmentPaymentLegend() {
  return <div data-compact-agenda-legend aria-label="Légende du planning" className="space-y-0.5 text-[10px] leading-[14px]">
    <div className="flex flex-wrap items-center gap-x-1.5">
      <span className="font-semibold text-muted-foreground">Client</span>
      {[
        ["Attendu", "blue"], ["Venu", "green"], ["Absent", "red"], ["Annulé", "red"], ["Bloqué", "blocked"],
      ].map(([label, tone]) => <span key={label} className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <span aria-hidden="true" className={cn("appointment-tone h-2 w-2 rounded-sm border", `appointment-tone-${tone}`,
          (label === "Absent" || label === "Annulé") && "border-dashed opacity-55")} />{label}
      </span>)}
    </div>
    <div className="flex flex-wrap items-center gap-x-2">
      <span className="font-semibold text-muted-foreground">Paiement</span>
      <span role="img" aria-label="Coche : rendez-vous payé" className="inline-flex items-center gap-0.5 whitespace-nowrap"><CompactLegendSymbol><PaymentStatusSymbol paid /></CompactLegendSymbol>Payé</span>
      <span role="img" aria-label="Croix : montant restant à payer, y compris paiement partiel" className="inline-flex items-center gap-0.5 whitespace-nowrap"><CompactLegendSymbol><PaymentStatusSymbol paid={false} /></CompactLegendSymbol>À payer, même partiel</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
      {codes.map(([code, label]) => <span key={code} role="img" aria-label={`${code} : ${label}`} title={label}
        className="inline-flex items-center gap-0.5 whitespace-nowrap"><CompactLegendSymbol><AppointmentCode code={code} /></CompactLegendSymbol>{code === "L" ? "En ligne" : code === "C" ? "Cadeau" : label}</span>)}
    </div>
    <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
      <span role="img" aria-label="Deux : rendez-vous duo avec deux masseuses" className="inline-flex items-center gap-0.5 whitespace-nowrap"><span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-[#8a5b12] bg-[#e7bc65] text-[8px] font-black leading-none text-[#382304]">×2</span>Duo</span>
      <span role="img" aria-label="Cadenas : masseuse choisie par le client" title="Masseuse choisie par le client" className="inline-flex items-center gap-0.5 whitespace-nowrap"><CompactLegendSymbol><StaffChoiceSymbol decorative /></CompactLegendSymbol>Choix client</span>
      <span role="img" aria-label="Étoile : couleur de la prestation" className="inline-flex items-center gap-0.5 whitespace-nowrap"><CompactLegendSymbol><Star className="h-5 w-5" /></CompactLegendSymbol>Prestation</span>
    </div>
  </div>
}

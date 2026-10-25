import { Check, CircleAlert, CircleDashed, Clock3 } from "lucide-react"
import { getAppointmentPayment, type AppointmentPaymentLike } from "@/lib/appointments/payment-presentation"
import { cn } from "@/lib/utils"

export function AppointmentPaymentBadge({ appointment, compact = false, iconOnly = false, className }: {
  appointment: AppointmentPaymentLike; compact?: boolean; iconOnly?: boolean; className?: string
}) {
  const payment = getAppointmentPayment(appointment)
  if (!payment) return null
  const Icon = payment.icon === "check" ? Check : payment.icon === "alert" ? CircleAlert : payment.icon === "partial" ? CircleDashed : Clock3
  return <span data-payment-state={payment.state} data-payment-channel={payment.channel}
    title={payment.label} aria-label={payment.label}
    className={cn("inline-flex shrink-0 items-center justify-center gap-1 rounded-md border font-semibold leading-none",
      payment.className, `appointment-tone appointment-tone-${payment.state === "paid" ? payment.channel === "online" ? "blue" : "green" : "red"}`, compact ? "px-1 py-0.5 text-[9px]" : "px-2 py-1 text-xs",
      iconOnly && "h-4 w-4 rounded-full p-0", className)}>
    <Icon aria-hidden="true" className={compact || iconOnly ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.5} />
    <span className={iconOnly ? "sr-only" : undefined}>{compact ? payment.short : payment.label}</span>
  </span>
}

export function AppointmentPaymentLegend() {
  return <div aria-label="Repères de paiement" className="space-y-2 text-xs">
    <div className="flex flex-wrap items-center gap-1.5">
    <span className="font-medium text-muted-foreground">Planning :</span>
    <span className="appointment-tone appointment-tone-red rounded border px-2 py-1">À payer</span>
    <span className="appointment-tone appointment-tone-green rounded border px-2 py-1">Payé</span>
    <span className="appointment-tone appointment-tone-blue rounded border px-2 py-1">Effectué</span>
    <span className="appointment-tone appointment-tone-blocked rounded border px-2 py-1">Bloqué</span>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#8a5b12] bg-[#e7bc65] text-[9px] font-black text-[#382304]">L</span>Payé en ligne</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#39785d] bg-[#d3eddf] text-[9px] font-black text-[#17432f]">S</span>Payé sur place</span>
    </div>
    <details>
    <summary className="w-fit cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Comprendre les paiements</summary>
    <div className="mt-2 flex flex-wrap gap-2">
    <AppointmentPaymentBadge appointment={{payment_status:"paid",payment_method:"stripe"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"paid",payment_method:"cash"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"unpaid"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"partial"}} />
    </div>
    </details>
  </div>
}

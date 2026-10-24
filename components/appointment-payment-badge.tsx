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
      payment.className, compact ? "px-1 py-0.5 text-[9px]" : "px-2 py-1 text-xs",
      iconOnly && "h-4 w-4 rounded-full p-0", className)}>
    <Icon aria-hidden="true" className={compact || iconOnly ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.5} />
    <span className={iconOnly ? "sr-only" : undefined}>{compact ? payment.short : payment.label}</span>
  </span>
}

export function AppointmentPaymentLegend() {
  return <div aria-label="Repères de paiement" className="flex flex-wrap items-center gap-2 text-xs">
    <span className="font-medium text-muted-foreground">Paiement :</span>
    <AppointmentPaymentBadge appointment={{payment_status:"paid",payment_method:"stripe"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"paid",payment_method:"cash"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"unpaid"}} />
    <AppointmentPaymentBadge appointment={{payment_status:"partial"}} />
  </div>
}

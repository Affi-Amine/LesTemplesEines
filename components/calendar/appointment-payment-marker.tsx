import { Check, X } from "lucide-react"
import { getAppointmentPayment, type AppointmentPaymentLike } from "@/lib/appointments/payment-presentation"

export function PaymentStatusSymbol({ paid }: { paid: boolean }) {
  const Icon = paid ? Check : X
  return <span aria-hidden="true" className={`appointment-payment-symbol ${paid ? "appointment-payment-symbol-paid" : "appointment-payment-symbol-unpaid"}`}>
    <Icon className="h-3.5 w-3.5" strokeWidth={3.5} />
  </span>
}

export function AppointmentCode({ code }: { code: "L" | "T" | "P" | "F" | "C" }) {
  return <span aria-hidden="true" className={`appointment-code appointment-code-${code.toLowerCase()}`}>{code}</span>
}

export function AppointmentPaymentMarker({ appointment, inline = false }: {
  appointment: AppointmentPaymentLike & { source?: string | null }; inline?: boolean
}) {
  const payment = getAppointmentPayment(appointment)
  if (!payment) return null
  const paid = payment.state === "paid"
  const source = appointment.source === "planity" ? "P" : appointment.source === "treatwell" ? "T" : null
  // A platform code describes the booking source. L/F/C only appear for a settled payment.
  const method = !paid ? null : payment.channel === "online" ? "L" : payment.channel === "gift_card" ? "C"
    : payment.channel === "pack" ? "F" : payment.channel === "treatwell" && source !== "T" ? "T" : null
  const label = source ? `${payment.label} · Réservé sur ${source === "P" ? "Planity" : "Treatwell"}` : payment.label
  return <span data-payment-marker={payment.channel} data-payment-state={payment.state}
    role="img" title={label} aria-label={label}
    className={`${inline ? "" : "absolute right-0 top-0 z-10 "}inline-flex max-w-full shrink-0 flex-wrap items-center gap-0.5 align-top`}>
    <PaymentStatusSymbol paid={paid} />
    {method && <AppointmentCode code={method} />}
    {source && <span data-source-marker={appointment.source} className="inline-flex shrink-0" title={`Réservé sur ${source === "P" ? "Planity" : "Treatwell"}`}><AppointmentCode code={source} /></span>}
  </span>
}

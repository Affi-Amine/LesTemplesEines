import { getAppointmentPayment, type AppointmentPaymentLike } from "@/lib/appointments/payment-presentation"

export function AppointmentPaymentMarker({ appointment }: { appointment: AppointmentPaymentLike }) {
  const payment = getAppointmentPayment(appointment)
  if (!payment || payment.state !== "paid") return null
  const online = payment.channel === "online"
  const onSite = payment.channel === "on-site"
  const letter = online ? "L" : onSite ? "S" : payment.channel === "gift_card" ? "C" : payment.channel === "pack" ? "F" : payment.channel === "treatwell" ? "T" : "✓"
  return <span data-payment-marker={payment.channel} title={payment.label} aria-label={payment.label}
    className={`absolute right-0 top-0 z-10 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-black leading-none shadow-sm @min-[64px]:h-4 @min-[64px]:w-4 @min-[64px]:text-[9px] ${online ? "border-[#8a5b12] bg-[#e7bc65] text-[#382304]" : onSite ? "border-[#39785d] bg-[#d3eddf] text-[#17432f]" : "border-[#746655] bg-[#eee4d5] text-[#453c30]"}`}>
    <span aria-hidden="true">{letter}</span>
    <span className="sr-only">{payment.label}</span>
  </span>
}

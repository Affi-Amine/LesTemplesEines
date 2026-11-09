import { getAppointmentPayment, type AppointmentPaymentLike } from "@/lib/appointments/payment-presentation"
import { getAppointmentStaffIds, isReleasedAppointment, type CalendarAppointmentLike } from "@/lib/calendar/scheduling"
import { hasClientRequestedStaff, staffChoiceLaneWidth, type ClientStaffChoiceLike } from "@/lib/calendar/staff-choice"
import { getAppointmentServiceColors, type AppointmentPlanningColorsLike } from "@/lib/calendar/service-colors"

type MarkerAppointment = CalendarAppointmentLike & AppointmentPaymentLike & ClientStaffChoiceLike & AppointmentPlanningColorsLike & {
  source?: string | null
  service?: (NonNullable<AppointmentPlanningColorsLike["service"]> & { required_staff_count?: number }) | null
}

/** Visible indicators share the available card width in the fitted agenda. */
export function appointmentMarkerCount(appointment: MarkerAppointment) {
  if (appointment.status === "blocked") return 0
  const payment = getAppointmentPayment(appointment)
  const source = appointment.source === "planity" || appointment.source === "treatwell"
  const method = payment?.state === "paid" && (payment.channel === "online" || payment.channel === "gift_card" || payment.channel === "pack"
    || (payment.channel === "treatwell" && appointment.source !== "treatwell"))
  return (payment ? 1 + Number(Boolean(method)) + Number(source) : 0)
    + getAppointmentServiceColors(appointment).length
    + Number(hasClientRequestedStaff(appointment))
    + Number(getAppointmentStaffIds(appointment).length > 1 || appointment.service?.required_staff_count === 2)
    + Number(isReleasedAppointment(appointment.status))
}

export function appointmentMarkerLaneWidth(appointments: readonly MarkerAppointment[]) {
  let width = staffChoiceLaneWidth(appointments)
  for (const appointment of appointments) {
    const stars = getAppointmentServiceColors(appointment).length
    if (!stars) continue
    const payment = getAppointmentPayment(appointment)
    const source = appointment.source === "planity" || appointment.source === "treatwell"
    const method = payment?.state === "paid" && (payment.channel === "online" || payment.channel === "gift_card" || payment.channel === "pack"
      || (payment.channel === "treatwell" && appointment.source !== "treatwell"))
    const paymentParts = [20, ...(method ? [18] : []), ...(source ? [18] : [])]
    const groups = [paymentParts.reduce((sum, part) => sum + part, 0) + (paymentParts.length - 1) * 2,
      stars * 20 + (stars - 1) * 2]
    if (hasClientRequestedStaff(appointment)) groups.push(20)
    if (getAppointmentStaffIds(appointment).length > 1 || appointment.service?.required_staff_count === 2) groups.push(20)
    if (isReleasedAppointment(appointment.status)) groups.push(20)
    // Insets, borders and padding are included; the time may truncate, the markers must not.
    const needed = groups.reduce((sum, group) => sum + group, 0) + (groups.length - 1) * 2 + 24
    width = Math.max(width, Math.ceil(needed / 8) * 8)
  }
  return width
}

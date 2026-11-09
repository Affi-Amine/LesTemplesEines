import { LockKeyhole } from "lucide-react"
import { hasClientRequestedStaff, type ClientStaffChoiceLike } from "@/lib/calendar/staff-choice"

export function StaffChoiceSymbol({ decorative = false }: { decorative?: boolean }) {
  const label = "Masseuse choisie par le client"
  return <span data-client-staff-choice role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label}
    aria-hidden={decorative || undefined} title={label} className="appointment-staff-choice">
    <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
  </span>
}

export function AppointmentStaffChoiceMarker({ appointment }: { appointment: ClientStaffChoiceLike }) {
  return hasClientRequestedStaff(appointment) ? <StaffChoiceSymbol /> : null
}

import { countAppointmentPrestations, type CalendarAppointmentLike } from "@/lib/calendar/scheduling"

export function PrestationCounts({ appointments }: { appointments: CalendarAppointmentLike[] }) {
  const counts = countAppointmentPrestations(appointments)
  return <dl aria-label="Comptage des prestations" className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-3 text-center shadow-sm">
    {[
      { label: "RDV simples", value: counts.singles },
      { label: "RDV duo", value: counts.duos },
      { label: "Total prestations", value: counts.total },
    ].map(({ label, value }) => <div key={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>)}
  </dl>
}

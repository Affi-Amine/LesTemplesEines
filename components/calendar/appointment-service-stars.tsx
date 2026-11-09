import { Star } from "lucide-react"
import { getServicePlanningColor } from "@/lib/services/planning-colors"
import { getAppointmentServiceColors, type AppointmentPlanningColorsLike } from "@/lib/calendar/service-colors"

export function ServiceColorStar({ color, name, id }: { color: unknown; name: string; id?: string }) {
  const selected = getServicePlanningColor(color)
  if (!selected) return null
  const label = `${name} · ${selected.label}`
  return <span data-service-color-star={id || name} data-service-color={selected.id} role="img" aria-label={label} title={label}
    className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
    <Star aria-hidden="true" className="h-[18px] w-[18px]" fill={selected.hex} stroke="#302638" strokeWidth={1.2}
      style={{ filter: "drop-shadow(0 0 1px #fff)" }} />
  </span>
}

export function AppointmentServiceStars({ appointment }: { appointment: AppointmentPlanningColorsLike }) {
  const services = getAppointmentServiceColors(appointment)
  if (!services.length) return null
  return <span data-appointment-service-stars className="inline-flex max-w-full shrink-0 flex-wrap items-center gap-0.5">
    {services.map(service => <ServiceColorStar key={service.id} id={service.id} color={service.color.id} name={service.name} />)}
  </span>
}

export function AppointmentServiceColorKey({ appointments }: { appointments: readonly AppointmentPlanningColorsLike[] }) {
  const services = new Map<string, ReturnType<typeof getAppointmentServiceColors>[number]>()
  for (const appointment of appointments) for (const service of getAppointmentServiceColors(appointment)) services.set(service.id, service)
  if (!services.size) return null
  return <section aria-label="Couleurs des prestations" className="space-y-2 text-xs">
    <p className="font-semibold">Étoiles des prestations</p>
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {[...services.values()].map(service => <li key={service.id} className="inline-flex min-w-0 items-center gap-1.5">
        <ServiceColorStar id={service.id} color={service.color.id} name={service.name} /><span>{service.name}</span>
      </li>)}
    </ul>
  </section>
}

import { Star } from "lucide-react"
import { SERVICE_PLANNING_COLORS, getServicePlanningColor, type ServicePlanningColor } from "@/lib/services/planning-colors"

export function ServicePlanningColorStar({ value, decorative = false }: { value: unknown; decorative?: boolean }) {
  const color = getServicePlanningColor(value)
  if (!color) return null
  return <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" style={{ colorScheme: "only light" }} role={decorative ? undefined : "img"}
    aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Couleur planning : ${color.label}`} title={`Couleur planning : ${color.label}`}>
    <Star aria-hidden="true" className="h-5 w-5" fill={color.hex} stroke="#3B3041" strokeWidth={1.5} />
  </span>
}

export function ServicePlanningColorPicker({ value, name, disabled = false, onChange }: {
  value: ServicePlanningColor | null; name: string; disabled?: boolean; onChange: (color: ServicePlanningColor | null) => void
}) {
  const selected = getServicePlanningColor(value)
  return <fieldset disabled={disabled} aria-describedby="planning-color-description" className="min-w-0 space-y-3 rounded-xl border p-3 sm:p-4">
    <legend className="px-1 text-sm font-semibold">Couleur dans le planning</legend>
    <p id="planning-color-description" className="text-xs leading-5 text-muted-foreground">Une étoile de cette couleur identifie la prestation sur les rendez-vous.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SERVICE_PLANNING_COLORS.map(color => <label key={color.id} className="min-w-0 cursor-pointer">
        <input data-service-color-option={color.id} type="radio" name="service-planning-color" value={color.id}
          checked={value === color.id} onChange={() => onChange(color.id)} className="peer sr-only" />
        <span className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2 py-2 text-xs peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-wait peer-disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-sm">
          <ServicePlanningColorStar value={color.id} decorative /><span className="truncate">{color.label}</span>
        </span>
      </label>)}
      <label className="col-span-2 cursor-pointer sm:col-span-3">
        <input data-service-color-option="none" type="radio" name="service-planning-color" value="none"
          checked={value === null} onChange={() => onChange(null)} className="peer sr-only" />
        <span className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-wait peer-disabled:opacity-50">
          <Star aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />Sans couleur
        </span>
      </label>
    </div>
    <div data-service-color-preview className="flex min-h-12 min-w-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
      {selected && <ServicePlanningColorStar value={selected.id} decorative />}
      <p className="min-w-0 text-sm"><span className="block truncate font-medium">{name.trim() || "Votre prestation"}</span><span className="block text-xs text-muted-foreground">{selected ? `Étoile ${selected.label.toLocaleLowerCase("fr-FR")}` : "Aucune étoile dans le planning"}</span></p>
    </div>
  </fieldset>
}

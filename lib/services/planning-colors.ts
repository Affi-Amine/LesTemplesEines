/** Opaque tones reserved for prestation stars, separate from appointment-status pastels. */
export const SERVICE_PLANNING_COLORS = [
  { id: "tangerine", label: "Mandarine", hex: "#F07824" },
  { id: "apricot", label: "Abricot", hex: "#FFB286" },
  { id: "coral", label: "Corail", hex: "#EE756F" },
  { id: "raspberry", label: "Framboise", hex: "#BA496C" },
  { id: "fuchsia", label: "Fuchsia", hex: "#D843A4" },
  { id: "orchid", label: "Orchidée", hex: "#B26CCD" },
  { id: "periwinkle", label: "Pervenche", hex: "#828ED9" },
  { id: "cyan", label: "Cyan", hex: "#43BDDA" },
  { id: "turquoise", label: "Turquoise", hex: "#30A49A" },
  { id: "olive", label: "Olive", hex: "#929E3B" },
  { id: "cocoa", label: "Cacao", hex: "#9A6C52" },
  { id: "graphite", label: "Graphite", hex: "#667D8D" },
] as const

export type ServicePlanningColor = typeof SERVICE_PLANNING_COLORS[number]["id"]

export function getServicePlanningColor(value: unknown) {
  return SERVICE_PLANNING_COLORS.find(color => color.id === value)
}

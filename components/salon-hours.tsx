import { Card } from "@/components/ui/card"
import { Clock } from "lucide-react"

interface SalonHoursProps {
  hours: Record<string, { open: string; close: string }>
}

export function SalonHours({ hours }: SalonHoursProps) {
  const daysOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  const dayLabels: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  }

  // If hours is not provided or is empty, don't render the section
  if (!hours || Object.keys(hours).length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-2">Hours of Operation</h2>
          <p className="text-muted-foreground">Visit us during our opening hours</p>
        </div>

        <Card className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <Clock className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-lg mb-4">Weekly Schedule</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {daysOrder.map((day) => {
                  const dayHours = hours[day]
                  if (!dayHours) return null

                  return (
                    <div key={day} className="flex justify-between items-center pb-3 border-b">
                      <span className="font-medium">{dayLabels[day]}</span>
                      <span className="text-muted-foreground">
                        {dayHours.open} - {dayHours.close}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

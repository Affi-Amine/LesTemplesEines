"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface TherapistAvailability {
  id: string
  name: string
  photo: string
  specialties: string[]
  availability: {
    date: string
    slots: string[]
  }[]
}

interface TherapistAvailabilityProps {
  therapists: TherapistAvailability[]
}

export function TherapistAvailability({ therapists }: TherapistAvailabilityProps) {
  return (
    <div className="space-y-6">
      {therapists.map((therapist) => (
        <Card key={therapist.id} className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <Image
                src={therapist.photo || "/placeholder.svg?height=64&width=64&query=therapist"}
                alt={therapist.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{therapist.name}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {therapist.specialties.map((spec) => (
                  <Badge key={spec} variant="secondary" className="text-xs">
                    {spec.replace("massage-", "").replace("-", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-3">
            {therapist.availability.map((day) => (
              <div key={day.date}>
                <p className="text-sm font-medium mb-2">
                  {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <Button key={slot} variant="outline" size="sm" className="text-xs bg-transparent">
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

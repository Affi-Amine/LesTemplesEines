import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

interface Employee {
  id: string
  name: string
  role: string
  photo: string
  specialties: string[]
}

interface SalonTeamProps {
  employees: Employee[]
  serviceNames: Record<string, string>
}

export function SalonTeam({ employees, serviceNames }: SalonTeamProps) {
  if (employees.length === 0) {
    return null
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-2">Meet Our Team</h2>
          <p className="text-muted-foreground">Expert therapists dedicated to your wellness</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <Card key={emp.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48 bg-muted">
                <Image
                  src={emp.photo || "/placeholder.svg?height=192&width=300&query=professional therapist"}
                  alt={emp.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{emp.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{emp.role}</p>
                <div className="flex flex-wrap gap-2">
                  {emp.specialties.map((specialty) => (
                    <Badge key={specialty} variant="outline" className="text-xs">
                      {serviceNames[specialty] || specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

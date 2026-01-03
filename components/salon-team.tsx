import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@iconify/react"
import { Award } from "lucide-react"

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
    <section className="py-20 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Enhanced Section Header */}
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold text-primary tracking-widest uppercase">Notre Équipe</span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mt-3 mb-4">
            Rencontrez Nos Experts
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Des thérapeutes passionnés et hautement qualifiés, dédiés à votre bien-être
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {employees.map((emp) => (
            <Card
              key={emp.id}
              className="group overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-0 bg-card shadow-md"
            >
              {/* Employee Photo */}
              <div className="relative h-64 bg-muted overflow-hidden">
                {emp.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emp.photo}
                    alt={emp.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 group-hover:from-primary/30 group-hover:via-primary/15 group-hover:to-accent/15 transition-colors duration-500">
                    <Icon icon="solar:user-bold" className="w-20 h-20 text-primary/40" />
                  </div>
                )}
                {/* Gradient Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Role Badge */}
                <div className="absolute bottom-3 left-3 right-3">
                  <Badge className="bg-white/95 backdrop-blur-sm text-primary border-0 shadow-lg px-3 py-1.5 w-full justify-center font-medium">
                    <Award className="w-3.5 h-3.5 mr-1.5" />
                    {emp.role}
                  </Badge>
                </div>
              </div>

              {/* Employee Info */}
              <div className="p-5">
                <h3 className="font-serif font-semibold text-xl mb-3 group-hover:text-primary transition-colors">
                  {emp.name}
                </h3>

                {/* Specialties */}
                {emp.specialties && emp.specialties.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Spécialités
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {emp.specialties.slice(0, 3).map((specialty) => (
                        <Badge
                          key={specialty}
                          variant="secondary"
                          className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                        >
                          {serviceNames[specialty] || specialty}
                        </Badge>
                      ))}
                      {emp.specialties.length > 3 && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-muted text-muted-foreground"
                        >
                          +{emp.specialties.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

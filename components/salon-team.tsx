"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@iconify/react"
import { useCallback, useEffect, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import { SalonImageFrame } from "@/components/salon-image-frame"

interface Employee {
  id: string
  name: string
  role: string
  gender?: "male" | "female" | null
  photo: string
  specialties: string[]
}

interface SalonTeamProps {
  employees: Employee[]
  serviceNames: Record<string, string>
}

export function SalonTeam({ employees, serviceNames }: SalonTeamProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 4800,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  )
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      containScroll: "trimSnaps",
      dragFree: false,
      loop: false,
    },
    [autoplayPlugin.current]
  )

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap())
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    }

    onSelect()
    emblaApi.on("select", onSelect)
    emblaApi.on("reInit", onSelect)

    return () => {
      emblaApi.off("select", onSelect)
      emblaApi.off("reInit", onSelect)
    }
  }, [emblaApi])

  if (employees.length === 0) {
    return null
  }

  const renderGender = (employee: Employee) => {
    const genderIcon =
      employee.gender === "female" ? "mdi:gender-female" : employee.gender === "male" ? "mdi:gender-male" : null

    return (
      <span className="inline-flex items-center gap-2">
        {genderIcon ? <Icon icon={genderIcon} className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
        <span>{employee.name}</span>
      </span>
    )
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

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-20 bg-gradient-to-r from-background via-background/60 to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-20 bg-gradient-to-l from-background via-background/60 to-transparent lg:block" />

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 md:gap-6">
              {employees.map((emp, index) => (
                <Card
                  key={emp.id}
                  className={`group min-w-0 flex-[0_0_88%] gap-0 overflow-hidden rounded-[1.5rem] border-primary/20 bg-card/95 py-0 shadow-md transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl sm:flex-[0_0_68%] lg:flex-[0_0_38%] xl:flex-[0_0_32%] temple-frame ${
                    index === 0 ? "home-reveal home-reveal-soft home-reveal-delay-1" : index === 1 ? "home-reveal home-reveal-soft home-reveal-delay-2" : "home-reveal home-reveal-soft home-reveal-delay-3"
                  }`}
                >
                  <div className="relative h-64 overflow-hidden bg-muted sm:h-72">
                    {emp.photo ? (
                      <SalonImageFrame
                        src={emp.photo}
                        alt={emp.name}
                        className="h-full w-full"
                        imageClassName="px-3 py-3 transition-transform duration-500 group-hover:scale-[1.03]"
                        backgroundClassName="transition-transform duration-500 group-hover:scale-[1.16]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 transition-colors duration-500 group-hover:from-primary/30 group-hover:via-primary/15 group-hover:to-accent/15">
                        <Icon icon="solar:user-bold" className="h-20 w-20 text-primary/40" />
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <h3 className="mb-3 font-serif text-xl font-semibold transition-colors group-hover:text-primary sm:text-2xl">
                      {renderGender(emp)}
                    </h3>

                    {emp.specialties && emp.specialties.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Spécialités
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {emp.specialties.slice(0, 3).map((specialty) => (
                            <Badge
                              key={specialty}
                              variant="secondary"
                              className="border-primary/20 bg-primary/10 text-xs text-primary hover:bg-primary/20"
                            >
                              {serviceNames[specialty] || specialty}
                            </Badge>
                          ))}
                          {emp.specialties.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-xs text-muted-foreground"
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

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {employees.map((_, index) => (
                <button
                  key={index}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`h-2.5 rounded-full transition-all ${selectedIndex === index ? "w-10 bg-primary" : "w-2.5 bg-primary/30 hover:bg-primary/50"}`}
                  aria-label={`Aller au praticien ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-primary/25 bg-background/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={scrollPrev}
                disabled={!canScrollPrev}
              >
                <Icon icon="solar:alt-arrow-left-bold" className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 border-primary/25 bg-background/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={scrollNext}
                disabled={!canScrollNext}
              >
                <Icon icon="solar:alt-arrow-right-bold" className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

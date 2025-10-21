"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { StepIndicator } from "@/components/step-indicator"
import { salons, services, employees } from "@/lib/mock-data"
import { t } from "@/lib/i18n/get-translations"
import type { Locale } from "@/i18n.config"

type BookingStep = "salon" | "service" | "time" | "info" | "confirm"

interface BookingData {
  salon: string
  service: string
  employee: string
  date: string
  time: string
  firstName: string
  lastName: string
  phone: string
  email: string
  notes: string
}

interface BookingFlowProps {
  initialSalon?: string
  locale?: Locale
}

export function BookingFlow({ initialSalon, locale = "fr" }: BookingFlowProps) {
  const [step, setStep] = useState<BookingStep>(initialSalon ? "service" : "salon")
  const [data, setData] = useState<BookingData>({
    salon: initialSalon || "",
    service: "",
    employee: "",
    date: "",
    time: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  })

  const currentSalon = salons.find((s) => s.id === data.salon)
  const currentService = services.find((s) => s.id === data.service)
  const currentEmployee = employees.find((e) => e.id === data.employee)
  const salonEmployees = employees.filter((e) => e.salonId === data.salon)

  const handleNext = () => {
    const steps: BookingStep[] = ["salon", "service", "time", "info", "confirm"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const handlePrev = () => {
    const steps: BookingStep[] = ["salon", "service", "time", "info", "confirm"]
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const handleConfirm = () => {
    console.log("Booking confirmed:", data)
    alert(t(locale, "booking.booking_confirmed"))
  }

  const stepLabels = [
    t(locale, "booking.step1_title"),
    t(locale, "booking.step2_title"),
    t(locale, "booking.step3_title"),
    t(locale, "booking.step4_title"),
    t(locale, "booking.step5_title"),
  ]
  const stepIndex = ["salon", "service", "time", "info", "confirm"].indexOf(step) + 1

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <StepIndicator currentStep={stepIndex} totalSteps={5} stepLabels={stepLabels} />

      {/* Step 1: Select Salon */}
      {step === "salon" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step1_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step1_subtitle")}</p>
          <RadioGroup value={data.salon} onValueChange={(value) => setData({ ...data, salon: value })}>
            <div className="space-y-3">
              {salons.map((salon) => (
                <div
                  key={salon.id}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted hover:border-primary cursor-pointer transition-all"
                >
                  <RadioGroupItem value={salon.id} id={salon.id} className="mt-1" />
                  <Label htmlFor={salon.id} className="flex-1 cursor-pointer">
                    <div className="font-semibold">{salon.name}</div>
                    <div className="text-sm text-muted-foreground">{salon.address}</div>
                    <div className="text-xs text-muted-foreground mt-1">{salon.phone}</div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
          <div className="flex justify-end gap-3 mt-8">
            <Button onClick={handleNext} disabled={!data.salon} size="lg">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Select Service */}
      {step === "service" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step2_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step2_subtitle")}</p>
          <RadioGroup value={data.service} onValueChange={(value) => setData({ ...data, service: value })}>
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted hover:border-primary cursor-pointer transition-all"
                >
                  <RadioGroupItem value={service.id} id={service.id} className="mt-1" />
                  <Label htmlFor={service.id} className="flex-1 cursor-pointer">
                    <div className="font-semibold">{service.name}</div>
                    <div className="text-sm text-muted-foreground">{service.description}</div>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-muted-foreground">
                        {service.duration} {t(locale, "booking.duration")}
                      </span>
                      <span className="font-semibold text-primary">{service.price}€</span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
          <div className="flex justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.service} size="lg">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Select Time */}
      {step === "time" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step3_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step3_subtitle")}</p>
          <div className="space-y-6">
            <div>
              <Label htmlFor="date" className="font-semibold">
                {t(locale, "booking.select_date")}
              </Label>
              <Input
                id="date"
                type="date"
                value={data.date}
                onChange={(e) => setData({ ...data, date: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label className="font-semibold">{t(locale, "booking.select_time")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"].map((time) => (
                  <Button
                    key={time}
                    variant={data.time === time ? "default" : "outline"}
                    onClick={() => setData({ ...data, time })}
                    className="w-full"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="font-semibold">{t(locale, "booking.select_therapist")}</Label>
              <RadioGroup value={data.employee} onValueChange={(value) => setData({ ...data, employee: value })}>
                <div className="space-y-2 mt-3">
                  {salonEmployees.length > 0 ? (
                    salonEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted">
                        <RadioGroupItem value={emp.id} id={emp.id} />
                        <Label htmlFor={emp.id} className="cursor-pointer flex-1">
                          {emp.name}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>
                  )}
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className="flex justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.date || !data.time || !data.employee} size="lg">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Enter Info */}
      {step === "info" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step4_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step4_subtitle")}</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="font-semibold">
                  {t(locale, "booking.first_name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={data.firstName}
                  onChange={(e) => setData({ ...data, firstName: e.target.value })}
                  className="mt-2"
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="font-semibold">
                  {t(locale, "booking.last_name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={data.lastName}
                  onChange={(e) => setData({ ...data, lastName: e.target.value })}
                  className="mt-2"
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone" className="font-semibold">
                {t(locale, "booking.phone")} <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">{t(locale, "booking.confirmation_sent")}</p>
              <Input
                id="phone"
                type="tel"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="font-semibold">
                {t(locale, "booking.email")} <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="mt-2"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="font-semibold">
                {t(locale, "booking.notes")} <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
                placeholder="e.g., allergies, preferences, pressure level..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-between gap-3 mt-8">
            <Button variant="outline" onClick={handlePrev} size="lg">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleNext} disabled={!data.firstName || !data.lastName || !data.phone} size="lg">
              {t(locale, "common.next")}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {step === "confirm" && (
        <Card className="p-6 md:p-8 animate-in fade-in duration-300">
          <h2 className="text-2xl font-semibold mb-2">{t(locale, "booking.step5_title")}</h2>
          <p className="text-muted-foreground mb-6">{t(locale, "booking.step5_subtitle")}</p>

          {/* Booking Summary */}
          <div className="space-y-4 bg-muted/50 p-6 rounded-lg mb-6 border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step1_title")}</p>
                <p className="font-semibold text-lg">{currentSalon?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step2_title")}</p>
                <p className="font-semibold text-lg">{currentService?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.duration")}</p>
                <p className="font-semibold text-lg">
                  {currentService?.duration} {t(locale, "common.loading")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.select_therapist")}</p>
                <p className="font-semibold text-lg">{currentEmployee?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step3_title")}</p>
                <p className="font-semibold text-lg">
                  {new Date(data.date).toLocaleDateString()} at {data.time}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t(locale, "booking.step4_title")}</p>
                <p className="font-semibold text-lg">
                  {data.firstName} {data.lastName}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-semibold text-lg">{t(locale, "booking.price")}</span>
              <span className="text-2xl font-bold text-primary">{currentService?.price}€</span>
            </div>
          </div>

          {/* Confirmation Info */}
          <div className="bg-accent/10 p-4 rounded-lg mb-6 border border-accent/20">
            <p className="text-sm">
              <strong>✓ {t(locale, "booking.confirmation_sent")}:</strong> {data.phone}
            </p>
            {data.email && (
              <p className="text-sm mt-2">
                <strong>✓ {t(locale, "booking.email")}:</strong> {data.email}
              </p>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={handlePrev} size="lg">
              {t(locale, "common.back")}
            </Button>
            <Button onClick={handleConfirm} className="bg-primary hover:bg-primary/90" size="lg">
              {t(locale, "booking.confirm_booking")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

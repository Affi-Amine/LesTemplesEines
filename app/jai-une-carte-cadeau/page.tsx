"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAvailability } from "@/lib/hooks/use-availability"
import { fetchAPI } from "@/lib/api/client"
import { formatGiftCardCode } from "@/lib/gift-cards"
import { CheckCircle2, Gift, CalendarDays } from "lucide-react"
import { toast } from "sonner"

type GiftCardValidationResponse = {
  id: string
  code: string
  status: "active" | "used" | "cancelled"
  service_id: string
  service: {
    id: string
    name: string
    description?: string | null
    duration_minutes: number
    price_cents: number
    required_staff_count?: number
    salons?: Array<{
      id: string
      name: string
      slug: string
      city: string
      address?: string | null
      phone?: string | null
    }>
  } | null
}

type AvailabilitySlot = {
  start: string
  end: string
  available_staff?: string[]
}

export default function RedeemGiftCardPage() {
  const router = useRouter()
  const [codeInput, setCodeInput] = useState("")
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [giftCard, setGiftCard] = useState<GiftCardValidationResponse | null>(null)
  const [selectedSalonId, setSelectedSalonId] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [clientForm, setClientForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  })

  const dateObject = selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined
  const { data: availabilityData, isLoading: isLoadingAvailability } = useAvailability(
    undefined,
    dateObject,
    giftCard?.service?.id,
    selectedSalonId || undefined
  )

  const compatibleSalons = giftCard?.service?.salons || []
  const requiredStaffCount = giftCard?.service?.required_staff_count || 1

  const handleValidateCode = async () => {
    if (!codeInput.trim()) {
      toast.error("Renseigne un code cadeau.")
      return
    }

    setIsCheckingCode(true)
    try {
      const response = await fetchAPI<GiftCardValidationResponse>(`/gift-cards/validate?code=${encodeURIComponent(codeInput)}`)
      setGiftCard(response)
      setSelectedSalonId("")
      setSelectedDate("")
      setSelectedSlot(null)
      toast.success("Carte cadeau valide.")
    } catch (error: any) {
      setGiftCard(null)
      toast.error(error.message || "Code cadeau invalide.")
    } finally {
      setIsCheckingCode(false)
    }
  }

  const handleRedeem = async () => {
    if (!giftCard || !selectedSalonId || !selectedSlot || !clientForm.first_name || !clientForm.last_name || !clientForm.phone) {
      toast.error("Complète les informations nécessaires avant de confirmer.")
      return
    }

    const staffIds = (selectedSlot.available_staff || []).slice(0, requiredStaffCount)
    if (staffIds.length < requiredStaffCount) {
      toast.error("Le créneau sélectionné n'a plus assez de praticiens disponibles.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchAPI<any>("/gift-cards/redeem", {
        method: "POST",
        body: JSON.stringify({
          code: giftCard.code,
          salon_id: selectedSalonId,
          service_id: giftCard.service_id,
          start_time: selectedSlot.start,
          staff_ids: staffIds,
          client_data: {
            first_name: clientForm.first_name,
            last_name: clientForm.last_name,
            phone: clientForm.phone,
            email: clientForm.email || undefined,
          },
          client_notes: clientForm.notes || undefined,
        }),
      })

      const selectedSalon = compatibleSalons.find((salon) => salon.id === selectedSalonId)
      localStorage.setItem("lastBooking", JSON.stringify({
        reference: response.appointment.id,
        salon: selectedSalon,
        service: giftCard.service,
        start_time: response.appointment.start_time,
        client: {
          first_name: clientForm.first_name,
          last_name: clientForm.last_name,
          phone: clientForm.phone,
          email: clientForm.email,
        },
        notes: clientForm.notes,
      }))

      toast.success("Rendez-vous confirmé et carte cadeau utilisée.")
      router.push("/booking-success")
    } catch (error: any) {
      toast.error(error.message || "Impossible de réserver avec cette carte cadeau.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const slotLabel = useMemo(() => {
    return (slot: AvailabilitySlot) => new Date(slot.start).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground">
              <Gift className="w-4 h-4" />
              Utiliser une carte cadeau
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-bold">J&apos;ai une carte cadeau</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Saisis ton code, vérifie la prestation associée, puis réserve ton créneau dans un salon compatible.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <Label htmlFor="gift-code">Code cadeau</Label>
            <div className="flex gap-3">
              <Input
                id="gift-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH-IJKL"
              />
              <Button onClick={handleValidateCode} disabled={isCheckingCode}>
                {isCheckingCode ? "Vérification..." : "Vérifier"}
              </Button>
            </div>
          </Card>

          {giftCard && giftCard.service && (
            <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8">
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Carte cadeau valide</span>
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Code</p>
                  <p className="font-mono text-lg">{formatGiftCardCode(giftCard.code)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Prestation associée</p>
                  <h2 className="text-2xl font-semibold">{giftCard.service.name}</h2>
                  {giftCard.service.description && (
                    <p className="text-sm text-muted-foreground mt-2">{giftCard.service.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-sm">
                    <span>{giftCard.service.duration_minutes} min</span>
                    <span className="font-semibold text-primary">{(giftCard.service.price_cents / 100).toFixed(2)}€</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salon_id">Salon compatible</Label>
                  <select
                    id="salon_id"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={selectedSalonId}
                    onChange={(e) => {
                      setSelectedSalonId(e.target.value)
                      setSelectedSlot(null)
                    }}
                  >
                    <option value="">Choisir un salon</option>
                    {compatibleSalons.map((salon) => (
                      <option key={salon.id} value={salon.id}>
                        {salon.name} - {salon.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gift-date">Date</Label>
                  <Input
                    id="gift-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      setSelectedSlot(null)
                    }}
                    disabled={!selectedSalonId}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">Créneaux disponibles</p>
                  </div>
                  {!selectedSalonId || !selectedDate ? (
                    <p className="text-sm text-muted-foreground">Choisis d&apos;abord un salon et une date.</p>
                  ) : isLoadingAvailability ? (
                    <p className="text-sm text-muted-foreground">Chargement des créneaux...</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availabilityData?.available_slots?.length ? availabilityData.available_slots.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start
                        return (
                          <Button
                            key={slot.start}
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {slotLabel(slot)}
                          </Button>
                        )
                      }) : (
                        <p className="text-sm text-muted-foreground col-span-full">Aucun créneau disponible pour cette date.</p>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="text-2xl font-semibold">Informations pour le rendez-vous</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom *</Label>
                    <Input id="first_name" value={clientForm.first_name} onChange={(e) => setClientForm({ ...clientForm, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom *</Label>
                    <Input id="last_name" value={clientForm.last_name} onChange={(e) => setClientForm({ ...clientForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone *</Label>
                    <Input id="phone" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={4} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
                </div>

                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                  <p><strong>Prestation:</strong> {giftCard.service.name}</p>
                  <p><strong>Salon:</strong> {compatibleSalons.find((salon) => salon.id === selectedSalonId)?.name || "Aucun"}</p>
                  <p><strong>Créneau:</strong> {selectedSlot ? new Date(selectedSlot.start).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Non sélectionné"}</p>
                  <p><strong>Carte cadeau:</strong> {formatGiftCardCode(giftCard.code)}</p>
                </div>

                <Button onClick={handleRedeem} disabled={!selectedSlot || isSubmitting} className="w-full">
                  {isSubmitting ? "Confirmation..." : "Confirmer le rendez-vous"}
                </Button>
              </Card>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}

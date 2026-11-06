"use client"

// Taking payment for a booking, from wherever it is open: the salon agenda or
// the calendar. One place decides what is owed and what is written, so the two
// views cannot drift apart on money.

import { useEffect, useState } from "react"
import { formatInTimeZone } from "date-fns-tz"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface CheckoutAppointment {
  id: string
  start_time: string
  end_time?: string
  payment_status?: string | null
  amount_paid_cents?: number | null
  service?: { name?: string | null; price_cents?: number | null } | null
  client?: { first_name?: string | null; last_name?: string | null } | null
}

type PaymentLine = { method: string; amount: number }

const METHODS = [
  { value: "card", label: "Carte bancaire" },
  { value: "cash", label: "Espèces" },
  { value: "check", label: "Chèque" },
  { value: "treatwell", label: "Treatwell" },
  { value: "gift_card", label: "Carte cadeau" },
  { value: "loyalty", label: "Points fidélité" },
]

/** A partly paid booking (its prestation was changed for a dearer one) only owes the supplement. */
export function alreadyPaidCents(appointment?: CheckoutAppointment | null) {
  return appointment?.payment_status === "partial" ? appointment.amount_paid_cents || 0 : 0
}

export function amountDueCents(appointment?: CheckoutAppointment | null) {
  return Math.max(0, (appointment?.service?.price_cents || 0) - alreadyPaidCents(appointment))
}

const euros = (cents: number) => (cents / 100).toFixed(2)

export function AppointmentCheckoutDialog({ appointment, open, onOpenChange, onPaid }: {
  appointment: CheckoutAppointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaid?: (appointment: any) => void
}) {
  const [lines, setLines] = useState<PaymentLine[]>([{ method: "card", amount: 0 }])
  const [isSaving, setIsSaving] = useState(false)
  const dueCents = amountDueCents(appointment)
  const paidCents = alreadyPaidCents(appointment)

  // Each time the till opens, start from the amount actually owed.
  useEffect(() => {
    if (open) setLines([{ method: "card", amount: Number(euros(dueCents)) }])
  }, [open, dueCents])

  if (!appointment) return null

  const totalCents = Math.round(lines.reduce((sum, line) => sum + (line.amount || 0), 0) * 100)
  const matches = totalCents === dueCents

  const updateLine = (index: number, field: keyof PaymentLine, value: string | number) =>
    setLines(current => current.map((line, position) => position === index ? { ...line, [field]: value } : line))
  const addLine = () => setLines(current => {
    const rest = Math.max(0, dueCents - Math.round(current.reduce((sum, line) => sum + (line.amount || 0), 0) * 100))
    return [...current, { method: "cash", amount: Number(euros(rest)) }]
  })
  const removeLine = (index: number) => setLines(current => current.filter((_, position) => position !== index))

  const confirm = async () => {
    if (!matches) {
      toast.error(paidCents ? "Le montant encaissé doit correspondre au supplément restant." : "Le montant total payé doit correspondre au prix du rendez-vous.")
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status: "paid",
          payment_method: lines.length > 1 ? "mixed" : lines[0].method,
          amount_paid_cents: totalCents + paidCents,
          payments: lines.map(line => ({ method: line.method, amount_cents: Math.round(line.amount * 100) })),
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Erreur lors de l’encaissement")
      }
      const paid = await response.json()
      toast.success("Paiement validé", { description: "Vous pouvez maintenant démarrer le soin." })
      onOpenChange(false)
      onPaid?.(paid)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l’encaissement")
    } finally {
      setIsSaving(false)
    }
  }

  const clientName = `${appointment.client?.first_name || ""} ${appointment.client?.last_name || ""}`.trim()

  return (
    <Dialog open={open} onOpenChange={value => { if (!isSaving) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Encaisser le rendez-vous</DialogTitle>
          <DialogDescription>Enregistrez le règlement, en plusieurs moyens de paiement si besoin.</DialogDescription>
        </DialogHeader>

        <section className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          {clientName && <p className="font-semibold">{clientName}</p>}
          <p className="text-muted-foreground">
            {formatInTimeZone(appointment.start_time, "Europe/Paris", "dd/MM/yyyy · HH:mm")}
            {appointment.end_time ? ` – ${formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")}` : ""}
          </p>
          {appointment.service?.name && <p className="break-words text-muted-foreground">{appointment.service.name}</p>}
          <p className="font-semibold">Montant du rendez-vous : {euros(appointment.service?.price_cents || 0)} €</p>
          {paidCents > 0 && <p className="font-semibold text-amber-800">
            Déjà réglé {euros(paidCents)} € · supplément à encaisser : {euros(dueCents)} €
          </p>}
        </section>

        <div className="min-w-0 space-y-4 py-2">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-end gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
              <div className="col-span-2 min-w-0 space-y-2 sm:col-span-1">
                <Label htmlFor={`checkout-method-${index}`}>Mode de paiement {lines.length > 1 ? index + 1 : ""}</Label>
                <Select value={line.method} onValueChange={value => updateLine(index, "method", value)}>
                  <SelectTrigger id={`checkout-method-${index}`} className="h-11 w-full min-w-0"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`checkout-amount-${index}`}>Montant (€)</Label>
                <Input id={`checkout-amount-${index}`} type="number" min="0" step="0.01" inputMode="decimal"
                  className="h-11 text-base sm:text-sm" value={line.amount}
                  onChange={event => updateLine(index, "amount", parseFloat(event.target.value) || 0)} />
              </div>
              {lines.length > 1 && (
                <Button aria-label={`Retirer le paiement ${index + 1}`} variant="ghost" size="icon" className="h-11 w-10 text-destructive" onClick={() => removeLine(index)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addLine} className="h-auto min-h-11 w-full whitespace-normal">
            <Plus className="mr-2 h-4 w-4" />Ajouter un autre moyen de paiement
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <span className="font-semibold">Total encaissé :</span>
            <span className={matches ? "font-bold text-green-600" : "font-bold text-red-500"}>
              {euros(totalCents)}€ / {euros(dueCents)}€
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={confirm} disabled={isSaving || !matches}>{isSaving ? "Encaissement…" : "Confirmer et payer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

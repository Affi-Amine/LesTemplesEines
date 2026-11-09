"use client"

import { useEffect, useId, useRef, useState } from "react"
import { formatInTimeZone } from "date-fns-tz"
import { Banknote, CreditCard, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CHECKOUT_METHODS, alreadyPaidCents, amountDueCents, buildCheckoutPayload, checkoutAmountText,
  checkoutBalanceError, checkoutEuros, checkoutPriceCents, parseCheckoutCents,
  type CheckoutAppointment, type CheckoutPaymentLine,
} from "@/lib/appointments/checkout"

export { alreadyPaidCents, amountDueCents } from "@/lib/appointments/checkout"
export type { CheckoutAppointment } from "@/lib/appointments/checkout"

/** One shared till for the salon agenda and calendar; payment never changes attendance. */
export function AppointmentCheckoutDialog({ appointment, open, onOpenChange, onPaid }: {
  appointment: CheckoutAppointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaid?: (appointment: any) => void
}) {
  const fieldId = useId()
  const saving = useRef(false)
  const completed = useRef<string | null>(null)
  const [recordedKey, setRecordedKey] = useState<string | null>(null)
  const [simpleMethod, setSimpleMethod] = useState("card")
  const [split, setSplit] = useState(false)
  const [lines, setLines] = useState<CheckoutPaymentLine[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [serverError, setServerError] = useState("")
  const priceCents = checkoutPriceCents(appointment)
  const paidCents = alreadyPaidCents(appointment)
  const dueCents = amountDueCents(appointment)
  const checkoutKey = `${appointment?.id}:${appointment?.updated_at || ""}:${appointment?.payment_status}:${priceCents}:${paidCents}`
  const recorded = recordedKey === checkoutKey

  useEffect(() => {
    if (!open || saving.current) return
    setSimpleMethod("card")
    setSplit(false)
    setLines([{ method: "card", amount: checkoutAmountText(dueCents) }])
    setServerError("")
  }, [open, checkoutKey, dueCents])

  if (!appointment) return null

  const settled = appointment.payment_status === "paid" || recorded
  const balanceError = settled ? "" : checkoutBalanceError(appointment)
  const effectiveLines = split ? lines : [{ method: simpleMethod, amount: checkoutAmountText(dueCents) }]
  const totalCents = effectiveLines.reduce((sum, line) => sum + (parseCheckoutCents(line.amount) || 0), 0)
  let allocationError = ""
  if (!settled && !balanceError && dueCents > 0) {
    try { buildCheckoutPayload(appointment, effectiveLines) }
    catch (error) { allocationError = error instanceof Error ? error.message : "Vérifiez la répartition." }
  }
  const canSubmit = !settled && !balanceError && dueCents > 0 && !allocationError
  const errorId = `${fieldId}-checkout-error`

  const updateLine = (index: number, field: keyof CheckoutPaymentLine, value: string) => {
    setServerError("")
    setLines(current => current.map((line, position) => position === index ? { ...line, [field]: value } : line))
  }
  const useSimpleMethod = (method: string) => {
    setSimpleMethod(method)
    setSplit(false)
    setServerError("")
  }
  const addLine = () => setLines(current => {
    const total = current.reduce((sum, line) => sum + (parseCheckoutCents(line.amount) || 0), 0)
    return [...current, { method: "cash", amount: dueCents > total ? checkoutAmountText(dueCents - total) : "" }]
  })
  const confirm = async () => {
    // React's disabled state applies on the next render; the ref closes that gap.
    if (!open || saving.current || completed.current === checkoutKey) return
    let payload
    try { payload = buildCheckoutPayload(appointment, effectiveLines) }
    catch (error) {
      setServerError(error instanceof Error ? error.message : "Vérifiez le règlement.")
      return
    }
    saving.current = true
    setIsSaving(true)
    setServerError("")
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "L’encaissement n’a pas pu être enregistré. Réessayez.")
      }
      const paid = await response.json()
      completed.current = checkoutKey
      setRecordedKey(checkoutKey)
      toast.success("Encaissement validé")
      onOpenChange(false)
      onPaid?.(paid)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "L’encaissement n’a pas pu être enregistré.")
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  const clientName = [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(" ") || "Client de passage"
  const serviceNames = appointment.service_items?.length
    ? appointment.service_items.map(item => item.name || "Prestation").join(" + ") : appointment.service?.name || "Prestation"

  return <Dialog open={open} onOpenChange={value => { if (!saving.current) onOpenChange(value) }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[540px]" showCloseButton={!isSaving}>
      <DialogHeader>
        <DialogTitle>Encaisser le rendez-vous</DialogTitle>
        <DialogDescription>Choisissez le moyen de paiement et validez le règlement reçu.</DialogDescription>
      </DialogHeader>

      <section aria-label="Rendez-vous à encaisser" className="space-y-1 text-sm">
        <p className="break-words text-base font-semibold">{clientName}</p>
        <p className="break-words">{serviceNames}</p>
        <p className="text-muted-foreground">
          {formatInTimeZone(appointment.start_time, "Europe/Paris", "dd/MM/yyyy · HH:mm")}
          {appointment.end_time ? ` – ${formatInTimeZone(appointment.end_time, "Europe/Paris", "HH:mm")}` : ""}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border bg-muted/30 p-4" aria-label="Solde du rendez-vous">
        <div>
          <p className="text-sm text-muted-foreground">{settled ? "Rendez-vous déjà réglé" : "À encaisser"}</p>
          <p data-checkout-due className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{balanceError ? "—" : checkoutEuros(settled ? 0 : dueCents)} €</p>
        </div>
        {priceCents !== null && <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Total du rendez-vous</span><span className="tabular-nums">{checkoutEuros(priceCents)} €</span>
        </div>}
        {appointment.payment_status === "partial" && paidCents > 0 && <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <span>Déjà réglé</span><span data-checkout-already-paid className="font-medium tabular-nums">{checkoutEuros(paidCents)} €</span>
        </div>}
      </section>

      {!settled && !balanceError && dueCents > 0 && <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3" aria-label="Moyen de paiement rapide">
          {[{ method: "card", label: "Carte bancaire", Icon: CreditCard }, { method: "cash", label: "Espèces", Icon: Banknote }].map(({ method, label, Icon }) =>
            <Button key={method} variant="outline" disabled={isSaving} aria-pressed={!split && simpleMethod === method}
              onClick={() => useSimpleMethod(method)} className={`h-12 min-w-0 gap-2 whitespace-normal rounded-xl px-2 text-xs sm:text-sm ${!split && simpleMethod === method ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : ""}`}>
              <Icon className="h-4 w-4" aria-hidden="true" /><span className="min-w-0">{label}</span>
            </Button>)}
        </div>

        {!split ? <Button variant="ghost" disabled={isSaving} className="min-h-11 w-full whitespace-normal text-sm" onClick={() => {
          setSplit(true)
          setServerError("")
          setLines([{ method: simpleMethod, amount: checkoutAmountText(dueCents) }])
        }}>Paiement mixte ou autre moyen</Button> : <div data-checkout-split className="space-y-3 rounded-xl border p-3">
          {lines.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.6fr)_2.75rem] items-end gap-2">
            <div className="col-span-3 min-w-0 space-y-2 min-[420px]:col-span-1">
              <Label htmlFor={`${fieldId}-method-${index}`}>Moyen {index + 1}</Label>
              <Select disabled={isSaving} value={line.method} onValueChange={value => updateLine(index, "method", value)}>
                <SelectTrigger id={`${fieldId}-method-${index}`} className="h-11 w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>{CHECKOUT_METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 min-w-0 space-y-2 min-[420px]:col-span-1">
              <Label htmlFor={`${fieldId}-amount-${index}`}>Montant (€)</Label>
              <Input id={`${fieldId}-amount-${index}`} disabled={isSaving} type="text" inputMode="decimal" autoComplete="off"
                className="h-11 text-base tabular-nums" value={line.amount} aria-describedby={allocationError ? errorId : undefined}
                aria-invalid={parseCheckoutCents(line.amount) === null} onChange={event => updateLine(index, "amount", event.target.value)} />
            </div>
            <Button aria-label={`Retirer le paiement ${index + 1}`} variant="ghost" size="icon" className="h-11 w-11 text-destructive"
              disabled={isSaving || lines.length === 1} onClick={() => setLines(current => current.filter((_, position) => position !== index))}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>)}
          <Button variant="outline" disabled={isSaving || lines.length >= 20} onClick={addLine} className="min-h-11 w-full whitespace-normal">
            <Plus className="h-4 w-4" aria-hidden="true" />Ajouter un moyen
          </Button>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
            <span>Total réparti</span><span data-checkout-total className="font-semibold tabular-nums">{checkoutEuros(totalCents)} € / {checkoutEuros(dueCents)} €</span>
          </div>
        </div>}
      </div>}

      {(balanceError || allocationError || serverError) && <p id={errorId} data-checkout-error role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {serverError || balanceError || allocationError}
      </p>}
      {!settled && !balanceError && dueCents === 0 && <p className="text-sm text-muted-foreground">Aucun montant ne reste à encaisser.</p>}

      <DialogFooter className="gap-2">
        <Button variant="outline" className="h-12 rounded-xl" onClick={() => onOpenChange(false)} disabled={isSaving}>{settled || dueCents === 0 ? "Fermer" : "Annuler"}</Button>
        {!settled && dueCents > 0 && <Button className="h-auto min-h-12 min-w-0 whitespace-normal rounded-xl py-3" onClick={confirm} disabled={isSaving || !canSubmit}>
          {isSaving ? "Encaissement…" : `Valider l’encaissement · ${checkoutEuros(dueCents)} €`}
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

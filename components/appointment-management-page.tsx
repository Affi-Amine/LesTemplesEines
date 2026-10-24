"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { CalendarDays, Check, Clock3, Loader2, Mail, MapPin, Phone, RefreshCw, Users } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppointmentPaymentBadge } from "@/components/appointment-payment-badge"
import { fetchAPI } from "@/lib/api/client"
import { managementPermission, MANAGEMENT_RULE, MANAGEMENT_REFUND, type ManagedAppointment } from "@/lib/appointments/management-policy"
import { isScheduleDate } from "@/lib/calendar/working-periods"
import { getStatusLabel } from "@/lib/utils"
import { toast } from "sonner"

const when = (instant: string) => formatInTimeZone(instant, "Europe/Paris", "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })
const time = (instant: string) => formatInTimeZone(instant, "Europe/Paris", "HH:mm")
type Slot = { start: string; end: string }

export function AppointmentManagementPage() {
  const cache = useQueryClient()
  const [id, setId] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("")
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view")
  const [date, setDate] = useState(""), [selected, setSelected] = useState(""), [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now()), [notice, setNotice] = useState("")
  const rawToken = useRef<string | null>(null), lock = useRef(false), active = useRef(true), initialized = useRef(false)
  const pending = useRef<{ signature: string; requestId: string } | null>(null)

  const restore = async () => {
    setLoading(true); setError("")
    try {
      const appointment = rawToken.current
        ? await fetchAPI<ManagedAppointment>("/booking-management/session", { method: "POST", headers: { "X-Booking-Action": "1" }, body: JSON.stringify({ token: rawToken.current }) })
        : await fetchAPI<ManagedAppointment>("/booking-management/appointment", { cache: "no-store" })
      if (!active.current) return
      rawToken.current = null
      cache.setQueryData(["managed-appointment", appointment.id], appointment)
      setId(appointment.id); setDate(appointment.start_time.slice(0,10))
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : "Impossible d’ouvrir votre rendez-vous.") }
    finally { if (active.current) setLoading(false) }
  }
  useEffect(() => {
    active.current = true
    if (!initialized.current) {
      initialized.current = true
      const fragment = new URLSearchParams(window.location.hash.slice(1))
      rawToken.current = fragment.get("cle")
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname)
      void restore()
    }
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => { active.current = false; window.clearInterval(timer) }
    // The URL fragment is consumed once; access continues through an HttpOnly cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bookingQuery = useQuery({
    queryKey: ["managed-appointment", id], enabled: Boolean(id) && !busy,
    queryFn: ({ signal }) => fetchAPI<ManagedAppointment>(`/booking-management/appointment?appointment_id=${id}`, { signal, cache: "no-store" }),
    staleTime: 15_000, refetchInterval: 30_000, retry: false,
  })
  const booking = bookingQuery.data
  const permission = booking ? managementPermission(booking, new Date(now)) : { allowed: false, reason: "" }
  const allowed = Boolean(booking?.permission.allowed && permission.allowed && !bookingQuery.isError)
  const slotsQuery = useQuery({
    queryKey: ["managed-slots", id, booking?.version, date], enabled: allowed && mode === "reschedule" && isScheduleDate(date) && !busy,
    queryFn: ({ signal }) => fetchAPI<{ available_slots: Slot[] }>(`/booking-management/availability?appointment_id=${id}&date=${date}`, { signal, cache: "no-store" }),
    staleTime: 0, refetchInterval: 30_000, retry: false,
  })
  const slots = slotsQuery.data?.available_slots.filter(slot => slot.start !== booking?.start_time && Date.parse(slot.start) !== Date.parse(booking?.start_time || "")) || []
  const chosen = slots.find(slot => slot.start === selected)

  useEffect(() => { if (!allowed && booking) setMode("view") }, [allowed, booking])

  const change = async (action: "cancel" | "reschedule") => {
    if (lock.current || !booking || !allowed || (action === "reschedule" && !chosen)) return
    lock.current = true; setBusy(true); setNotice("")
    const signature = `${booking.id}:${booking.version}:${action}:${action === "reschedule" ? selected : ""}`
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() }
    try {
      await cache.cancelQueries({ queryKey: ["managed-appointment", id] })
      const updated = await fetchAPI<ManagedAppointment>("/booking-management/appointment", {
        method: "PATCH", headers: { "X-Booking-Action": "1" }, body: JSON.stringify({
          appointment_id: booking.id, request_id: pending.current.requestId, expected_updated_at: booking.version,
          action, ...(action === "reschedule" ? { start_time: selected } : {}),
        }),
      })
      cache.setQueryData(["managed-appointment", id], updated)
      pending.current = null; setMode("view"); setSelected("")
      toast.success(action === "cancel" ? "Votre rendez-vous est annulé" : "Votre rendez-vous a été déplacé")
      setNotice(action === "cancel" ? `Votre rendez-vous est annulé. ${updated.payment_status === "paid" || updated.payment_status === "partial" ? MANAGEMENT_REFUND : ""}` : "Le nouvel horaire est confirmé. Le soin, l’équipe et le paiement sont conservés.")
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "La demande n’a pas pu être confirmée. Actualisez les informations avant de réessayer.")
      void cache.invalidateQueries({ queryKey: ["managed-appointment", id] })
      void cache.invalidateQueries({ queryKey: ["managed-slots", id] })
    } finally { lock.current = false; setBusy(false) }
  }

  return <main className="min-h-screen px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-xl space-y-5">
      <header className="space-y-4">
        <Link href="/" className="inline-block font-serif text-xl font-semibold text-primary">Les Temples</Link>
        <div><h1 className="text-2xl font-semibold sm:text-3xl">Mon rendez-vous</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Retrouvez votre réservation et gérez-la simplement.</p></div>
      </header>
      {loading ? <Card className="flex items-center gap-3 p-6" role="status"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />Ouverture de votre rendez-vous…</Card> : error ?
        <Card className="space-y-4 p-5"><p role="alert">{error}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void restore()}>Réessayer</Button><Button asChild><Link href="/nos-temples">Contacter un salon</Link></Button></div></Card> : booking ? <>
        {notice && <div role="status" className="rounded-xl border border-primary/30 bg-card p-4 text-sm leading-6">{notice}</div>}
        {bookingQuery.isError && <div role="alert" className="rounded-xl border p-4 text-sm"><p>{bookingQuery.error instanceof Error ? bookingQuery.error.message : "Actualisez votre rendez-vous avant de continuer."}</p><Button variant="outline" className="mt-3" onClick={() => void bookingQuery.refetch()}>Actualiser</Button></div>}
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border px-3 py-1 text-xs font-semibold">{getStatusLabel(booking.status)}</span><AppointmentPaymentBadge appointment={booking} /></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Votre soin</p><h2 className="mt-2 text-xl font-semibold">{booking.service_name}</h2><p className="mt-1 text-sm text-muted-foreground">{booking.duration_minutes} minutes · {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(booking.price_cents / 100)}</p></div>
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="font-semibold capitalize">{when(booking.start_time)}</span></p>
            <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />{time(booking.start_time)}–{time(booking.end_time)} · heure de Paris</p>
            {booking.staff_names.length > 0 && <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{booking.staff_names.join(", ")}</p>}
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{booking.salon.name}<br /><span className="text-muted-foreground">{booking.salon.address} {booking.salon.city}</span></span></p>
          </div>
        </Card>
        <section className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm leading-6" aria-label="Conditions de modification">
          <p>{MANAGEMENT_RULE}</p>
          {(!allowed && !bookingQuery.isError) && <p className="font-semibold">{permission.reason || booking.permission.reason}</p>}
          {(booking.payment_status === "paid" || booking.payment_status === "partial") && <p>{MANAGEMENT_REFUND} Aucun remboursement automatique n’est effectué.</p>}
        </section>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          {allowed && mode === "view" && <div className="grid gap-3 sm:grid-cols-2">
            <Button className="min-h-12" onClick={() => { setMode("reschedule"); setDate(managementDateForUI(booking.start_time)); setSelected(""); setNotice("") }}>Déplacer mon rendez-vous</Button>
            <Button variant="outline" className="min-h-12" onClick={() => { setMode("cancel"); setNotice("") }}>Annuler mon rendez-vous</Button>
          </div>}
          {allowed && mode === "cancel" && <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">Confirmer l’annulation ?</h2><p className="text-sm leading-6">Votre rendez-vous du {when(booking.start_time)} sera annulé et le créneau sera libéré.</p>
            {(booking.payment_status === "paid" || booking.payment_status === "partial") && <p className="text-sm leading-6">{MANAGEMENT_REFUND}</p>}
            <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => setMode("view")}>Garder mon rendez-vous</Button><Button variant="destructive" onClick={() => void change("cancel")}>{busy ? "Annulation…" : "Confirmer l’annulation"}</Button></div>
          </Card>}
          {allowed && mode === "reschedule" && <Card className="space-y-4 p-5">
            <div><h2 className="text-lg font-semibold">Choisir un nouvel horaire</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Même salon, mêmes soins, même équipe. Votre horaire actuel reste réservé jusqu’à la confirmation du nouveau.</p></div>
            <div className="space-y-2"><Label htmlFor="management-date">Nouvelle date</Label><Input id="management-date" type="date" min={booking.tomorrow} value={date} onChange={event => { setDate(event.target.value); setSelected("") }} /></div>
            {slotsQuery.isFetching && <p role="status" className="text-sm text-muted-foreground">Vérification des disponibilités…</p>}
            {slotsQuery.isError ? <div role="alert"><p className="text-sm">Impossible de charger les horaires. Votre rendez-vous actuel est conservé.</p><Button variant="outline" className="mt-2" onClick={() => void slotsQuery.refetch()}><RefreshCw className="h-4 w-4" />Réessayer</Button></div> : !slotsQuery.isFetching && date && slots.length === 0 ?
              <p role="status" className="rounded-lg border border-dashed p-4 text-sm leading-6">Aucun autre horaire disponible pour votre équipe ce jour. Essayez une autre date ou contactez le salon.</p> :
              <div className="grid grid-cols-3 gap-2" aria-label="Nouveaux créneaux disponibles">{slots.map(slot => <button type="button" key={slot.start} disabled={busy || slotsQuery.isFetching} aria-pressed={selected === slot.start} onClick={() => setSelected(slot.start)} className={`min-h-12 rounded-lg border px-2 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring ${selected === slot.start ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary"}`}>{selected === slot.start && <Check className="mr-1 inline h-3 w-3" aria-hidden="true" />}{time(slot.start)}</button>)}</div>}
            {chosen && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">Nouvel horaire : <strong>{when(chosen.start)}</strong> · {booking.duration_minutes} minutes.</p>}
            <div className="grid gap-2 sm:grid-cols-2"><Button variant="outline" onClick={() => setMode("view")}>Garder mon horaire actuel</Button><Button disabled={!chosen || slotsQuery.isFetching || slotsQuery.isError || busy} onClick={() => void change("reschedule")}>{busy ? "Confirmation…" : "Confirmer le déplacement"}</Button></div>
          </Card>}
        </fieldset>
        <Card className="space-y-3 p-5"><h2 className="font-semibold">Besoin d’aide ? Contactez le salon</h2><div className="flex flex-wrap gap-2">
          {booking.salon.phone && <Button asChild variant="outline"><a href={`tel:${booking.salon.phone.replace(/[^\d+]/g, "")}`}><Phone className="h-4 w-4" />Appeler le salon</a></Button>}
          {booking.salon.email && <Button asChild variant="outline"><a href={`mailto:${booking.salon.email}`}><Mail className="h-4 w-4" />Écrire au salon</a></Button>}
          {!booking.salon.phone && !booking.salon.email && <Button asChild variant="outline"><Link href="/nos-temples">Coordonnées des salons</Link></Button>}
        </div></Card>
        <p className="text-center text-xs text-muted-foreground">Ce lien est personnel. Ne le partagez pas.</p>
      </> : null}
    </div>
  </main>
}

const managementDateForUI = (instant: string) => formatInTimeZone(instant, "Europe/Paris", "yyyy-MM-dd")

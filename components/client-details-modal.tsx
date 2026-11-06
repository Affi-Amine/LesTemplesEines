"use client"

import { useQuery } from "@tanstack/react-query"
import { formatInTimeZone } from "date-fns-tz"
import { fr } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Phone } from "lucide-react"
import { fetchAPI } from "@/lib/api/client"
import { getStatusLabel } from "@/lib/utils"

interface ClientHistoryEntry {
  id: string
  start_time: string
  status: string
  payment_status?: string | null
  amount_paid_cents?: number | null
  service?: { name?: string | null; price_cents?: number | null } | null
  salon?: { name?: string | null } | null
  staff?: { first_name?: string | null; last_name?: string | null } | null
}

interface ClientDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: any | null
  onEdit?: () => void
  isOpeningEdit?: boolean
  /** Agenda: also load and show this client's bookings. */
  showHistory?: boolean
}

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)

function ClientHistory({ clientId }: { clientId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["client-file", clientId],
    queryFn: () => fetchAPI<{ appointments?: ClientHistoryEntry[] }>(`/clients/${clientId}?history=1`),
    staleTime: 30 * 1000,
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement de l’historique…</p>
  if (isError) return <p className="text-sm text-destructive">Historique indisponible.</p>

  const entries = data?.appointments || []
  if (!entries.length) return <p className="text-sm text-muted-foreground">Aucun rendez-vous enregistré.</p>

  const now = Date.now()
  const upcoming = entries.filter(entry => Date.parse(entry.start_time) >= now).reverse()
  const past = entries.filter(entry => Date.parse(entry.start_time) < now)

  const row = (entry: ClientHistoryEntry) => (
    <li key={entry.id} className="flex min-w-0 items-start justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">
          {formatInTimeZone(entry.start_time, "Europe/Paris", "EEE d MMM yyyy · HH:mm", { locale: fr })}
        </p>
        <p className="break-words text-xs text-muted-foreground">
          {[entry.service?.name || "Prestation", entry.salon?.name, [entry.staff?.first_name, entry.staff?.last_name].filter(Boolean).join(" ") || null]
            .filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium">{getStatusLabel(entry.status)}</p>
        {typeof entry.service?.price_cents === "number" && <p className="text-xs text-muted-foreground">{euros(entry.service.price_cents)}</p>}
      </div>
    </li>
  )

  return (
    <div className="space-y-3">
      {upcoming.length > 0 && <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">À venir</p>
        <ul className="max-h-40 overflow-y-auto">{upcoming.map(row)}</ul>
      </div>}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passés</p>
        {past.length ? <ul className="max-h-56 overflow-y-auto">{past.map(row)}</ul>
          : <p className="text-sm text-muted-foreground">Aucune visite passée.</p>}
      </div>
    </div>
  )
}

export function ClientDetailsModal({ open, onOpenChange, client, onEdit, isOpeningEdit, showHistory }: ClientDetailsModalProps) {
  if (!client) return null

  const displayName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.name
  const phone = client.phone
  const email = client.email
  const visitCount = client.visitCount ?? client.visit_count ?? 0
  const totalSpentCents = client.totalSpentCents ?? client.total_spent_cents ?? 0
  const totalSpentEuro = Math.round(totalSpentCents) / 100
  const lastVisitRaw = client.lastVisit ?? client.last_visit_date
  const lastVisit = lastVisitRaw ? new Date(lastVisitRaw).toLocaleDateString("fr-FR") : "—"
  const notes = "internal_notes" in client ? client.internal_notes : client.notes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words leading-snug">{displayName}</DialogTitle>
          <DialogDescription>Coordonnées et suivi de ce client</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations de contact */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Informations de contact</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${phone}`} className="min-w-0 break-all hover:text-primary">
                  {phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={email ? `mailto:${email}` : undefined} className="min-w-0 break-all hover:text-primary">
                  {email || "Email non renseigné"}
                </a>
              </div>
            </div>
          </Card>

          {/* Statistiques du client */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Statistiques du client</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Visites totales</p>
                <p className="text-2xl font-bold">{visitCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dépenses totales</p>
                <p className="text-2xl font-bold">€{totalSpentEuro.toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Dernière visite</p>
                <p className="text-sm">{lastVisit}</p>
              </div>
            </div>
          </Card>

          {/* Historique des rendez-vous */}
          {showHistory && client.id && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Historique</h3>
              <ClientHistory clientId={client.id} />
            </Card>
          )}

          {/* Notes */}
          {notes && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{notes}</p>
            </Card>
          )}

          {/* Actions */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            {onEdit && <Button onClick={onEdit} disabled={isOpeningEdit}>{isOpeningEdit ? "Ouverture…" : "Modifier la fiche"}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

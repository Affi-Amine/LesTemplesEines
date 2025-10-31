"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Phone } from "lucide-react"

interface ClientDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: any | null
}

export function ClientDetailsModal({ open, onOpenChange, client }: ClientDetailsModalProps) {
  if (!client) return null

  const displayName = client.name || `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
  const phone = client.phone
  const email = client.email
  const visitCount = client.visitCount ?? client.visit_count ?? 0
  const totalSpentCents = client.totalSpentCents ?? client.total_spent_cents ?? 0
  const totalSpentEuro = Math.round(totalSpentCents) / 100
  const lastVisitRaw = client.lastVisit ?? client.last_visit_date
  const lastVisit = lastVisitRaw ? new Date(lastVisitRaw).toLocaleDateString("fr-FR") : "—"
  const notes = client.notes ?? client.internal_notes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations de contact */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Informations de contact</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${phone}`} className="hover:text-primary">
                  {phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${email}`} className="hover:text-primary">
                  {email}
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

          {/* Notes */}
          {notes && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{notes}</p>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1">Envoyer un message</Button>
            <Button variant="outline" className="flex-1 bg-transparent">
              Modifier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

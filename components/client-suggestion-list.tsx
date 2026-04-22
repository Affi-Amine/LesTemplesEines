"use client"

import type { Client } from "@/lib/types/database"
import { Phone, Mail, CalendarClock, Wallet } from "lucide-react"

interface ClientSuggestionListProps {
  clients?: Client[]
  isLoading?: boolean
  visible: boolean
  onSelect: (client: Client) => void
}

export function ClientSuggestionList({
  clients,
  isLoading = false,
  visible,
  onSelect,
}: ClientSuggestionListProps) {
  if (!visible) return null

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-primary/15 bg-card shadow-sm">
        {isLoading ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Recherche en cours...
          </div>
        ) : clients && clients.length > 0 ? (
          <div className="max-h-72 overflow-y-auto">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="flex w-full flex-col gap-3 border-b px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/50"
                onClick={() => onSelect(client)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Client {client.loyalty_status === "vip" ? "VIP" : "enregistré"}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {client.visit_count} visite{client.visit_count > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="truncate">{client.phone || "Téléphone manquant"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="truncate">{client.email || "Email manquant"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <span>
                      {client.last_visit_date
                        ? `Dernière visite ${new Date(client.last_visit_date).toLocaleDateString("fr-FR")}`
                        : "Aucune visite récente"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span>{(client.total_spent_cents / 100).toFixed(2)}€ dépensés</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Aucun client trouvé. Continuez la saisie pour créer un nouveau client.
          </div>
        )}
      </div>
    </div>
  )
}

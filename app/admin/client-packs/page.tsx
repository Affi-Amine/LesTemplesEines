"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"
import type { ClientPack } from "@/lib/types/database"
import { toast } from "sonner"

export default function AdminClientPacksPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const { data: clientPacks, isLoading } = useQuery({
    queryKey: ["admin-client-packs", search],
    queryFn: () => fetchAPI<ClientPack[]>(`/client-packs${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  })

  const saveRemainingSessions = async (clientPack: ClientPack) => {
    try {
      const nextValue = Number(drafts[clientPack.id] ?? clientPack.remaining_sessions)
      await fetchAPI(`/client-packs/${clientPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({ remaining_sessions: nextValue }),
      })
      toast.success("Séances mises à jour.")
      queryClient.invalidateQueries({ queryKey: ["admin-client-packs"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de mettre à jour le forfait client.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Packs clients" description="Suivi des forfaits vendus, restants et consommés" />
      <div className="p-6 space-y-6">
        <Card className="p-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client ou un pack" />
        </Card>

        {isLoading ? (
          [1, 2].map((item) => <Card key={item} className="p-6 animate-pulse h-32" />)
        ) : (
          <div className="grid gap-4">
            {clientPacks?.map((clientPack) => (
              <Card key={clientPack.id} className="p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{clientPack.pack?.name || "Pack"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {clientPack.client?.first_name} {clientPack.client?.last_name} • {clientPack.client?.email || "Sans email"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Achat: {new Date(clientPack.purchase_date).toLocaleDateString("fr-FR")} • Statut: {clientPack.payment_status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      className="w-24"
                      value={drafts[clientPack.id] ?? String(clientPack.remaining_sessions)}
                      onChange={(e) => setDrafts((current) => ({ ...current, [clientPack.id]: e.target.value }))}
                    />
                    <Button onClick={() => saveRemainingSessions(clientPack)}>Ajuster</Button>
                  </div>
                </div>

                {clientPack.usages && clientPack.usages.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <p className="font-medium mb-3">Historique</p>
                    <div className="space-y-2 text-sm">
                      {clientPack.usages.map((usage) => (
                        <div key={usage.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <span>{usage.appointment?.service?.name || "Prestation"} • {usage.appointment?.salon?.name || "Salon"}</span>
                          <span className="text-muted-foreground">{new Date(usage.used_at).toLocaleString("fr-FR")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

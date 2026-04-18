"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchAPI } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import type { ClientPack } from "@/lib/types/database"

export default function MesForfaitsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsAuthenticated(Boolean(data.user))
    })
  }, [])

  const { data: clientPacks, isLoading } = useQuery({
    queryKey: ["my-client-packs"],
    queryFn: () => fetchAPI<ClientPack[]>("/client-packs/me"),
    enabled: isAuthenticated === true,
  })

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-serif font-bold">Mes forfaits</h1>
            <p className="text-muted-foreground">Retrouvez ici vos packs actifs et l'historique de vos séances consommées.</p>
          </div>

          {isAuthenticated === false ? (
            <Card className="p-8 space-y-4">
              <p>Connectez-vous pour consulter vos forfaits.</p>
              <Button asChild>
                <Link href="/login">Se connecter</Link>
              </Button>
            </Card>
          ) : isLoading || isAuthenticated === null ? (
            [1, 2].map((item) => (
              <Card key={item} className="p-6 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </Card>
            ))
          ) : clientPacks && clientPacks.length > 0 ? (
            <div className="grid gap-4">
              {clientPacks.map((clientPack) => (
                <Card key={clientPack.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{clientPack.pack?.name || "Forfait"}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acheté le {new Date(clientPack.purchase_date).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="text-lg font-semibold mt-3">
                        Restant : {clientPack.remaining_sessions} / {clientPack.total_sessions}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Statut paiement : {clientPack.payment_status}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/book?client_pack_id=${clientPack.id}`}>Réserver une séance</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <p className="mb-4">Aucun forfait acheté pour le moment.</p>
              <Button asChild>
                <Link href="/forfaits">Voir les forfaits</Link>
              </Button>
            </Card>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}

"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClientSearch } from "@/components/client-search"
import { ClientDetailsModal } from "@/components/client-details-modal"
import { clients } from "@/lib/mock-data"
import { Mail, Phone, TrendingUp } from "lucide-react"
import { useState, useMemo } from "react"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function ClientsPage() {
  const { t } = useTranslations()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<(typeof clients)[0] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filteredClients = useMemo(() => {
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone.includes(searchQuery),
    )
  }, [searchQuery])

  const handleClientClick = (client: (typeof clients)[0]) => {
    setSelectedClient(client)
    setModalOpen(true)
  }

  const totalRevenue = clients.reduce((sum, client) => sum + client.totalSpent, 0)
  const avgSpent = Math.round(totalRevenue / clients.length)

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title={t("admin.clients")} description={t("admin.clients")} />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_clients")}</p>
                <p className="text-3xl font-bold">{clients.length}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("admin.total_revenue")}</p>
                <p className="text-3xl font-bold">€{totalRevenue}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Average Spent</p>
                <p className="text-3xl font-bold">€{avgSpent}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <ClientSearch onSearch={setSearchQuery} />

        {/* Client List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <Card
                key={client.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleClientClick(client)}
              >
                <h3 className="font-semibold text-lg mb-2">{client.name}</h3>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${client.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">
                      {client.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <a
                      href={`mailto:${client.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-primary"
                    >
                      {client.email}
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4 p-3 bg-muted rounded">
                  <div>
                    <p className="text-muted-foreground text-xs">Visits</p>
                    <p className="font-semibold">{client.visitCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Spent</p>
                    <p className="font-semibold">€{client.totalSpent}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  {t("common.edit")}
                </Button>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">No clients found matching your search</p>
            </div>
          )}
        </div>
      </div>

      {/* Client Details Modal */}
      <ClientDetailsModal open={modalOpen} onOpenChange={setModalOpen} client={selectedClient} />
    </div>
  )
}

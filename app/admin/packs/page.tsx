"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchAPI } from "@/lib/api/client"
import type { Pack, Service } from "@/lib/types/database"
import { toast } from "sonner"

const installmentOptions = [1, 2, 3]

const emptyForm = {
  name: "",
  description: "",
  price: "0",
  number_of_sessions: "1",
  allowed_services: [] as string[],
  allowed_installments: [1] as number[],
  is_active: true,
}

export default function AdminPacksPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: packs, isLoading } = useQuery({
    queryKey: ["admin-packs"],
    queryFn: () => fetchAPI<Pack[]>("/packs"),
  })

  const { data: services } = useQuery({
    queryKey: ["admin-pack-services"],
    queryFn: () => fetchAPI<Service[]>("/services"),
  })

  useEffect(() => {
    if (!editingId) {
      setForm(emptyForm)
      return
    }

    const pack = packs?.find((item) => item.id === editingId)
    if (!pack) return

    setForm({
      name: pack.name,
      description: pack.description || "",
      price: String(pack.price),
      number_of_sessions: String(pack.number_of_sessions),
      allowed_services: pack.allowed_services,
      allowed_installments: pack.allowed_installments,
      is_active: pack.is_active,
    })
  }, [editingId, packs])

  const submitLabel = useMemo(() => editingId ? "Mettre à jour" : "Créer le pack", [editingId])

  const savePack = async () => {
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        number_of_sessions: Number(form.number_of_sessions),
      }

      if (editingId) {
        await fetchAPI(`/packs/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await fetchAPI("/packs", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }

      toast.success("Pack enregistré.")
      setEditingId(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible d'enregistrer le pack.")
    }
  }

  const toggleActive = async (pack: Pack) => {
    try {
      await fetchAPI(`/packs/${pack.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !pack.is_active }),
      })
      queryClient.invalidateQueries({ queryKey: ["admin-packs"] })
    } catch (error: any) {
      toast.error(error.message || "Impossible de modifier le statut.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Packs" description="Créer et gérer les forfaits vendus aux clients" />
      <div className="p-6 space-y-6">
        <Card className="p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Prix</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre de séances</Label>
              <Input type="number" min="1" value={form.number_of_sessions} onChange={(e) => setForm((current) => ({ ...current, number_of_sessions: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} rows={3} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Services autorisés</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {services?.map((service) => {
                const checked = form.allowed_services.includes(service.id)
                return (
                  <label key={service.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => setForm((current) => ({
                        ...current,
                        allowed_services: checked
                          ? current.allowed_services.filter((id) => id !== service.id)
                          : [...current.allowed_services, service.id],
                      }))}
                    />
                    <span>{service.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Paiements possibles</Label>
            <div className="flex gap-3">
              {installmentOptions.map((option) => {
                const checked = form.allowed_installments.includes(option)
                return (
                  <label key={option} className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => setForm((current) => ({
                        ...current,
                        allowed_installments: checked
                          ? current.allowed_installments.filter((value) => value !== option)
                          : [...current.allowed_installments, option].sort((a, b) => a - b),
                      }))}
                    />
                    <span>{option}x</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={savePack}>{submitLabel}</Button>
            {editingId && (
              <Button variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          {isLoading ? (
            [1, 2].map((item) => <Card key={item} className="p-6 animate-pulse h-28" />)
          ) : packs?.map((pack) => (
            <Card key={pack.id} className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{pack.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Number(pack.price).toFixed(2)}€ • {pack.number_of_sessions} séance(s)
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Installments: {pack.allowed_installments.join(", ")}x
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setEditingId(pack.id)}>Modifier</Button>
                  <Button variant={pack.is_active ? "secondary" : "default"} onClick={() => toggleActive(pack)}>
                    {pack.is_active ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

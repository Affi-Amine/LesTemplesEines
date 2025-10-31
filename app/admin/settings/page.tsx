"use client"

import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Paramètres" description="Gérer les paramètres de votre entreprise" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Business Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Informations de l'entreprise</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="business-name">Nom de l'entreprise</Label>
              <Input id="business-name" defaultValue="Les Temples" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-email">Email de l'entreprise</Label>
              <Input id="business-email" type="email" defaultValue="info@lestemplles.fr" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-phone">Téléphone de l'entreprise</Label>
              <Input id="business-phone" type="tel" defaultValue="+33 1 23 45 67 89" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-description">Description</Label>
              <Textarea
                id="business-description"
                defaultValue="Expérience de bien-être premium avec trois sanctuaires à travers la France"
                className="mt-2"
                rows={3}
              />
            </div>
            <Button>Sauvegarder les modifications</Button>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm">Notifications email pour les nouvelles réservations</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm">Rappels SMS pour les rendez-vous</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-sm">Rapports de performance hebdomadaires</span>
            </label>
          </div>
          <Button className="mt-4">Sauvegarder les préférences</Button>
        </Card>
      </div>
    </div>
  )
}

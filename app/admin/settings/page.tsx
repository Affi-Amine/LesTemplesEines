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
      <AdminHeader title="Settings" description="Manage your business settings" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Business Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Business Information</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="business-name">Business Name</Label>
              <Input id="business-name" defaultValue="Les Temples" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-email">Business Email</Label>
              <Input id="business-email" type="email" defaultValue="info@lestemplles.fr" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-phone">Business Phone</Label>
              <Input id="business-phone" type="tel" defaultValue="+33 1 23 45 67 89" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="business-description">Description</Label>
              <Textarea
                id="business-description"
                defaultValue="Premium wellness experience with three sanctuaries across France"
                className="mt-2"
                rows={3}
              />
            </div>
            <Button>Save Changes</Button>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm">Email notifications for new bookings</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm">SMS reminders for appointments</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" />
              <span className="text-sm">Weekly performance reports</span>
            </label>
          </div>
          <Button className="mt-4">Save Preferences</Button>
        </Card>
      </div>
    </div>
  )
}

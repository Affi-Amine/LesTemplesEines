"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Phone } from "lucide-react"

interface ClientDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: {
    id: string
    name: string
    phone: string
    email: string
    totalSpent: number
    visitCount: number
    lastVisit: string
    notes: string
  } | null
}

export function ClientDetailsModal({ open, onOpenChange, client }: ClientDetailsModalProps) {
  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${client.phone}`} className="hover:text-primary">
                  {client.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${client.email}`} className="hover:text-primary">
                  {client.email}
                </a>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Client Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Visits</p>
                <p className="text-2xl font-bold">{client.visitCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                <p className="text-2xl font-bold">€{client.totalSpent}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Last Visit</p>
                <p className="text-sm">{new Date(client.lastVisit).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {client.notes && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{client.notes}</p>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1">Send Message</Button>
            <Button variant="outline" className="flex-1 bg-transparent">
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

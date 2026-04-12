import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2 } from "lucide-react"
import { getStatusColor, getStatusLabel, type AppointmentStatus } from "@/lib/utils"
import { getPaymentMethodLabel, getPaymentStatusClass, getPaymentStatusLabel } from "@/lib/payments"

export interface AppointmentRow {
  id: string
  clientName: string
  service: string
  salon: string
  date: string
  time: string
  status: AppointmentStatus
  therapist: string
  payment_status?: "pending" | "paid" | "unpaid" | "failed" | "partial"
  payment_method?: string
  paid_at?: string | null
}

interface AppointmentsTableProps {
  appointments: AppointmentRow[]
  onView?: (appointment: AppointmentRow) => void
  onEdit?: (appointment: AppointmentRow) => void
  onDelete?: (appointment: AppointmentRow) => void
}

export function AppointmentsTable({ appointments, onView, onEdit, onDelete }: AppointmentsTableProps) {

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b">
            <tr>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Client</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Service</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Salon</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Date & Heure</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Thérapeute</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Statut</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Paiement</th>
              <th className="px-3 md:px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr key={apt.id} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-3 md:px-6 py-4 text-sm font-medium">{apt.clientName}</td>
                <td className="px-3 md:px-6 py-4 text-sm">{apt.service}</td>
                <td className="px-3 md:px-6 py-4 text-sm">{apt.salon}</td>
                <td className="px-3 md:px-6 py-4 text-sm">
                  {apt.date} à {apt.time}
                </td>
                <td className="px-3 md:px-6 py-4 text-sm">{apt.therapist}</td>
                <td className="px-3 md:px-6 py-4 text-sm">
                  <Badge className={getStatusColor(apt.status)}>
                    {getStatusLabel(apt.status)}
                  </Badge>
                </td>
                <td className="px-3 md:px-6 py-4 text-sm">
                  <div className="space-y-1">
                    <Badge variant="outline" className={getPaymentStatusClass(apt.payment_status)}>
                      {getPaymentStatusLabel(apt.payment_status)}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {getPaymentMethodLabel(apt.payment_method)}
                    </div>
                  </div>
                </td>
                <td className="px-3 md:px-6 py-4 text-sm">
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onView?.(apt)}
                      title="Voir les détails"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onEdit?.(apt)}
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onDelete?.(apt)}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

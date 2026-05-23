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
      <div className="divide-y md:hidden">
        {appointments.map((apt) => (
          <div key={apt.id} className="space-y-3 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{apt.clientName}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">{apt.service}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {apt.date} à {apt.time}
                </div>
              </div>
              <Badge className={`shrink-0 ${getStatusColor(apt.status)}`}>
                {getStatusLabel(apt.status)}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex min-w-0 justify-between gap-3">
                <span className="shrink-0">Salon</span>
                <span className="truncate text-right text-foreground">{apt.salon}</span>
              </div>
              <div className="flex min-w-0 justify-between gap-3">
                <span className="shrink-0">Thérapeute</span>
                <span className="truncate text-right text-foreground">{apt.therapist}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Paiement</span>
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className={getPaymentStatusClass(apt.payment_status)}>
                    {getPaymentStatusLabel(apt.payment_status)}
                  </Badge>
                  <span className="truncate text-xs">{getPaymentMethodLabel(apt.payment_method)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => onView?.(apt)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit?.(apt)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete?.(apt)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {appointments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Aucun rendez-vous</div>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
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

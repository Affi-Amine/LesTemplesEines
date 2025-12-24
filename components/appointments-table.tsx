import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2 } from "lucide-react"

interface Appointment {
  id: string
  clientName: string
  service: string
  salon: string
  date: string
  time: string
  status: "confirmed" | "cancelled" | "completed" | "no_show" | "blocked" | "in_progress"
  therapist: string
}

interface AppointmentsTableProps {
  appointments: Appointment[]
  onView?: (appointment: Appointment) => void
  onEdit?: (appointment: Appointment) => void
  onDelete?: (appointment: Appointment) => void
}

export function AppointmentsTable({ appointments, onView, onEdit, onDelete }: AppointmentsTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 hover:bg-green-200"
      case "cancelled":
        return "bg-red-100 text-red-800 hover:bg-red-200"
      case "completed":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200"
      case "no_show":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200"
      case "blocked":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
      case "in_progress":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmé"
      case "cancelled":
        return "Annulé"
      case "completed":
        return "Terminé"
      case "no_show":
        return "No Show"
      case "blocked":
        return "Bloqué"
      case "in_progress":
        return "En cours"
      default:
        return status
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Service</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Salon</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Date & Heure</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Thérapeute</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr key={apt.id} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{apt.clientName}</td>
                <td className="px-6 py-4 text-sm">{apt.service}</td>
                <td className="px-6 py-4 text-sm">{apt.salon}</td>
                <td className="px-6 py-4 text-sm">
                  {apt.date} à {apt.time}
                </td>
                <td className="px-6 py-4 text-sm">{apt.therapist}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge className={getStatusColor(apt.status)}>
                    {getStatusLabel(apt.status)}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
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

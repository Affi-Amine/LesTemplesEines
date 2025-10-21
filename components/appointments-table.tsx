import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2 } from "lucide-react"

interface Appointment {
  id: string
  clientName: string
  service: string
  date: string
  time: string
  status: "confirmed" | "pending" | "cancelled"
  therapist: string
}

interface AppointmentsTableProps {
  appointments: Appointment[]
}

export function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
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
              <th className="px-6 py-3 text-left text-sm font-semibold">Date & Time</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Therapist</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr key={apt.id} className="border-b hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{apt.clientName}</td>
                <td className="px-6 py-4 text-sm">{apt.service}</td>
                <td className="px-6 py-4 text-sm">
                  {apt.date} at {apt.time}
                </td>
                <td className="px-6 py-4 text-sm">{apt.therapist}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge className={getStatusColor(apt.status)}>
                    {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
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

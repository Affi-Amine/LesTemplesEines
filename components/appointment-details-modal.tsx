"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Phone, 
  Mail, 
  Clock, 
  Calendar, 
  MapPin, 
  DollarSign,
  FileText,
  Edit
} from "lucide-react"
import { format } from "date-fns"

interface AppointmentDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: {
    id: string
    start_time: string
    end_time: string
    status: string
    notes?: string
    client_notes?: string
    clients: {
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string
    }
    services: {
      id: string
      name: string
      duration_minutes: number
      price_cents: number
      category?: string
      description?: string
    }
    salons: {
      id: string
      name: string
      city: string
      address: string
    }
  } | null
}

export function AppointmentDetailsModal({ 
  isOpen, 
  onClose, 
  appointment 
}: AppointmentDetailsModalProps) {
  if (!appointment) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatTime = (dateTime: string) => {
    return format(new Date(dateTime), "HH:mm")
  }

  const formatDate = (dateTime: string) => {
    return format(new Date(dateTime), "EEEE, MMMM d, yyyy")
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ""}`
    }
    return `${mins}m`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Appointment Details</span>
            <Badge className={getStatusColor(appointment.status)}>
              {appointment.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date & Time
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Date:</span>
                <p className="font-medium">{formatDate(appointment.start_time)}</p>
              </div>
              <div>
                <span className="text-gray-600">Time:</span>
                <p className="font-medium">
                  {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Client Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Client Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {appointment.clients.first_name} {appointment.clients.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{appointment.clients.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{appointment.clients.email}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Service Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Service Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Service:</span>
                <p className="font-medium">{appointment.services.name}</p>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>
                <p className="font-medium">{formatDuration(appointment.services.duration_minutes)}</p>
              </div>
              <div>
                <span className="text-gray-600">Price:</span>
                <p className="font-medium flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  €{(appointment.services.price_cents / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </h3>
            <div className="text-sm">
              <p className="font-medium">{appointment.salons.name}</p>
              <p className="text-gray-600">{appointment.salons.address}</p>
              <p className="text-gray-600">{appointment.salons.city}</p>
            </div>
          </div>

          {/* Notes */}
          {(appointment.client_notes || appointment.notes) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Client Notes
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg text-sm">
                  {appointment.client_notes || appointment.notes}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Notes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
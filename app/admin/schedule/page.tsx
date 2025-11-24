"use client"

import { AdminHeader } from "@/components/admin-header"
import { CalendarView } from "@/components/calendar-view"
import { ScheduleView } from "@/components/schedule-view"
import { TherapistAvailability } from "@/components/therapist-availability"
import { appointments, employees } from "@/lib/mock-data"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SchedulePage() {
  // Mock therapist availability
  const therapistAvailability = employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    photo: emp.photo,
    specialties: emp.specialties,
    availability: [
      {
        date: new Date().toISOString().split("T")[0],
        slots: ["09:00", "10:00", "14:00", "15:00"],
      },
      {
        date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        slots: ["10:00", "11:00", "15:00", "16:00"],
      },
    ],
  }))

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Planification" description="Gérez les rendez-vous et la disponibilité des thérapeutes" />

      <div className="p-6 space-y-6">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList>
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="weekly">Vue hebdomadaire</TabsTrigger>
            <TabsTrigger value="availability">Disponibilité des thérapeutes</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <CalendarView
              appointments={appointments.map((apt) => ({
                id: apt.id,
                date: apt.date,
                time: apt.time,
                clientName: apt.clientName,
                service: "Massage Relaxant",
                status: apt.status,
              }))}
            />
          </TabsContent>

          <TabsContent value="weekly" className="mt-6">
            <ScheduleView
              appointments={appointments.map((apt) => ({
                id: apt.id,
                date: apt.date,
                time: apt.time,
                clientName: apt.clientName,
                service: "Massage Relaxant",
                therapist: "Sophie Martin",
                status: apt.status,
              }))}
            />
          </TabsContent>

          <TabsContent value="availability" className="mt-6">
            <TherapistAvailability therapists={therapistAvailability} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

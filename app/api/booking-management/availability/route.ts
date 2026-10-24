import { type NextRequest } from "next/server"
import { loadManagedAppointment, managedSlots, MANAGEMENT_COOKIE, ManagementError } from "@/lib/appointments/management"
import { limitManagementRequests, managementFailure, managementJSON } from "@/lib/appointments/management-http"

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("appointment_id")
    if (!id) throw new ManagementError("Rendez-vous manquant.")
    const session = await loadManagedAppointment(request.cookies.get(MANAGEMENT_COOKIE)?.value, id)
    limitManagementRequests(session.tokenHash)
    return managementJSON({ available_slots: await managedSlots(session, request.nextUrl.searchParams.get("date") || "") })
  } catch (error) { return managementFailure(error) }
}

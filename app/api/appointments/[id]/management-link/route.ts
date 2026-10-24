import { type NextRequest, NextResponse } from "next/server"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { loadAppointmentForManagementDelivery, sendManagementLinkToClient } from "@/lib/email/appointment-management"
import { managementBody, limitManagementRequests } from "@/lib/appointments/management-http"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
    if ("response" in auth) return auth.response
    await managementBody(request)
    const { id } = await context.params
    limitManagementRequests(`staff-link:${id}`, 3)
    await sendManagementLinkToClient(await loadAppointmentForManagementDelivery(id))
    return NextResponse.json({ message: "Le lien a été envoyé au client." }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’envoyer le lien." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
}

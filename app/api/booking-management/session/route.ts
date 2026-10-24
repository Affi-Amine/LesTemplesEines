import { type NextRequest } from "next/server"
import { z } from "zod"
import { loadManagedAppointment, managedAppointmentView, MANAGEMENT_COOKIE, MANAGEMENT_COOKIE_PATH, hashManagementToken } from "@/lib/appointments/management"
import { limitManagementRequests, managementBody, managementFailure, managementJSON } from "@/lib/appointments/management-http"

export async function POST(request: NextRequest) {
  try {
    limitManagementRequests(`session:${hashManagementToken(request.headers.get("x-forwarded-for") || "local")}`, 30)
    const { token } = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(await managementBody(request))
    const session = await loadManagedAppointment(token)
    const response = managementJSON(managedAppointmentView(session.appointment))
    response.cookies.set(MANAGEMENT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: MANAGEMENT_COOKIE_PATH, maxAge: 1800 })
    return response
  } catch (error) { return managementFailure(error) }
}

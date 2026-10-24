import type { Metadata } from "next"
import { AppointmentManagementPage } from "@/components/appointment-management-page"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Gérer mon rendez-vous | Les Temples", robots: { index: false, follow: false }, referrer: "no-referrer",
}

export default function Page() { return <AppointmentManagementPage /> }

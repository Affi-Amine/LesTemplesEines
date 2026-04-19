import { Suspense } from "react"
import ResetPasswordClientPage from "./reset-password-client-page"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ResetPasswordClientPage />
    </Suspense>
  )
}

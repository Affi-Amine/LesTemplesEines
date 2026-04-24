import { verifyToken, type JWTPayload } from "@/lib/auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

function extractAuthPayload(request: NextRequest): JWTPayload | null {
  const accessToken = request.cookies.get("accessToken")?.value
  const refreshToken = request.cookies.get("refreshToken")?.value

  if (accessToken) {
    const accessPayload = verifyToken(accessToken)
    if (accessPayload) {
      return accessPayload
    }
  }

  if (refreshToken) {
    const refreshPayload = verifyToken(refreshToken)
    if (refreshPayload) {
      return refreshPayload
    }
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice("Bearer ".length))
  }

  return null
}

export function requireStaffAuth(
  request: NextRequest,
  allowedRoles?: JWTPayload["role"][]
): { payload: JWTPayload } | { response: NextResponse } {
  const payload = extractAuthPayload(request)

  if (!payload) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { payload }
}

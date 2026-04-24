import { type NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for public routes and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  const isAdminArea = pathname.startsWith("/admin") && pathname !== "/admin/login"
  const isEmployeeArea = pathname.startsWith("/employee")

  if (isAdminArea || isEmployeeArea) {
    const hasAuthCookie =
      Boolean(request.cookies.get("accessToken")?.value) ||
      Boolean(request.cookies.get("refreshToken")?.value)

    if (!hasAuthCookie) {
      const loginUrl = new URL("/admin/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

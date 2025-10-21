import { createClient } from "@/lib/supabase/server"
import { verifyPassword } from "@/lib/auth/password"
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = LoginSchema.parse(body)

    const supabase = await createClient()

    // Get staff member by email
    const { data: staff, error } = await supabase.from("staff").select("*").eq("email", email).single()

    if (error || !staff) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, staff.password_hash)
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      staffId: staff.id,
      salonId: staff.salon_id,
      email: staff.email,
      role: staff.role,
    })

    const refreshToken = generateRefreshToken({
      staffId: staff.id,
      salonId: staff.salon_id,
      email: staff.email,
      role: staff.role,
    })

    // Set cookies
    const response = NextResponse.json(
      {
        success: true,
        staff: {
          id: staff.id,
          email: staff.email,
          first_name: staff.first_name,
          last_name: staff.last_name,
          role: staff.role,
          salon_id: staff.salon_id,
        },
      },
      { status: 200 },
    )

    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
    })

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

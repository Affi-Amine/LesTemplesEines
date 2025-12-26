import { createAdminClient } from "@/lib/supabase/admin"
import { verifyToken } from "@/lib/auth/jwt"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const accessToken = request.cookies.get("accessToken")?.value
    const refreshToken = request.cookies.get("refreshToken")?.value
    
    let payload = null

    // Try access token first
    if (accessToken) {
      payload = verifyToken(accessToken)
    }

    // If no valid access token, try refresh token
    if (!payload && refreshToken) {
      console.log("[Upload] Access token missing or invalid, trying refresh token")
      payload = verifyToken(refreshToken)
    }

    // Fallback: Check for Authorization header
    if (!payload) {
      const authHeader = request.headers.get("Authorization")
      if (authHeader && authHeader.startsWith("Bearer ")) {
         const bearerToken = authHeader.split(" ")[1]
         payload = verifyToken(bearerToken)
      }
    }

    console.log("[Upload] Cookies received:", request.cookies.getAll().map(c => c.name))
    console.log("[Upload] Auth result:", payload ? "Authenticated" : "Unauthorized", payload?.role)

    if (!payload) {
       console.log("[Upload] No valid token found")
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["admin", "manager"].includes(payload.role)) {
      console.log("[Upload] Forbidden role:", payload.role)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2. Parse FormData
    const formData = await request.formData()
    const file = formData.get("file") as File
    const bucketName = formData.get("bucketName") as string || "salon-images"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 3. Upload using Admin Client (Bypasses RLS)
    const supabase = await createAdminClient()
    
    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer()
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError)
      throw new Error(uploadError.message)
    }

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrl })

  } catch (error: any) {
    console.error("Upload API error:", error)
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
  }
}

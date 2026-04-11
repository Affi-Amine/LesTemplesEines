import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeGiftCardCode } from "@/lib/gift-cards"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const rawCode = request.nextUrl.searchParams.get("code")
    const code = normalizeGiftCardCode(rawCode || "")

    if (!code) {
      return NextResponse.json({ error: "Gift card code is required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: giftCard, error } = await supabase
      .from("gift_cards")
      .select(`
        *,
        service:services(
          *,
          service_salons!left(
            salon_id,
            salon:salons(id, name, slug, city, address, phone)
          )
        )
      `)
      .eq("code", code)
      .maybeSingle()

    if (error) throw error

    if (!giftCard) {
      return NextResponse.json({ error: "Carte cadeau introuvable" }, { status: 404 })
    }

    if (giftCard.status !== "active" || giftCard.used_at) {
      return NextResponse.json({ error: "Cette carte cadeau n'est plus valide" }, { status: 400 })
    }

    const service: any = giftCard.service

    return NextResponse.json({
      ...giftCard,
      service: service ? {
        ...service,
        salon_ids: service.service_salons?.map((relation: any) => relation.salon_id) || [],
        salons: service.service_salons?.map((relation: any) => relation.salon).filter(Boolean) || [],
      } : null,
    })
  } catch (error) {
    console.error("[gift-card] Validate error:", error)
    return NextResponse.json({ error: "Failed to validate gift card" }, { status: 500 })
  }
}

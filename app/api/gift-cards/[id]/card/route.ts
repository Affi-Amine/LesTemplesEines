export const runtime = "nodejs"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAuth } from "@/lib/auth/api-auth"
import { giftCardFileName, renderGiftCardImage } from "@/lib/email/gift-card-attachment"
import { loadGiftCardDesign } from "@/lib/gift-card-design-store"
import { NextRequest, NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/** The PNG of a sold gift card, to print or send again from the back office. */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
  if ("response" in auth) return auth.response
  try {
    const { id } = await context.params
    const supabase = createAdminClient()
    const { data: giftCard, error } = await supabase
      .from("gift_cards")
      .select("id, code, buyer_name, buyer_email, recipient_name, personal_message, purchased_at, service:services(name)")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!giftCard) return NextResponse.json({ error: "Carte cadeau introuvable" }, { status: 404 })
    const service = Array.isArray(giftCard.service) ? giftCard.service[0] : giftCard.service
    const png = await renderGiftCardImage(
      {
        buyerName: giftCard.buyer_name || giftCard.buyer_email,
        recipientName: giftCard.recipient_name,
        serviceName: service?.name || "Prestation",
        personalMessage: giftCard.personal_message,
        code: giftCard.code,
        purchasedAt: giftCard.purchased_at,
      },
      await loadGiftCardDesign(supabase)
    )
    const inline = request.nextUrl.searchParams.get("inline") === "1"
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${giftCardFileName(giftCard.code)}"`,
        "cache-control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[gift-cards] card render error:", error)
    return NextResponse.json({ error: "Failed to render gift card" }, { status: 500 })
  }
}

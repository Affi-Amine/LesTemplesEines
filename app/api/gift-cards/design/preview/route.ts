export const runtime = "nodejs"

import { requireStaffAuth } from "@/lib/auth/api-auth"
import { renderGiftCardImage } from "@/lib/email/gift-card-attachment"
import { GiftCardDesignSchema, resolveGiftCardDesign } from "@/lib/gift-card-design"
import { NextRequest, NextResponse } from "next/server"

/**
 * Live preview for the generator: the design comes in the body (unsaved
 * edits included), the sample card is rendered with fictitious names.
 */
export async function POST(request: NextRequest) {
  const auth = requireStaffAuth(request, ["admin", "manager", "receptionist"])
  if ("response" in auth) return auth.response
  try {
    const body = await request.json().catch(() => ({}))
    const design = GiftCardDesignSchema.safeParse(body?.design)
    const sample = (body?.sample && typeof body.sample === "object" ? body.sample : {}) as Record<string, unknown>
    const png = await renderGiftCardImage(
      {
        buyerName: typeof sample.buyerName === "string" && sample.buyerName ? sample.buyerName : "Camille Durand",
        recipientName: typeof sample.recipientName === "string" ? sample.recipientName : "Léa Martin",
        serviceName: typeof sample.serviceName === "string" && sample.serviceName ? sample.serviceName : "Massage Thaï aux huiles chaudes Solo 1H",
        personalMessage: typeof sample.personalMessage === "string" ? sample.personalMessage : "Un moment rien que pour toi. Joyeux anniversaire !",
        code: "ABCD1234EFGH",
      },
      design.success ? design.data : resolveGiftCardDesign(body?.design)
    )
    return new NextResponse(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "no-store" } })
  } catch (error) {
    console.error("[gift-cards] design preview error:", error)
    return NextResponse.json({ error: "Failed to render preview" }, { status: 500 })
  }
}

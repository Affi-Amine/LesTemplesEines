import Stripe from "stripe"

let stripeClient: Stripe | null = null

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY)
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    })
  }

  return stripeClient
}

export interface Salon {
  id: string
  name: string
  slug: string
  address: string
  city: string
  phone: string | null
  email: string | null
  siret: string | null
  image_url: string | null
  images: string[] // Array of image URLs for carousel display
  opening_hours: Record<string, { open: string; close: string }>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  salon_id: string | null
  salon_ids: string[]
  salons?: Pick<Salon, "id" | "name" | "slug" | "city">[]
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  category: string | null
  image_url: string | null
  is_visible: boolean
  is_active: boolean
  required_staff_count: number
  created_at: string
  updated_at: string
}

export interface Staff {
  id: string
  salon_id: string
  email: string
  password_hash: string
  first_name: string
  last_name: string
  gender: "male" | "female" | null
  phone: string | null
  role: "therapist" | "assistant" | "manager" | "admin" | "receptionist"
  photo_url: string | null
  specialties: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StaffAvailability {
  id: string
  staff_id: string
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  is_recurring: boolean
  specific_date: string | null
  created_at: string
}

export interface Client {
  id: string
  phone: string | null
  email: string | null
  auth_user_id?: string | null
  first_name: string
  last_name: string
  internal_notes: string | null
  loyalty_status: "regular" | "vip" | "inactive"
  total_spent_cents: number
  visit_count: number
  last_visit_date: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  salon_id: string
  client_id: string
  staff_id: string
  service_id: string
  start_time: string
  end_time: string
  status: "confirmed" | "pending" | "in_progress" | "completed" | "cancelled" | "no_show" | "blocked"
  client_notes: string | null
  internal_notes: string | null
  payment_status: "pending" | "paid" | "unpaid" | "failed" | "partial"
  payment_method: string | null
  amount_paid_cents: number
  paid_at: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  updated_at: string
  client?: Client | null
  staff?: Partial<Staff> | null
  service?: Service | null
  salon?: Partial<Salon> | null
}

export interface Payment {
  id: string
  appointment_id: string
  amount_cents: number
  method: "cash" | "card" | "check" | "other" | "treatwell" | "gift_card" | "pack" | "loyalty" | "stripe" | "on_site"
  reference: string | null
  notes: string | null
  recorded_by_staff_id: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  salon_id: string
  actor_id: string | null
  action_type: string
  entity_type: string
  entity_id: string | null
  changes: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface LoyaltyPoints {
  id: string
  client_id: string
  points_balance: number
  total_earned: number
  total_redeemed: number
  last_updated: string
}

export interface LoyaltyTransaction {
  id: string
  loyalty_id: string
  appointment_id: string | null
  transaction_type: "earned" | "redeemed" | "expired"
  points_amount: number
  created_at: string
}

export interface GiftCard {
  id: string
  code: string
  service_id: string
  service?: Service | null
  buyer_email: string
  recipient_email: string | null
  recipient_name: string | null
  personal_message: string | null
  amount_cents: number
  status: "active" | "used" | "cancelled"
  payment_status: "paid" | "unpaid"
  purchased_at: string
  paid_at: string | null
  used_at: string | null
  redeemed_appointment_id: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  updated_at: string
}

export interface Pack {
  id: string
  name: string
  description: string | null
  price: number
  number_of_sessions: number
  allowed_services: string[]
  allowed_installments: number[]
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface ClientPack {
  id: string
  client_id: string
  pack_id: string
  total_sessions: number
  remaining_sessions: number
  installment_count?: number
  paid_installments?: number
  purchase_date: string
  payment_status: "pending" | "active" | "partially_paid" | "paid" | "failed" | "cancelled"
  stripe_subscription_id: string | null
  stripe_subscription_schedule_id?: string | null
  stripe_checkout_session_id?: string | null
  created_at: string
  updated_at?: string
  pack?: Pack | null
  client?: Client | null
  usages?: ClientPackUsage[]
}

export interface ClientPackUsage {
  id: string
  client_pack_id: string
  appointment_id: string
  used_at: string
  created_at?: string
  appointment?: Appointment | null
}

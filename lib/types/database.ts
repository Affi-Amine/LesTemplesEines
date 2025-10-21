export interface Salon {
  id: string
  name: string
  slug: string
  address: string
  city: string
  phone: string | null
  email: string | null
  siret: string | null
  opening_hours: Record<string, { open: string; close: string }>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  salon_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  category: string | null
  image_url: string | null
  is_visible: boolean
  is_active: boolean
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
  phone: string | null
  role: "therapist" | "assistant" | "manager" | "admin"
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
  phone: string
  email: string | null
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
  status: "confirmed" | "pending" | "completed" | "cancelled" | "no_show"
  client_notes: string | null
  internal_notes: string | null
  payment_status: "unpaid" | "partial" | "paid"
  payment_method: string | null
  amount_paid_cents: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  appointment_id: string
  amount_cents: number
  method: "cash" | "card" | "check" | "other"
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

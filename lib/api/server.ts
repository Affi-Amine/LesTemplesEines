/**
 * Server-side Data Fetching Utilities
 * Use these functions in Server Components and API routes
 */

import { createClient } from "@/lib/supabase/server"

// Types
export type Salon = {
  id: string
  name: string
  slug: string
  city: string
  address: string
  phone: string
  email?: string
  description?: string
  photo_url?: string
  opening_hours?: Record<string, { open: string; close: string }>
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type Service = {
  id: string
  salon_id: string
  name: string
  description?: string
  duration_minutes: number
  price_cents: number
  category?: string
  photo_url?: string
  is_active: boolean
  created_at?: string
}

export type Staff = {
  id: string
  salon_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: 'therapist' | 'assistant' | 'manager' | 'admin'
  photo_url?: string
  specialties?: string[]
  is_active: boolean
  created_at?: string
}

/**
 * Fetch all active salons
 */
export async function getSalons(): Promise<Salon[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('[API] Error fetching salons:', error)
    return []
  }

  return data || []
}

/**
 * Fetch salon by ID or slug
 */
export async function getSalon(idOrSlug: string): Promise<Salon | null> {
  const supabase = await createClient()

  // Try by ID first, then by slug
  let query = supabase
    .from('salons')
    .select('*')
    .eq('is_active', true)

  // Check if it's a UUID
  if (idOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    query = query.eq('id', idOrSlug)
  } else {
    query = query.eq('slug', idOrSlug)
  }

  const { data, error } = await query.single()

  if (error) {
    console.error('[API] Error fetching salon:', error)
    return null
  }

  return data
}

/**
 * Fetch services for a specific salon (or all services)
 */
export async function getServices(salonId?: string): Promise<Service[]> {
  const supabase = await createClient()

  let query = supabase
    .from('services')
    .select('*')
    .eq('is_active', true)

  if (salonId) {
    query = query.eq('salon_id', salonId)
  }

  const { data, error } = await query.order('category').order('name')

  if (error) {
    console.error('[API] Error fetching services:', error)
    return []
  }

  return data || []
}

/**
 * Fetch staff members for a specific salon
 */
export async function getStaff(salonId?: string, role?: string): Promise<Staff[]> {
  const supabase = await createClient()

  let query = supabase
    .from('staff')
    .select('*')
    .eq('is_active', true)

  if (salonId) {
    query = query.eq('salon_id', salonId)
  }

  if (role) {
    query = query.eq('role', role)
  }

  const { data, error } = await query.order('first_name')

  if (error) {
    console.error('[API] Error fetching staff:', error)
    return []
  }

  return data || []
}

/**
 * Fetch therapists (staff with role='therapist') for a salon
 */
export async function getTherapists(salonId: string): Promise<Staff[]> {
  return getStaff(salonId, 'therapist')
}

/**
 * Format price from cents to euros
 */
export function formatPrice(priceCents: number): string {
  return `${(priceCents / 100).toFixed(2)} ¬`
}

/**
 * Format duration in minutes to human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`
}

import type { SupabaseClient } from "@supabase/supabase-js"
import { formatInTimeZone } from "date-fns-tz"

const TIMEZONE = "Europe/Paris"

export interface StaffLeave {
  id: string
  staff_id: string
  start_date: string
  end_date: string
  reason: string | null
  created_by: string | null
  created_at: string
}

/**
 * The staff among `staffIds` that are on leave during any Paris calendar day
 * touched by [startISO, endISO]. Leaves cover whole days, so an appointment
 * is refused as soon as one of its days falls inside a leave.
 *
 * Returns an empty set when the staff_leaves table is not deployed yet, so
 * the feature can ship before its migration runs.
 */
export async function getStaffOnLeave(
  supabase: SupabaseClient,
  staffIds: string[],
  startISO: string,
  endISO: string
): Promise<Set<string>> {
  if (!staffIds.length) return new Set()
  const from = formatInTimeZone(new Date(startISO), TIMEZONE, "yyyy-MM-dd")
  // The end bound is exclusive on bookings: 00:00 sharp still belongs to the previous day.
  const endMs = Date.parse(endISO)
  const to = formatInTimeZone(new Date(Math.max(endMs - 1, Date.parse(startISO))), TIMEZONE, "yyyy-MM-dd")
  return getStaffOnLeaveForDates(supabase, staffIds, from, to)
}

/** Same as getStaffOnLeave for a plain Paris date range [from, to] (yyyy-MM-dd, inclusive). */
export async function getStaffOnLeaveForDates(
  supabase: SupabaseClient,
  staffIds: string[],
  from: string,
  to: string = from
): Promise<Set<string>> {
  if (!staffIds.length) return new Set()
  const { data, error } = await supabase
    .from("staff_leaves")
    .select("staff_id")
    .in("staff_id", staffIds)
    .lte("start_date", to)
    .gte("end_date", from)
  if (error) {
    // 42P01: table missing (migration not run yet) — then no one is on leave.
    if (error.code === "42P01") return new Set()
    throw new Error(error.message)
  }
  return new Set((data || []).map((row) => row.staff_id as string))
}

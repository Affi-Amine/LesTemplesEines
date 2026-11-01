export type Platform = "planity" | "treatwell"

export const PLATFORM_LABELS: Record<Platform, string> = {
  planity: "Planity",
  treatwell: "Treatwell",
}

/**
 * The state compared between runs. Staff are the platform's own agenda-column
 * ids, sorted, so a reassignment on either side shows up as a difference.
 */
export interface BookingState {
  start: string
  end: string
  status: "active" | "cancelled"
  staff: string[]
}

export interface ExternalCustomer {
  name: string
  phone: string | null
  email: string | null
}

/** A booking as read from a platform, normalised. Times are UTC ISO strings. */
export interface ExternalBooking extends BookingState {
  externalId: string
  venueId: string
  serviceIds: string[]
  serviceNames: string[]
  priceCents: number
  customer: ExternalCustomer | null
  /** Created by this sync job rather than by a client or the salon. */
  isOurs: boolean
  updatedAt: number
  /** Whatever the adapter needs to write this booking back. */
  ref: Record<string, unknown>
}

export interface ExternalVenue {
  id: string
  name: string
  staff: { id: string; name: string }[]
  services: { id: string; name: string; durationMinutes: number; priceCents: number }[]
}

export interface PushBookingInput {
  externalId: string
  venueId: string
  start: string
  durationMinutes: number
  staff: string[]
  serviceId: string | null
  /** Shown on the platform when the service has no mapping. */
  title: string
  priceCents: number
  customer: { firstName: string; lastName: string; phone: string | null; email: string | null } | null
}

export interface PlatformAdapter {
  platform: Platform
  /** Signs in again with the stored credentials and replaces the saved session. Absent when a person has to sign in (Treatwell). */
  login?(): Promise<void>
  listVenues(): Promise<ExternalVenue[]>
  listBookings(venue: ExternalVenue, fromDay: string, toDay: string): Promise<ExternalBooking[]>
  /** Re-reads one booking (e.g. moved outside the window); null when it no longer exists. */
  getBooking(ref: Record<string, unknown>): Promise<ExternalBooking | null>
  /** Ids are reserved before the write so a crash can't leave an unlinked copy. */
  newBookingId(): string
  createBooking(input: PushBookingInput): Promise<Record<string, unknown>>
  updateBooking(ref: Record<string, unknown>, next: BookingState): Promise<Record<string, unknown>>
  cancelBooking(ref: Record<string, unknown>): Promise<void>
}

export class PlatformUnavailableError extends Error {
  constructor(public platform: Platform, message: string) {
    super(message)
  }
}

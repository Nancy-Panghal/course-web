// src/lib/workshops.ts
// Shared workshop helpers — single source of truth for spot counting and
// date formatting, used by the public page and the register/create-order routes.
import type { SupabaseClient } from '@supabase/supabase-js'

// An online checkout that was started but not paid holds a spot this long,
// then the spot is released to other registrants.
export const GATEWAY_HOLD_MINUTES = 30

/**
 * Spots currently held on a workshop:
 *  - every confirmed registration
 *  - every pending registration, EXCEPT abandoned gateway checkouts
 *    (payment_mode = 'gateway' with no attempt in the last GATEWAY_HOLD_MINUTES)
 * Pass excludeRegistrationId so a registrant retrying payment isn't
 * counted against themselves.
 */
export async function countHeldSpots(
  supabase: SupabaseClient,
  workshopId: string,
  excludeRegistrationId?: string
): Promise<number> {
  const cutoff = new Date(Date.now() - GATEWAY_HOLD_MINUTES * 60 * 1000).toISOString()

  let confirmedQuery = supabase
    .from('workshop_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', workshopId)
    .eq('payment_status', 'confirmed')
  if (excludeRegistrationId) confirmedQuery = confirmedQuery.neq('id', excludeRegistrationId)
  const { count: confirmed, error: confirmedError } = await confirmedQuery
  if (confirmedError) throw confirmedError

  let pendingQuery = supabase
    .from('workshop_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', workshopId)
    .eq('payment_status', 'pending_confirmation')
    .or(`payment_mode.neq.gateway,payment_attempted_at.gte.${cutoff}`)
  if (excludeRegistrationId) pendingQuery = pendingQuery.neq('id', excludeRegistrationId)
  const { count: pending, error: pendingError } = await pendingQuery
  if (pendingError) throw pendingError

  return (confirmed || 0) + (pending || 0)
}

// e.g. "Sat, 4 Oct, 6:30 pm" — always IST, regardless of server timezone.
export function formatWorkshopDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}
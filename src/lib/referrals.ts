// src/lib/referrals.ts
// Student referral links for workshops.
//
// Rules (keep in sync with the SQL in the referral migration):
//  - A referral code is minted ONLY for a CONFIRMED registration (free, or
//    paid + confirmed) — one code per registration, never re-minted.
//  - A code only works on the workshop it was minted for.
//  - A "conversion" is not stored anywhere: it is simply a registration whose
//    referred_by_code_id points at a code AND whose payment_status is
//    'confirmed'. Counting it live means it can never drift out of sync.
//  - Nothing in here may ever block a registration or a payment — callers
//    treat every failure as "no referral", and log it.
import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// No 0/O/1/I/L — codes get read aloud and typed from screenshots.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const MAX_INSERT_ATTEMPTS = 5

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** Normalises whatever came in the ?ref= param. Returns null if it can't be a code. */
export function cleanReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z0-9]{6,12}$/.test(code) ? code : null
}

export function buildReferralLink(creatorSlug: string, workshopSlug: string, code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kurso.in').replace(/\/$/, '')
  return `${base}/w/${creatorSlug}/${workshopSlug}?ref=${code}`
}

/**
 * Turns a ?ref= value into a referral_codes id for THIS workshop, or null.
 * Null (silently) when: malformed, unknown, minted for a different workshop,
 * or the registrant is the code's own owner (same phone — no self-referral).
 * Never throws.
 */
export async function resolveReferralCodeId(
  supabase: SupabaseClient,
  workshopId: string,
  rawRef: unknown,
  registrantPhone: string
): Promise<string | null> {
  const code = cleanReferralCode(rawRef)
  if (!code) return null
  try {
    const { data: row } = await supabase
      .from('workshop_referral_codes')
      .select('id, registration_id')
      .eq('code', code)
      .eq('workshop_id', workshopId)
      .maybeSingle()
    if (!row) return null

    const { data: owner } = await supabase
      .from('workshop_registrations')
      .select('phone')
      .eq('id', row.registration_id)
      .maybeSingle()
    if (owner?.phone === registrantPhone) return null

    return row.id
  } catch (err) {
    console.error('[referrals] resolveReferralCodeId failed:', err)
    return null
  }
}

async function findCodeForRegistration(supabase: SupabaseClient, registrationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workshop_referral_codes')
    .select('code')
    .eq('registration_id', registrationId)
    .maybeSingle()
  if (error) throw error
  return data?.code ?? null
}

/**
 * Idempotent: returns this registration's referral code + shareable link,
 * minting the code the first time. Returns null if the registration doesn't
 * exist or isn't confirmed yet. Safe under concurrent calls (the unique
 * constraint on registration_id decides the winner).
 * Throws on unexpected DB errors — callers wrap it.
 */
export async function getOrCreateReferralLink(
  supabase: SupabaseClient,
  registrationId: string
): Promise<{ code: string; link: string } | null> {
  const { data: reg, error } = await supabase
    .from('workshop_registrations')
    .select('id, workshop_id, payment_status, workshops!inner(slug, creator_id)')
    .eq('id', registrationId)
    .maybeSingle()
  if (error) throw error

  const rawWorkshop = (reg as any)?.workshops
  const workshop = Array.isArray(rawWorkshop) ? rawWorkshop[0] : rawWorkshop
  if (!reg || !workshop || reg.payment_status !== 'confirmed') return null

  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select('creator_slug')
    .eq('id', workshop.creator_id)
    .maybeSingle()
  if (creatorError) throw creatorError
  if (!creator?.creator_slug) return null

  let code = await findCodeForRegistration(supabase, registrationId)

  for (let attempt = 0; !code && attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const { data: inserted, error: insertError } = await supabase
      .from('workshop_referral_codes')
      .insert({ workshop_id: reg.workshop_id, registration_id: registrationId, code: generateCode() })
      .select('code')
      .single()

    if (!insertError) { code = inserted.code; break }
    if (insertError.code !== '23505') throw insertError
    // 23505 = either a concurrent call already minted this registration's code,
    // or (very rarely) the random code collided. Re-check, then retry.
    code = await findCodeForRegistration(supabase, registrationId)
  }

  if (!code) throw new Error('Could not allocate a referral code')
  return { code, link: buildReferralLink(creator.creator_slug, workshop.slug, code) }
}
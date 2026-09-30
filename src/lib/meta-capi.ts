// src/lib/meta-capi.ts
//
// Meta Conversions API (CAPI) — server-to-server events for the workshop flow.
// Deliberately small and DB-free: everything here is either a pure function
// (payload building, hashing, validation) or a single network call that NEVER
// throws. The database side lives in lib/workshop-meta-events.ts.
//
// Why so strict: a wrong Purchase event (zero value, wrong currency, sent
// twice, sent for an unpaid registration) quietly teaches the creator's ad
// account to optimise for the wrong thing. So buildEvent() refuses to build
// anything that isn't clearly correct, and the caller records the refusal.
//
// Unit tests: `npm run test:capi` (src/lib/meta-capi.test.mjs).
import { createHash } from 'crypto'

// Meta retires old Graph versions after roughly two years. Override with the
// META_GRAPH_VERSION env var when you want to move without a deploy.
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = 'https://graph.facebook.com'

// Meta rejects the WHOLE request if event_time is more than 7 days old.
// Stay clear of that edge.
export const MAX_EVENT_AGE_SECONDS = 6 * 24 * 60 * 60
const MAX_FUTURE_SKEW_SECONDS = 5 * 60

export type MetaEventName = 'Lead' | 'Purchase'

/** Thrown by buildEvent() when an event would be wrong to send. */
export class MetaEventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetaEventError'
  }
}

export interface MetaUserInput {
  email?: string | null
  phone?: string | null // any format — normalised here (India assumed for bare 10-digit numbers)
  name?: string | null
  externalId?: string | null
  fbp?: string | null // _fbp cookie
  fbc?: string | null // _fbc cookie (or built from fbclid)
  clientIp?: string | null
  clientUserAgent?: string | null
}

export interface MetaEventInput {
  eventName: MetaEventName
  eventId: string // MUST match the browser Pixel's eventID for deduplication
  eventTime: number // unix seconds
  eventSourceUrl: string
  user: MetaUserInput
  contentName?: string | null
  contentId?: string | null
  orderId?: string | null
  value?: number | null // Purchase only — required and > 0
  currency?: string | null // Purchase only — defaults to INR
}

export interface MetaServerEvent {
  event_name: MetaEventName
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url: string
  user_data: Record<string, string | string[]>
  custom_data: Record<string, string | number | string[]>
}

// ─── Identifiers ────────────────────────────────────────────────────────────

export function isValidPixelId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{8,20}$/.test(value)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

// ─── Normalisation (Meta's hashing rules: normalise FIRST, then SHA-256) ────

export function normalizeEmailForMeta(raw: string | null | undefined): string | null {
  const email = String(raw ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// Meta wants digits only, WITH country code, no "+" and no leading zeros.
// The platform stores bare 10-digit Indian numbers, so those get "91" added.
export function normalizePhoneForMeta(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length === 10) return '91' + digits
  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}

function normalizeNamePart(raw: string | null | undefined): string | null {
  const cleaned = String(raw ?? '').toLowerCase().replace(/[^\p{L}]/gu, '')
  return cleaned || null
}

export function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  return {
    first: normalizeNamePart(parts[0]),
    last: parts.length > 1 ? normalizeNamePart(parts[parts.length - 1]) : null,
  }
}

// Values below come from a public request, so shape-check them and drop
// anything that doesn't look right instead of forwarding garbage to Meta.
export function sanitizeFbp(raw: unknown): string | null {
  return typeof raw === 'string' && /^fb\.[0-2]\.\d{10,13}\.\d{1,20}$/.test(raw) ? raw : null
}

export function sanitizeFbc(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length <= 300 && /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_\-]+$/.test(raw)
    ? raw
    : null
}

export function sanitizeIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const first = raw.split(',')[0].trim()
  return first.length > 0 && first.length <= 45 && /^[0-9a-fA-F:.]+$/.test(first) ? first : null
}

export function sanitizeUserAgent(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 500) : null
}

// ─── Payload building ───────────────────────────────────────────────────────

export function buildUserData(user: MetaUserInput): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}

  const em = normalizeEmailForMeta(user.email)
  if (em) out.em = [sha256(em)]

  const ph = normalizePhoneForMeta(user.phone)
  if (ph) out.ph = [sha256(ph)]

  const { first, last } = splitName(user.name)
  if (first) out.fn = [sha256(first)]
  if (last) out.ln = [sha256(last)]

  if (user.externalId) out.external_id = [sha256(String(user.externalId))]
  out.country = [sha256('in')]

  // These four are sent RAW — Meta needs them unhashed.
  const fbp = sanitizeFbp(user.fbp)
  if (fbp) out.fbp = fbp
  const fbc = sanitizeFbc(user.fbc)
  if (fbc) out.fbc = fbc
  const ip = sanitizeIp(user.clientIp)
  if (ip) out.client_ip_address = ip
  const ua = sanitizeUserAgent(user.clientUserAgent)
  if (ua) out.client_user_agent = ua

  return out
}

export function buildEvent(
  input: MetaEventInput,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): MetaServerEvent {
  if (input.eventName !== 'Lead' && input.eventName !== 'Purchase') {
    throw new MetaEventError(`Unsupported event name: ${String(input.eventName)}`)
  }
  if (!input.eventId || typeof input.eventId !== 'string') {
    throw new MetaEventError('event_id is required (it is what deduplicates against the browser Pixel)')
  }
  if (!Number.isInteger(input.eventTime)) {
    throw new MetaEventError('event_time must be a whole number of seconds since epoch')
  }
  if (input.eventTime < nowSeconds - MAX_EVENT_AGE_SECONDS) {
    throw new MetaEventError('event_time is too old — Meta rejects events older than 7 days')
  }
  if (input.eventTime > nowSeconds + MAX_FUTURE_SKEW_SECONDS) {
    throw new MetaEventError('event_time is in the future')
  }
  if (!/^https?:\/\//.test(input.eventSourceUrl || '')) {
    throw new MetaEventError('event_source_url must start with http:// or https://')
  }

  const user_data = buildUserData(input.user)
  if (!user_data.em && !user_data.ph && !user_data.external_id && !user_data.fbp && !user_data.fbc) {
    throw new MetaEventError('at least one customer identifier is required')
  }

  const custom_data: Record<string, string | number | string[]> = {}
  if (input.contentName) custom_data.content_name = String(input.contentName).slice(0, 200)
  custom_data.content_category = 'workshop'

  if (input.eventName === 'Purchase') {
    const value = input.value
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new MetaEventError('Purchase requires a numeric value greater than 0')
    }
    const currency = String(input.currency || 'INR').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new MetaEventError('Purchase currency must be a 3-letter ISO code')
    }
    custom_data.value = Math.round(value * 100) / 100
    custom_data.currency = currency
    custom_data.content_type = 'product'
    custom_data.num_items = 1
    if (input.contentId) custom_data.content_ids = [String(input.contentId)]
    if (input.orderId) custom_data.order_id = String(input.orderId)
  }
  // Lead deliberately carries NO value/currency: a "Lead worth ₹999" would
  // teach value-based bidding that a free signup equals a sale.

  return {
    event_name: input.eventName,
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: 'website',
    event_source_url: input.eventSourceUrl,
    user_data,
    custom_data,
  }
}

/**
 * The value to report for a workshop Purchase, or null when NO Purchase may
 * be sent. A Purchase needs: a CONFIRMED registration, a paid mode (never
 * 'free'), and a real amount > 0 — the online amount actually paid if we
 * have it, otherwise the workshop price (manual UPI, confirmed by the creator).
 */
export function workshopPurchaseValue(
  reg: { payment_status?: string | null; payment_mode?: string | null; amount_paid?: number | string | null },
  workshopPrice: number | string | null | undefined
): number | null {
  if (reg.payment_status !== 'confirmed') return null
  if (reg.payment_mode !== 'upi_manual' && reg.payment_mode !== 'gateway') return null
  const paid = Number(reg.amount_paid)
  const value = Number.isFinite(paid) && paid > 0 ? paid : Number(workshopPrice)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function buildRequestBody(args: {
  events: MetaServerEvent[]
  accessToken: string
  testEventCode?: string | null
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    data: args.events,
    // Token travels in the POST body, never in the URL, so it can't leak
    // into request logs.
    access_token: args.accessToken,
  }
  if (args.testEventCode) body.test_event_code = args.testEventCode
  return body
}

// ─── Network ────────────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean
  status?: number
  error?: string
  fbtraceId?: string
}

function metaErrorText(json: any, status: number): { error: string; fbtraceId?: string } {
  const e = json?.error
  const message = e?.error_user_msg || e?.message || `HTTP ${status}`
  return { error: String(message).slice(0, 400), fbtraceId: e?.fbtrace_id }
}

/**
 * Sends ONE event. Never throws. Retries once on a network error/timeout or a
 * 5xx (Meta's side); a 4xx is a real rejection and is returned as-is.
 */
export async function sendMetaEvent(args: {
  pixelId: string
  accessToken: string
  event: MetaServerEvent
  testEventCode?: string | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
  retryDelayMs?: number
}): Promise<SendResult> {
  const doFetch = args.fetchImpl ?? fetch
  const timeoutMs = args.timeoutMs ?? 4000
  const url = `${GRAPH_BASE}/${META_GRAPH_VERSION}/${args.pixelId}/events`
  const body = JSON.stringify(
    buildRequestBody({ events: [args.event], accessToken: args.accessToken, testEventCode: args.testEventCode })
  )

  let last: SendResult = { ok: false, error: 'not attempted' }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      const json: any = await res.json().catch(() => null)
      if (res.ok && Number(json?.events_received ?? 0) >= 1) return { ok: true, status: res.status }
      const { error, fbtraceId } = metaErrorText(json, res.status)
      last = { ok: false, status: res.status, error: res.ok ? 'Meta accepted the request but received 0 events' : error, fbtraceId }
      if (res.status < 500) return last
    } catch (err: any) {
      last = { ok: false, error: err?.name === 'AbortError' ? 'Request to Meta timed out' : `Network error: ${err?.message || err}` }
    } finally {
      clearTimeout(timer)
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, args.retryDelayMs ?? 500))
  }
  return last
}

/**
 * Confirms a token can actually see the pixel, using a READ call — nothing is
 * sent to the pixel, so it can't pollute the creator's data.
 */
export async function verifyPixelAccess(args: {
  pixelId: string
  accessToken: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<{ ok: true; name: string | null } | { ok: false; kind: 'invalid' | 'network'; error: string }> {
  const doFetch = args.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 6000)
  try {
    // Token goes in the Authorization header, never in the URL.
    const url = `${GRAPH_BASE}/${META_GRAPH_VERSION}/${args.pixelId}?fields=id,name`
    const res = await doFetch(url, {
      headers: { Authorization: `Bearer ${args.accessToken}` },
      signal: controller.signal,
    })
    const json: any = await res.json().catch(() => null)
    if (res.ok && json?.id) return { ok: true, name: json.name ?? null }
    if (res.status >= 500) return { ok: false, kind: 'network', error: 'Meta is having trouble right now. Please try again in a minute.' }
    return { ok: false, kind: 'invalid', error: metaErrorText(json, res.status).error }
  } catch (err: any) {
    return {
      ok: false,
      kind: 'network',
      error: err?.name === 'AbortError' ? 'Meta took too long to respond. Please try again.' : 'Could not reach Meta. Please try again.',
    }
  } finally {
    clearTimeout(timer)
  }
}
// src/lib/workshop-meta-events.ts
//
// Database side of Meta Conversions API for workshops. The payload rules live
// in lib/meta-capi.ts (pure + unit-tested); this file decides WHEN to send,
// makes sure each event is sent at most once, and records the outcome.
//
// Guarantees:
//  - Nothing here ever throws into a request. Everything runs AFTER the
//    response is sent (Next's after()), so a slow or failing Meta can never
//    block or break a registration or a payment.
//  - One Lead and one Purchase per registration, ever: the (registration_id,
//    event_name) unique key is claimed BEFORE sending.
//  - Every outcome is written to workshop_meta_events (sent / failed /
//    skipped + reason) so the creator can see problems and retry failures.
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/creator-secrets'
import {
  buildEvent, sendMetaEvent, workshopPurchaseValue, MetaEventError, MAX_EVENT_AGE_SECONDS,
  sanitizeFbp, sanitizeFbc, sanitizeIp, sanitizeUserAgent,
  type MetaEventName,
} from '@/lib/meta-capi'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_ATTEMPTS = 5
const STALE_PENDING_MS = 10 * 60 * 1000
const RETRY_BATCH = 10

// Deterministic, so the browser Pixel can use the SAME id for deduplication.
export const leadEventId = (registrationId: string) => `ws_lead_${registrationId}`
export const purchaseEventId = (registrationId: string) => `ws_purchase_${registrationId}`

const siteBase = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://kurso.in').replace(/\/$/, '')

// ─── Browser context (read from the public request, shape-checked) ──────────

export interface MetaRequestContext {
  fbp: string | null
  fbc: string | null
  clientIp: string | null
  clientUserAgent: string | null
}

export function getMetaRequestContext(req: NextRequest): MetaRequestContext {
  return {
    fbp: sanitizeFbp(req.cookies.get('_fbp')?.value),
    fbc: sanitizeFbc(req.cookies.get('_fbc')?.value),
    clientIp: sanitizeIp(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')),
    clientUserAgent: sanitizeUserAgent(req.headers.get('user-agent')),
  }
}

// ─── Creator config ─────────────────────────────────────────────────────────

export interface CreatorMetaConfig {
  pixelId: string
  accessToken: string | null
  testEventCode: string | null
}

export async function getCreatorMetaConfig(creatorId: string): Promise<CreatorMetaConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_meta_settings')
    .select('pixel_id, capi_access_token_enc, test_event_code')
    .eq('creator_id', creatorId)
    .maybeSingle()
  if (error) throw error
  if (!data?.pixel_id) return null

  let accessToken: string | null = null
  if (data.capi_access_token_enc) {
    try {
      accessToken = decryptSecret(data.capi_access_token_enc)
    } catch (err) {
      console.error('[meta-events] could not decrypt CAPI token for creator', creatorId, err)
    }
  }
  return { pixelId: data.pixel_id, accessToken, testEventCode: data.test_event_code || null }
}

// ─── Loading everything one event needs ─────────────────────────────────────

interface EventSource {
  reg: {
    id: string; name: string | null; email: string | null; phone: string | null
    payment_mode: string | null; payment_status: string | null; amount_paid: number | null
    created_at: string; confirmed_at: string | null; meta_context: Record<string, string | null> | null
  }
  workshop: { id: string; title: string; slug: string; price: number; creator_id: string }
  creatorSlug: string
  cfg: CreatorMetaConfig & { accessToken: string }
}

// Returns null when there is nothing to send: unknown registration, or the
// creator hasn't set up BOTH a pixel and a CAPI token.
async function loadSource(registrationId: string): Promise<EventSource | null> {
  const { data: reg, error } = await supabaseAdmin
    .from('workshop_registrations')
    .select('id, name, email, phone, payment_mode, payment_status, amount_paid, created_at, confirmed_at, meta_context, workshops!inner(id, title, slug, price, creator_id)')
    .eq('id', registrationId)
    .maybeSingle()
  if (error) throw error

  const rawWorkshop = (reg as any)?.workshops
  const workshop = Array.isArray(rawWorkshop) ? rawWorkshop[0] : rawWorkshop
  if (!reg || !workshop) return null

  const { data: creator, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('creator_slug')
    .eq('id', workshop.creator_id)
    .maybeSingle()
  if (creatorError) throw creatorError
  if (!creator?.creator_slug) return null

  const cfg = await getCreatorMetaConfig(workshop.creator_id)
  if (!cfg || !cfg.accessToken) return null

  const { workshops: _omit, ...regFields } = reg as any
  return { reg: regFields, workshop, creatorSlug: creator.creator_slug, cfg: { ...cfg, accessToken: cfg.accessToken } }
}

// ─── Delivery ───────────────────────────────────────────────────────────────

interface EventRow {
  id: string
  event_name: MetaEventName
  event_id: string
  event_time: string
  attempts: number
}

// Builds, sends, and records the outcome. Never throws.
async function deliver(row: EventRow, src: EventSource): Promise<'sent' | 'failed' | 'skipped'> {
  let status: 'sent' | 'failed' | 'skipped'
  let lastError: string | null = null

  try {
    const ctx = src.reg.meta_context || {}
    const isPurchase = row.event_name === 'Purchase'
    const event = buildEvent({
      eventName: row.event_name,
      eventId: row.event_id,
      eventTime: Math.floor(new Date(row.event_time).getTime() / 1000),
      eventSourceUrl: `${siteBase()}/w/${src.creatorSlug}/${src.workshop.slug}`,
      user: {
        email: src.reg.email,
        phone: src.reg.phone,
        name: src.reg.name,
        externalId: src.reg.id,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
        clientIp: ctx.clientIp,
        clientUserAgent: ctx.clientUserAgent,
      },
      contentName: src.workshop.title,
      contentId: src.workshop.id,
      orderId: isPurchase ? src.reg.id : null,
      value: isPurchase ? workshopPurchaseValue(src.reg, src.workshop.price) : null,
    })

    const result = await sendMetaEvent({
      pixelId: src.cfg.pixelId,
      accessToken: src.cfg.accessToken,
      event,
      testEventCode: src.cfg.testEventCode,
    })
    if (result.ok) {
      status = 'sent'
    } else {
      status = 'failed'
      lastError = `${result.error || 'Meta rejected the event'}${result.fbtraceId ? ` (trace ${result.fbtraceId})` : ''}`
    }
  } catch (err: any) {
    if (err instanceof MetaEventError) {
      // Refused on purpose (wrong/unsafe to send) — not retried.
      status = 'skipped'
      lastError = err.message
    } else {
      status = 'failed'
      lastError = `Unexpected error: ${err?.message || err}`
    }
  }

  try {
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('workshop_meta_events')
      .update({
        status,
        attempts: row.attempts + 1,
        last_error: lastError ? lastError.slice(0, 500) : null,
        sent_at: status === 'sent' ? now : null,
        updated_at: now,
      })
      .eq('id', row.id)
  } catch (err) {
    console.error('[meta-events] could not record outcome for', row.id, err)
  }
  if (status !== 'sent') console.error(`[meta-events] ${row.event_name} ${status} for event ${row.event_id}: ${lastError}`)
  return status
}

async function queueWorkshopMetaEvent(args: {
  registrationId: string
  eventName: MetaEventName
  context?: MetaRequestContext
}): Promise<void> {
  try {
    const src = await loadSource(args.registrationId)
    if (!src) return

    if (args.eventName === 'Purchase' && workshopPurchaseValue(src.reg, src.workshop.price) === null) return

    const eventTime = args.eventName === 'Lead'
      ? src.reg.created_at
      : src.reg.confirmed_at || new Date().toISOString()

    // Claim: the unique (registration_id, event_name) key means this event is
    // only ever sent by one caller, however many times we get called.
    const { data: row, error } = await supabaseAdmin
      .from('workshop_meta_events')
      .insert({
        registration_id: args.registrationId,
        workshop_id: src.workshop.id,
        creator_id: src.workshop.creator_id,
        event_name: args.eventName,
        event_id: args.eventName === 'Lead' ? leadEventId(args.registrationId) : purchaseEventId(args.registrationId),
        event_time: eventTime,
        status: 'pending',
        attempts: 0,
      })
      .select('id, event_name, event_id, event_time, attempts')
      .single()
    if (error || !row) {
      if (error && error.code !== '23505') console.error('[meta-events] claim failed:', error.message)
      return
    }

    // Remember the browser's cookies/IP/UA so the LATER Purchase (sent when
    // the creator confirms payment, from a different request) can still be
    // matched to the ad click.
    if (args.eventName === 'Lead' && args.context) {
      const merged = { ...(src.reg.meta_context || {}), ...args.context }
      const { error: ctxError } = await supabaseAdmin
        .from('workshop_registrations')
        .update({ meta_context: merged })
        .eq('id', args.registrationId)
      if (ctxError) console.error('[meta-events] could not store browser context:', ctxError.message)
      src.reg.meta_context = merged
    }

    await deliver(row as EventRow, src)
  } catch (err) {
    console.error('[meta-events] queue failed:', err)
  }
}

/**
 * Call from a route handler. Schedules the event to be claimed + sent AFTER
 * the response goes out. Safe to call unconditionally: with no pixel/token
 * configured it does nothing. Never throws.
 */
export function scheduleWorkshopMetaEvent(args: {
  registrationId: string
  eventName: MetaEventName
  context?: MetaRequestContext
}): void {
  try {
    after(() => queueWorkshopMetaEvent(args))
  } catch (err) {
    console.error('[meta-events] could not schedule event:', err)
  }
}

// ─── Creator dashboard: status + retry ──────────────────────────────────────

export interface MetaEventStats {
  sentLead: number
  sentPurchase: number
  failed: number
  skipped: number
  pending: number
  lastError: string | null
}

export async function getMetaEventStats(creatorId: string): Promise<MetaEventStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('workshop_meta_events')
    .select('event_name, status, last_error, updated_at')
    .eq('creator_id', creatorId)
    .gte('created_at', since)
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (error) throw error

  const stats: MetaEventStats = { sentLead: 0, sentPurchase: 0, failed: 0, skipped: 0, pending: 0, lastError: null }
  for (const r of data || []) {
    if (r.status === 'sent') r.event_name === 'Purchase' ? stats.sentPurchase++ : stats.sentLead++
    else if (r.status === 'failed') { stats.failed++; if (!stats.lastError) stats.lastError = r.last_error }
    else if (r.status === 'skipped') stats.skipped++
    else stats.pending++
  }
  return stats
}

/** Re-sends this creator's failed (or stuck) events that Meta will still accept. */
export async function retryFailedMetaEvents(creatorId: string): Promise<{ attempted: number; sent: number; failed: number }> {
  const oldestAllowed = new Date(Date.now() - MAX_EVENT_AGE_SECONDS * 1000).toISOString()
  const staleCutoff = new Date(Date.now() - STALE_PENDING_MS).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('workshop_meta_events')
    .select('id, registration_id, event_name, event_id, event_time, attempts, status, updated_at')
    .eq('creator_id', creatorId)
    .or(`status.eq.failed,and(status.eq.pending,updated_at.lt.${staleCutoff})`)
    .lt('attempts', MAX_ATTEMPTS)
    .gte('event_time', oldestAllowed)
    .order('created_at', { ascending: true })
    .limit(RETRY_BATCH)
  if (error) throw error

  const results = await Promise.all(
    (rows || []).map(async (row): Promise<'sent' | 'failed' | 'skipped' | 'unclaimed'> => {
      // Claim the retry so two clicks can't send the same event twice.
      const { data: claimed } = await supabaseAdmin
        .from('workshop_meta_events')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', row.status)
        .eq('updated_at', row.updated_at)
        .select('id')
      if (!claimed || claimed.length === 0) return 'unclaimed'

      const src = await loadSource(row.registration_id).catch(() => null)
      if (!src) {
        await supabaseAdmin
          .from('workshop_meta_events')
          .update({ status: 'skipped', last_error: 'Pixel or access token is no longer set up', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        return 'skipped'
      }
      return deliver(row as EventRow, src)
    })
  )

  return {
    attempted: results.filter((r) => r !== 'unclaimed').length,
    sent: results.filter((r) => r === 'sent').length,
    failed: results.filter((r) => r === 'failed').length,
  }
}
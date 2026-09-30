// Run with: npm run test:capi   (Node 22.18+ runs the .ts import directly)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  buildEvent, buildUserData, buildRequestBody, sendMetaEvent, verifyPixelAccess,
  normalizePhoneForMeta, normalizeEmailForMeta, splitName, isValidPixelId, MetaEventError, workshopPurchaseValue,
} from './meta-capi.ts'

const h = (s) => createHash('sha256').update(s).digest('hex')
const NOW = 1_800_000_000
const FBP = 'fb.1.1799999000000.1234567890'
const FBC = 'fb.1.1799999000000.IwAR0abcDEF_123-xyz'
const base = {
  eventId: 'ws_lead_abc', eventTime: NOW, eventSourceUrl: 'https://kurso.in/w/janhavi/sketching',
  user: { email: '  Asha@Example.COM ', phone: '9876543210', name: 'Asha Verma', externalId: 'reg-1', fbp: FBP, fbc: FBC, clientIp: '203.0.113.9, 10.0.0.1', clientUserAgent: 'Mozilla/5.0' },
  contentName: 'Sketching 101', contentId: 'w-1', orderId: 'reg-1',
}

test('hashing pins a known SHA-256 vector', () => {
  assert.equal(h('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
})

test('email: trimmed + lowercased before hashing; junk rejected', () => {
  assert.equal(normalizeEmailForMeta('  Asha@Example.COM '), 'asha@example.com')
  assert.equal(normalizeEmailForMeta('not-an-email'), null)
  assert.equal(normalizeEmailForMeta(''), null)
})

test('phone: digits only, country code added, no plus, no leading zero', () => {
  assert.equal(normalizePhoneForMeta('9876543210'), '919876543210')
  assert.equal(normalizePhoneForMeta('+91 98765-43210'), '919876543210')
  assert.equal(normalizePhoneForMeta('919876543210'), '919876543210')
  assert.equal(normalizePhoneForMeta('09876543210'), '919876543210')
  assert.equal(normalizePhoneForMeta('12345'), null)
})

test('names split into lowercase first/last', () => {
  assert.deepEqual(splitName('Asha  Kumari Verma'), { first: 'asha', last: 'verma' })
  assert.deepEqual(splitName('Asha'), { first: 'asha', last: null })
  assert.deepEqual(splitName(''), { first: null, last: null })
})

test('pixel id validation', () => {
  assert.equal(isValidPixelId('123456789012345'), true)
  assert.equal(isValidPixelId('12ab'), false)
  assert.equal(isValidPixelId("1'); alert(1)//"), false)
})

test('user_data: PII hashed, browser fields raw, arrays where Meta expects them', () => {
  const u = buildUserData(base.user)
  assert.deepEqual(u.em, [h('asha@example.com')])
  assert.deepEqual(u.ph, [h('919876543210')])
  assert.deepEqual(u.fn, [h('asha')])
  assert.deepEqual(u.ln, [h('verma')])
  assert.deepEqual(u.external_id, [h('reg-1')])
  assert.deepEqual(u.country, [h('in')])
  assert.equal(u.fbp, FBP)
  assert.equal(u.fbc, FBC)
  assert.equal(u.client_ip_address, '203.0.113.9')
  assert.equal(u.client_user_agent, 'Mozilla/5.0')
  const raw = JSON.stringify(u)
  assert.ok(!raw.includes('asha@example.com') && !raw.includes('9876543210'), 'no raw PII in payload')
})

test('user_data: malformed fbp/fbc/ip from the public request are dropped', () => {
  const u = buildUserData({ phone: '9876543210', fbp: 'garbage', fbc: '<script>', clientIp: 'not an ip!' })
  assert.equal(u.fbp, undefined)
  assert.equal(u.fbc, undefined)
  assert.equal(u.client_ip_address, undefined)
})

test('Lead: exact shape, and NO value/currency', () => {
  const e = buildEvent({ ...base, eventName: 'Lead' }, NOW)
  assert.equal(e.event_name, 'Lead')
  assert.equal(e.event_id, 'ws_lead_abc')
  assert.equal(e.event_time, NOW)
  assert.equal(e.action_source, 'website')
  assert.equal(e.event_source_url, 'https://kurso.in/w/janhavi/sketching')
  assert.deepEqual(e.custom_data, { content_name: 'Sketching 101', content_category: 'workshop' })
  assert.ok(!('value' in e.custom_data) && !('currency' in e.custom_data))
})

test('Purchase: numeric value, INR, ids, order_id', () => {
  const e = buildEvent({ ...base, eventName: 'Purchase', eventId: 'ws_purchase_reg-1', value: 499 }, NOW)
  assert.equal(e.custom_data.value, 499)
  assert.equal(typeof e.custom_data.value, 'number')
  assert.equal(e.custom_data.currency, 'INR')
  assert.deepEqual(e.custom_data.content_ids, ['w-1'])
  assert.equal(e.custom_data.content_type, 'product')
  assert.equal(e.custom_data.num_items, 1)
  assert.equal(e.custom_data.order_id, 'reg-1')
})

test('Purchase is refused unless clearly correct', () => {
  const p = (over) => () => buildEvent({ ...base, eventName: 'Purchase', ...over }, NOW)
  assert.throws(p({ value: 0 }), MetaEventError)
  assert.throws(p({ value: -5 }), MetaEventError)
  assert.throws(p({ value: NaN }), MetaEventError)
  assert.throws(p({ value: '499' }), MetaEventError)
  assert.throws(p({}), MetaEventError)
  assert.throws(p({ value: 499, currency: 'RUPEES' }), MetaEventError)
})

test('event_id, time, url, identifiers are enforced', () => {
  const l = (over) => () => buildEvent({ ...base, eventName: 'Lead', ...over }, NOW)
  assert.throws(l({ eventId: '' }), MetaEventError)
  assert.throws(l({ eventTime: NOW - 7 * 86400 }), MetaEventError) // too old
  assert.throws(l({ eventTime: NOW + 3600 }), MetaEventError) // future
  assert.throws(l({ eventTime: NOW + 0.5 }), MetaEventError) // not whole seconds
  assert.throws(l({ eventSourceUrl: 'kurso.in/x' }), MetaEventError)
  assert.throws(l({ user: {} }), MetaEventError) // nothing to match on
})

test('same event_id is passed through untouched (dedup with browser eventID)', () => {
  const e = buildEvent({ ...base, eventName: 'Lead', eventId: 'ws_lead_reg-9' }, NOW)
  assert.equal(e.event_id, 'ws_lead_reg-9')
})

test('request body: token in body, test_event_code only when set', () => {
  const e = buildEvent({ ...base, eventName: 'Lead' }, NOW)
  const plain = buildRequestBody({ events: [e], accessToken: 'TOK' })
  assert.equal(plain.access_token, 'TOK')
  assert.equal('test_event_code' in plain, false)
  assert.equal(buildRequestBody({ events: [e], accessToken: 'TOK', testEventCode: 'TEST123' }).test_event_code, 'TEST123')
})

const okRes = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj })
const event = () => { const now = Math.floor(Date.now() / 1000); return buildEvent({ ...base, eventName: 'Lead', eventTime: now }, now) }
const args = (fetchImpl) => ({ pixelId: '123456789012345', accessToken: 'TOK', event: event(), fetchImpl, retryDelayMs: 1 })

test('send: success; token never in the URL', async () => {
  let seenUrl = ''
  const r = await sendMetaEvent(args(async (url) => { seenUrl = url; return okRes({ events_received: 1 }) }))
  assert.equal(r.ok, true)
  assert.ok(seenUrl.endsWith('/123456789012345/events'))
  assert.ok(!seenUrl.includes('TOK'))
})

test('send: a 4xx is returned (not thrown) and NOT retried', async () => {
  let calls = 0
  const r = await sendMetaEvent(args(async () => { calls++; return okRes({ error: { message: 'Invalid OAuth access token', fbtrace_id: 'AbC' } }, 400) }))
  assert.equal(r.ok, false)
  assert.equal(r.status, 400)
  assert.match(r.error, /Invalid OAuth/)
  assert.equal(r.fbtraceId, 'AbC')
  assert.equal(calls, 1)
})

test('send: network error retried once, then reported without throwing', async () => {
  let calls = 0
  const r = await sendMetaEvent(args(async () => { calls++; throw new Error('boom') }))
  assert.equal(r.ok, false)
  assert.match(r.error, /Network error/)
  assert.equal(calls, 2)
})

test('send: a 5xx then success recovers', async () => {
  let calls = 0
  const r = await sendMetaEvent(args(async () => (++calls === 1 ? okRes({}, 503) : okRes({ events_received: 1 }))))
  assert.equal(r.ok, true)
  assert.equal(calls, 2)
})

test('send: 200 with events_received 0 is NOT treated as success', async () => {
  const r = await sendMetaEvent(args(async () => okRes({ events_received: 0 })))
  assert.equal(r.ok, false)
})

test('verifyPixelAccess: ok / invalid token / network', async () => {
  const good = await verifyPixelAccess({ pixelId: '123456789012345', accessToken: 'T', fetchImpl: async () => okRes({ id: '123456789012345', name: 'My Pixel' }) })
  assert.deepEqual(good, { ok: true, name: 'My Pixel' })
  const bad = await verifyPixelAccess({ pixelId: '123456789012345', accessToken: 'T', fetchImpl: async () => okRes({ error: { message: 'Unsupported get request' } }, 400) })
  assert.equal(bad.ok, false); assert.equal(bad.kind, 'invalid')
  const down = await verifyPixelAccess({ pixelId: '123456789012345', accessToken: 'T', fetchImpl: async () => { throw new Error('x') } })
  assert.equal(down.ok, false); assert.equal(down.kind, 'network')
})

test('verifyPixelAccess: token goes in the Authorization header, not the URL', async () => {
  let seenUrl = '', seenAuth = ''
  await verifyPixelAccess({
    pixelId: '123456789012345', accessToken: 'SECRET_TOKEN',
    fetchImpl: async (url, init) => { seenUrl = url; seenAuth = init.headers.Authorization; return okRes({ id: '123456789012345' }) },
  })
  assert.ok(!seenUrl.includes('SECRET_TOKEN'))
  assert.equal(seenAuth, 'Bearer SECRET_TOKEN')
})

test('workshopPurchaseValue: only confirmed, paid-mode registrations with a real amount', () => {
  const ok = { payment_status: 'confirmed', payment_mode: 'upi_manual', amount_paid: null }
  assert.equal(workshopPurchaseValue(ok, 499), 499)                                        // manual UPI -> workshop price
  assert.equal(workshopPurchaseValue({ ...ok, payment_mode: 'gateway', amount_paid: 450 }, 499), 450) // online -> amount actually paid
  assert.equal(workshopPurchaseValue({ ...ok, payment_mode: 'gateway', amount_paid: '450' }, 499), 450)
  assert.equal(workshopPurchaseValue({ ...ok, payment_status: 'pending_confirmation' }, 499), null)
  assert.equal(workshopPurchaseValue({ ...ok, payment_mode: 'free' }, 499), null)         // free signup is a Lead, never a Purchase
  assert.equal(workshopPurchaseValue(ok, 0), null)
  assert.equal(workshopPurchaseValue(ok, null), null)
  assert.equal(workshopPurchaseValue(ok, 'abc'), null)
})
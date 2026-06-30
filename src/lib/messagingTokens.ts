'use client'

export type MessagingPlatform = 'telegram' | 'whatsapp'

interface TokenIdentity {
  studentId?: string
  studentPhone?: string
  studentEmail?: string
  studentName?: string
  creatorId: string
  courseId: string
}

interface StoredToken {
  token: string | null
  expiresAt: string | null
}

const ROUTES: Record<MessagingPlatform, { create: string; save: string }> = {
  telegram: { create: '/api/telegram/create-token', save: '/api/telegram/save-enrollment-token' },
  whatsapp: { create: '/api/whatsapp/create-token', save: '/api/whatsapp/save-enrollment-token' },
}

/**
 * Creates a fresh start-token via the platform's create-token API.
 * Does NOT persist it — caller decides whether to save (enrolled students)
 * or just use it once (free-preview/demo students).
 */
export async function createMessagingToken(
  platform: MessagingPlatform,
  identity: TokenIdentity
): Promise<StoredToken> {
  try {
    const res = await fetch(ROUTES[platform].create, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: identity.studentId || undefined,
        studentPhone: identity.studentPhone || '',
        studentEmail: identity.studentEmail || '',
        studentName: identity.studentName || '',
        creatorId: identity.creatorId,
        courseId: identity.courseId,
        paymentId: null,
      }),
    })
    const data = await res.json()
    if (!data?.token) return { token: null, expiresAt: null }
    return { token: data.token, expiresAt: data.expiresAt || null }
  } catch (e) {
    console.error(`[messagingTokens] create ${platform} token failed:`, e)
    return { token: null, expiresAt: null }
  }
}

/**
 * Persists a freshly created token onto an enrollment row, REPLACING
 * whatever stale token was there before — this is what makes the
 * "Continue on WhatsApp / Telegram" link work again after the old one expires.
 */
export async function saveMessagingToken(
  platform: MessagingPlatform,
  enrollmentId: string,
  stored: StoredToken
): Promise<boolean> {
  if (!stored.token) return false
  try {
    const res = await fetch(ROUTES[platform].save, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId, token: stored.token, expiresAt: stored.expiresAt }),
    })
    if (!res.ok) {
      console.error(`[messagingTokens] save ${platform} token rejected:`, res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error(`[messagingTokens] save ${platform} token failed:`, e)
    return false
  }
}
/**
 * Main entry point for ENROLLED students.
 *
 * IMPORTANT: this does NOT trust the cached token/expiry on the enrollment
 * row to decide whether the existing token is "still good" — expiry is
 * only half the story. A token also goes dead the moment it's actually
 * used (whatsapp_tokens.used flips to true), and that flag is never
 * mirrored back onto the enrollment row. Trusting time-based expiry alone
 * meant the "Continue on WhatsApp" button kept re-sending an
 * already-consumed token for up to 7 days, since it still looked
 * time-valid even though the bot would reject it as already used.
 *
 * create-token's own dedup query is the only place that checks used=false
 * against the live whatsapp_tokens table, so we always ask it — it's a
 * cheap lookup, and it correctly returns the existing token unchanged
 * when one is still genuinely unused and unexpired.
 */
export async function ensureFreshEnrolledToken(
  platform: MessagingPlatform,
  params: {
    enrollmentId: string
    currentToken: string | null
    currentExpiresAt: string | null
    identity: TokenIdentity
  }
): Promise<StoredToken> {
  const fresh = await createMessagingToken(platform, params.identity)
  if (fresh.token && fresh.token !== params.currentToken) {
    await saveMessagingToken(platform, params.enrollmentId, fresh)
  }
  return fresh
}

/**
 * For unenrolled / free-preview visitors. No enrollment row exists yet,
 * so nothing is persisted — the create-token API itself dedupes re-use
 * for the same student+course within its own validity window.
 */
export async function fetchDemoToken(
  platform: MessagingPlatform,
  identity: TokenIdentity
): Promise<StoredToken> {
  return createMessagingToken(platform, identity)
}

export function buildDeepLink(
  platform: MessagingPlatform,
  token: string,
  opts: { telegramBotUsername?: string; whatsappNumber?: string }
): string | null {
  if (platform === 'telegram') {
    if (!opts.telegramBotUsername) return null
    return `https://t.me/${opts.telegramBotUsername.replace('@', '')}?start=${token}`
  }
  if (!opts.whatsappNumber) return null
  return `https://wa.me/${opts.whatsappNumber}?text=${encodeURIComponent('/start ' + token)}`
}
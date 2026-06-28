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

const REFRESH_THRESHOLD_MS = 30 * 60 * 1000 // refresh if < 30 min of validity left

const ROUTES: Record<MessagingPlatform, { create: string; save: string }> = {
  telegram: { create: '/api/telegram/create-token', save: '/api/telegram/save-enrollment-token' },
  whatsapp: { create: '/api/whatsapp/create-token', save: '/api/whatsapp/save-enrollment-token' },
}

function isStillValid(stored: StoredToken): boolean {
  if (!stored.token || !stored.expiresAt) return false
  return new Date(stored.expiresAt).getTime() - Date.now() > REFRESH_THRESHOLD_MS
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
): Promise<void> {
  if (!stored.token) return
  try {
    await fetch(ROUTES[platform].save, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId, token: stored.token, expiresAt: stored.expiresAt }),
    })
  } catch (e) {
    console.error(`[messagingTokens] save ${platform} token failed:`, e)
  }
}

/**
 * Main entry point for ENROLLED students.
 * Re-uses the persisted token if it still has more than 30 minutes of life
 * left. Otherwise generates a new one and overwrites the stale one in the
 * enrollments table. Cheap to call repeatedly — it skips the API entirely
 * when the existing token is still fresh.
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
  const stored: StoredToken = { token: params.currentToken, expiresAt: params.currentExpiresAt }
  if (isStillValid(stored)) return stored

  const fresh = await createMessagingToken(platform, params.identity)
  if (fresh.token) {
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
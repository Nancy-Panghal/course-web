// Email access links.
//
// Same mechanism as the Telegram/WhatsApp links (a row in web_bootstrap_tokens,
// redeemed once for a 7-day kurso_web_session cookie), with two differences that
// suit email: the link lives 24 hours instead of 2 minutes, and it points at a
// "Continue" page (/api/web-access/email) instead of redeeming on first load.
// Mail scanners (Gmail, Outlook, link-protection tools) open every URL in a message
// before the student does; a page that only redeems on a button press survives that.

import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/email'

export const EMAIL_LINK_TTL_HOURS = 24
export const REQUEST_LIMIT_PER_HOUR = 3
export const REQUEST_LIMIT_PER_DAY = 8
export const SESSION_DAYS = 7

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function isTokenShape(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

// "?lesson=N" navigation hint: a small positive integer or nothing. Never a security boundary.
export function parseLessonHint(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 ? n : null
}

export function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function courseDestination(
  course: { id: string; name: string | null; host_name: string | null },
  lessonNum: number | null = null
) {
  const base =
    `/course/${slugify(course.host_name || 'creator')}` +
    `/${slugify(course.name || 'course')}/${course.id}`
  return lessonNum ? `${base}?lesson=${lessonNum}` : base
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(2, Math.min(local.length - visible.length, 5)))}@${domain}`
}

// The only address we ever send an access link to: the one already on file.
// (enrollment.student_email first, then the student's own email.) Never user-supplied.
export async function getEnrollmentEmail(
  client: SupabaseClient,
  enrollment: { student_email?: string | null; student_id?: string | null }
): Promise<{ email: string | null; name: string | null }> {
  let name: string | null = null
  let studentEmail: string | null = null
  if (enrollment.student_id) {
    const { data: student } = await client
      .from('students')
      .select('email, name')
      .eq('id', enrollment.student_id)
      .maybeSingle()
    name = student?.name || null
    studentEmail = student?.email || null
  }
  const candidates = [enrollment.student_email, studentEmail]
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : ''
    if (v && EMAIL_RE.test(v)) return { email: v, name }
  }
  return { email: null, name }
}

// Mints a fresh single-use 24h email link. Returns the URL and the token hash
// (so a failed send can delete the unused token again).
export async function createEmailAccessUrl(
  client: SupabaseClient,
  input: { courseId: string; enrollmentId: string; studentId?: string | null; lessonNum?: number | null }
): Promise<{ url: string; tokenHash: string }> {
  const base = siteUrl()
  if (!base) throw new Error('NEXT_PUBLIC_SITE_URL is not configured')

  const raw = randomBytes(32).toString('hex')
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + EMAIL_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { error } = await client.from('web_bootstrap_tokens').insert({
    token_hash: tokenHash,
    course_id: input.courseId,
    enrollment_id: input.enrollmentId,
    student_id: input.studentId || null,
    channel: 'email',
    expires_at: expiresAt,
  })
  if (error) throw new Error(`Could not create email access token: ${error.message}`)

  const lessonParam =
    Number.isInteger(input.lessonNum) && (input.lessonNum as number) >= 1 ? `&lesson=${input.lessonNum}` : ''
  return { url: `${base}/api/web-access/email?t=${raw}${lessonParam}`, tokenHash }
}

// Per-enrollment throttle for "Email me a new link". Uses only known columns: an email
// token lives exactly 24h, so expires_at > now+23h means "made in the last hour" and
// expires_at > now means "made in the last 24 hours".
export async function isRequestRateLimited(client: SupabaseClient, enrollmentId: string) {
  const now = Date.now()
  const { data } = await client
    .from('web_bootstrap_tokens')
    .select('expires_at')
    .eq('enrollment_id', enrollmentId)
    .eq('channel', 'email')
    .gt('expires_at', new Date(now).toISOString())
  const rows = data || []
  const lastHour = rows.filter(r => new Date(r.expires_at).getTime() > now + 23 * 60 * 60 * 1000).length
  return lastHour >= REQUEST_LIMIT_PER_HOUR || rows.length >= REQUEST_LIMIT_PER_DAY
}

// For the expired-link pages: given a (possibly dead) raw token, is there a paid
// enrollment with an email on file we could send a new link to?
export async function getEmailHintForToken(client: SupabaseClient, rawToken: string | null) {
  if (!isTokenShape(rawToken)) return null
  const { data: row } = await client
    .from('web_bootstrap_tokens')
    .select('course_id, enrollment_id')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()
  if (!row) return null
  const { data: enrollment } = await client
    .from('enrollments')
    .select('id, student_id, student_email')
    .eq('id', row.enrollment_id)
    .eq('course_uuid', row.course_id)
    .eq('payment_status', 'paid')
    .maybeSingle()
  if (!enrollment) return null
  const { email } = await getEnrollmentEmail(client, enrollment)
  return email ? { masked: maskEmail(email) } : null
}

// ── Email bodies ─────────────────────────────────────────────────

const wrap = (inner: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">${inner}</div>`
const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#f79514;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;margin:0 0 16px">${label}</a>`
const footer =
  `<p style="margin:16px 0 0;font-size:12px;color:#666">This link is personal to you. It works once and expires in 24 hours. ` +
  `If it stops working, open it again and tap “Email me a new link”.</p>`

export function renderModuleUnlockEmail(i: { studentName?: string | null; courseName: string; moduleName: string; link: string }) {
  return {
    subject: `${i.moduleName} is now available`,
    html: wrap(
      `<p style="margin:0 0 12px">Hi ${escapeHtml(i.studentName || 'there')},</p>` +
        `<p style="margin:0 0 16px">A new part of <strong>${escapeHtml(i.courseName)}</strong> just unlocked for you: <strong>${escapeHtml(i.moduleName)}</strong>.</p>` +
        button(i.link, 'Open it →') +
        footer
    ),
  }
}

export function renderNewLinkEmail(i: { studentName?: string | null; courseName: string; link: string }) {
  return {
    subject: `Your new link — ${i.courseName}`,
    html: wrap(
      `<p style="margin:0 0 12px">Hi ${escapeHtml(i.studentName || 'there')},</p>` +
        `<p style="margin:0 0 16px">Here's a fresh link to <strong>${escapeHtml(i.courseName)}</strong>, as you asked.</p>` +
        button(i.link, 'Open my course →') +
        footer
    ),
  }
}
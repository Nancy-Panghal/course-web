import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getWebAccessContext } from '@/lib/webAccess'
import { getEmailHintForToken, isTokenShape } from '@/lib/emailAccess'
import { emailRequestFormHtml } from '@/lib/accessPages'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_DAYS = 7

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Optional lesson order number the link was meant to open (?lesson=N on the bootstrap
// URL). It is only a navigation hint: the course page and the content routes still
// enforce enrollment and module locks per lesson, so all we do here is make sure it is
// a small positive integer before putting it into the redirect.
function lessonFromRequest(req: NextRequest): number | null {
  const raw = req.nextUrl.searchParams.get('lesson')
  if (!raw || !/^\d{1,4}$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 ? n : null
}

function courseDestination(
  course: { id: string; name: string | null; host_name: string | null },
  lessonNum: number | null = null
) {
  const base =
    `/course/${slugify(course.host_name || 'creator')}` +
    `/${slugify(course.name || 'course')}/${course.id}`
  return lessonNum ? `${base}?lesson=${lessonNum}` : base
}

// Telegram bot link for the "Open Telegram" button. Only shown when the dead
// link was itself a Telegram link, so a WhatsApp student is never sent to Telegram.
function telegramBotUrl(): string | null {
  const username = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace('@', '').trim()
  return /^[A-Za-z0-9_]{3,64}$/.test(username) ? `https://t.me/${username}` : null
}

function expiredResponse(opts: { telegramUrl?: string | null; emailRequestHtml?: string } = {}) {
  const telegramButton = opts.telegramUrl
    ? `<a class="btn btn-primary" href="${opts.telegramUrl}">Open Telegram for a new link</a>`
    : ''
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Link expired</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #090909;
        color: #fff;
        font-family: Arial, sans-serif;
        padding: 24px;
      }
      main {
        width: min(440px, 100%);
        text-align: center;
        border: 1px solid #292929;
        border-radius: 18px;
        padding: 32px 24px;
        background: #151515;
      }
      h1 { margin: 0 0 12px; }
      p { color: #a1a1aa; line-height: 1.6; }
            .actions { display: grid; gap: 10px; margin-top: 22px; }
      .btn {
        display: block;
        padding: 12px 16px;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        border: 1px solid #3a3a3a;
        color: #fff;
        background: transparent;
      }
      .btn-primary { background: #f79514; border-color: #f79514; color: #fff; }
      .note { font-size: 13px; margin: 14px 0 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Link expired</h1>
      <p>
        This access link has expired or has already been used.
        Please return to WhatsApp or Telegram and request a new link.
        Open the new link within 2 minutes.
      </p>
      <div class="actions">
        ${telegramButton}
        ${opts.emailRequestHtml || ''}
        <a class="btn" href="/my-courses">Go to My Courses</a>
      </div>
      <p class="note">
        My Courses needs the email login you created on Kurso. If you only
        ever used Telegram or WhatsApp, request a new link there instead.
      </p>
    </main>
  </body>
</html>`,
    {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    }
  )
}


// Called whenever a bootstrap link can't be used (unknown, expired, already
// used, or lost a race). Before showing the dead-end page, check whether this
// browser already holds a valid web session for the SAME course the link was
// for — if so the student is already in, so send them straight to the course.
async function handleUnusableToken(req: NextRequest, tokenHash: string | null) {
  if (!tokenHash) return expiredResponse()

  // Look the link up by hash alone (no used/expiry filter) just to learn which
  // course and channel it was for. Only someone holding the raw token can hit this row.
  const { data: dead } = await supabase
    .from('web_bootstrap_tokens')
    .select('course_id, channel')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!dead) return expiredResponse()

  // getWebAccessContext validates the cookie against its stored session row
  // (unexpired, issued) AND re-checks that its enrollment is still
  // payment_status = 'paid' for that course. We additionally require it to be
  // the course THIS link was for: a session for course A proves nothing about B.
  const context = await getWebAccessContext(req)
  if (context && context.courseId === dead.course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('id, name, host_name')
      .eq('id', dead.course_id)
      .maybeSingle()

    if (course) {
      const response = NextResponse.redirect(new URL(courseDestination(course, lessonFromRequest(req)), req.url))
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      response.headers.set('Pragma', 'no-cache')
      return response
    }
  }

  // Offer "Email me a new link" when the student has an email on file. The address is
  // never typed in: the dead link identifies the enrollment, and the mail goes to the
  // address already stored for it.
  const rawToken = req.nextUrl.searchParams.get('t')
  const hint = await getEmailHintForToken(supabase, rawToken)

  return expiredResponse({
    telegramUrl: dead.channel === 'telegram' ? telegramBotUrl() : null,
    emailRequestHtml:
      hint && isTokenShape(rawToken)
        ? emailRequestFormHtml(rawToken, hint.masked, lessonFromRequest(req))
        : '',
  })
}

export async function GET(req: NextRequest) {
  const rawToken = req.nextUrl.searchParams.get('t')

  if (!rawToken) {
    return expiredResponse()
  }

  const tokenHash = hashToken(rawToken)
  const now = new Date().toISOString()

  const { data: bootstrap } = await supabase
    .from('web_bootstrap_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  if (!bootstrap) {
    return handleUnusableToken(req, tokenHash)
  }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, course_uuid, student_id, payment_status')
    .eq('id', bootstrap.enrollment_id)
    .eq('course_uuid', bootstrap.course_id)
    .eq('payment_status', 'paid')
    .maybeSingle()

  if (!enrollment) {
    return new NextResponse('Paid enrollment required', { status: 403 })
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name')
    .eq('id', bootstrap.course_id)
    .maybeSingle()

  if (!course) {
    return new NextResponse('Course not found', { status: 404 })
  }

  const sessionToken = randomBytes(32).toString('hex')
  const sessionTokenHash = hashToken(sessionToken)
  const sessionExpiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  // Atomic one-time consumption.
  const { data: consumed } = await supabase
    .from('web_bootstrap_tokens')
    .update({
      used_at: now,
      session_token_hash: sessionTokenHash,
      session_expires_at: sessionExpiresAt,
    })
    .eq('id', bootstrap.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (!consumed) {
    return handleUnusableToken(req, tokenHash)
  }

  const destination = courseDestination(course, lessonFromRequest(req))

    const response = NextResponse.redirect(
    new URL(destination, req.url)
  )

  // Chat-app in-app browsers (WhatsApp/Telegram) are known to aggressively
  // reuse a cached page instead of doing a fresh navigation when a new link
  // is tapped from the same conversation. These headers tell every layer —
  // the in-app browser, any CDN, any intermediate proxy — this response and
  // its destination must never be served from cache.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.headers.set('Pragma', 'no-cache')

  response.cookies.set('kurso_web_session', sessionToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  expires: new Date(sessionExpiresAt),
})

  return response
}
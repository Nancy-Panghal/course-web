import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

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

function expiredResponse() {
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
    </main>
  </body>
</html>`,
    {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
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
    return expiredResponse()
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
    return expiredResponse()
  }

  const destination =
    `/course/${slugify(course.host_name || 'creator')}` +
    `/${slugify(course.name || 'course')}/${course.id}`

  const response = NextResponse.redirect(
    new URL(destination, req.url)
  )

  response.cookies.set('kurso_web_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(sessionExpiresAt),
  })

  return response
}
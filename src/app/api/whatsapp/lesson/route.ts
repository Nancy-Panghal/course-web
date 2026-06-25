import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeCompare(a: string, b: string) {
  try {
    const left = Buffer.from(a.padEnd(64, '0'))
    const right = Buffer.from(b.padEnd(64, '0'))
    return left.length === right.length && crypto.timingSafeEqual(left, right)
  } catch {
    return false
  }
}

function maxFreeLessons(config?: string) {
  if (config === 'completely free') return 999999
  if (config === 'lesson 1 free') return 1
  if (config === '2 lessons free') return 2
  if (config === '3 lessons free') return 3
  if (config === 'module 1 free') return 3
  if (config === '2 modules free') return 6
  return 0
}

function renderLessonHtml({
  title,
  contentUrl,
  contentType,
  identity,
}: {
  title: string
  contentUrl: string
  contentType: string
  identity: string
}) {
  const escapedTitle = title.replace(/[<>&"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
  }[char] || char))

  const isPdf = contentType === 'pdf'
  const player = isPdf
    ? `<iframe src="${contentUrl}" title="${escapedTitle}"></iframe>`
    : `<video controls controlsList="nodownload" src="${contentUrl}"></video>`

  // Watermark with last 4 digits of identity (phone) for anti-piracy
  const wmLabel = identity ? `Protected · ${identity.slice(-4)}` : 'Protected'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapedTitle}</title>
  <style>
    html,body{margin:0;background:#050505;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    main{min-height:100vh;display:flex;flex-direction:column}
    header{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between}
    .player{position:relative;flex:1;display:flex;align-items:center;justify-content:center;background:#000}
    video,iframe{width:100%;height:100%;border:0;max-height:calc(100vh - 52px)}
    .wm{position:absolute;left:12px;top:12px;padding:6px 9px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);font-size:10px;letter-spacing:.08em;color:rgba(255,255,255,.7);pointer-events:none}
    .title{font-size:14px;font-weight:700;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%}
    .badge{font-size:10px;color:#52525b;white-space:nowrap}
  </style>
</head>
<body>
  <main>
    <header>
      <span class="title">${escapedTitle}</span>
      <span class="badge">Kurso Protected Lesson</span>
    </header>
    <section class="player">
      <div class="wm">${wmLabel}</div>
      ${player}
    </section>
  </main>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId') || ''
  const lessonId = url.searchParams.get('lessonId') || ''
  const lesson = Number(url.searchParams.get('lesson') || '')
  const identity = url.searchParams.get('identity') || ''
  const exp = Number(url.searchParams.get('exp') || '')
  const sig = url.searchParams.get('sig') || ''

  if (!courseId || !lessonId || !lesson || !exp || !sig) {
    return new NextResponse('Invalid lesson link — missing parameters.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  if (Date.now() > exp) {
    return new NextResponse('This lesson link has expired. Go back to WhatsApp and send "lesson" to get a new link.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const secret = process.env.WHATSAPP_LINK_SECRET || process.env.VERIFY_TOKEN
  if (!secret) {
    console.error('[whatsapp/lesson] WHATSAPP_LINK_SECRET not set')
    return new NextResponse('Lesson links are not configured on this server.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // ── Signature verification ────────────────────────────────────────────────
  // MUST match how lessonSender.js signs:
  // payload = `lesson.${courseId}.${lessonId}.${lessonNum}.${phone}.${exp}`
  const payload = `lesson.${courseId}.${lessonId}.${lesson}.${identity}.${exp}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  if (!safeCompare(expected, sig)) {
    console.error('[whatsapp/lesson] signature mismatch for lesson:', lesson, 'identity:', identity)
    return new NextResponse('Invalid lesson signature. This link may have been tampered with.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const [{ data: courseRows }, { data: lessonRows }] = await Promise.all([
    supabase
      .from('courses')
      .select('id, name, free_preview_config')
      .eq('id', courseId)
      .limit(1),
    supabase
      .from('lessons')
      .select('id, title, content_url, content_type, order_num, is_published')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .limit(1),
  ])

  const course = courseRows?.[0]
  const lessonData = lessonRows?.[0]

  if (!course || !lessonData || !lessonData.is_published) {
    return new NextResponse('Lesson not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new NextResponse(
    renderLessonHtml({
      title: lessonData.title,
      contentUrl: lessonData.content_url,
      contentType: lessonData.content_type,
      identity,
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }
  )
}
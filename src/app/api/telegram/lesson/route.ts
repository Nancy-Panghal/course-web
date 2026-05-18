import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function html(title: string, contentUrl: string, contentType: string, chatId: string) {
  const safeTitle = title.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
  const player = contentType === 'pdf'
    ? `<iframe src="${contentUrl}" title="${safeTitle}"></iframe>`
    : `<video controls controlsList="nodownload" src="${contentUrl}"></video>`

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${safeTitle}</title>
  <style>
    html,body{margin:0;background:#050505;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    header{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;font-weight:700}
    main{min-height:100vh;display:flex;flex-direction:column}
    .player{position:relative;flex:1;background:#000;display:flex;align-items:center;justify-content:center}
    video,iframe{width:100%;height:100%;border:0;max-height:calc(100vh - 46px)}
    .wm{position:absolute;top:12px;left:12px;z-index:2;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);font-size:10px;color:rgba(255,255,255,.72);pointer-events:none}
  </style>
</head>
<body>
  <main>
    <header>AcademyKit Protected Telegram Lesson</header>
    <section class="player">
      <div class="wm">TG:${chatId}</div>
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
  const chatId = url.searchParams.get('chatId') || ''
  const exp = Number(url.searchParams.get('exp') || '')
  const sig = url.searchParams.get('sig') || ''

  if (!courseId || !lessonId || !lesson || !chatId || !exp || !sig) {
    return NextResponse.json({ error: 'Invalid lesson link' }, { status: 400 })
  }

  if (Date.now() > exp) {
    return NextResponse.json({ error: 'Lesson link expired' }, { status: 410 })
  }

  const secret = process.env.TELEGRAM_LINK_SECRET || process.env.WHATSAPP_LINK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Telegram lesson links are not configured' }, { status: 500 })

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${courseId}.${lessonId}.${lesson}.${chatId}.${exp}`)
    .digest('hex')

  if (!safeCompare(expected, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const enrollment = await supabase
    .from('enrollments')
    .select('id')
    .eq('course_uuid', courseId)
    .eq('telegram_chat_id', chatId)
    .limit(1)

  if (!enrollment.data?.[0]) {
    return NextResponse.json({ error: 'Telegram enrollment not found' }, { status: 403 })
  }

  const { data } = await supabase
    .from('lessons')
    .select('title, content_url, content_type, is_published')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .limit(1)

  const row = data?.[0]
  if (!row || !row.is_published) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  return new NextResponse(html(row.title, row.content_url, row.content_type, chatId), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

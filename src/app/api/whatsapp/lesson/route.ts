import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

function safeCompare(a: string, b: string) {
  try {
    const la = a.padEnd(64, '0'), lb = b.padEnd(64, '0')
    return Buffer.byteLength(la) === Buffer.byteLength(lb) &&
      crypto.timingSafeEqual(Buffer.from(la), Buffer.from(lb))
  } catch { return false }
}

/** Sign a Supabase storage path and return a temporary URL. */
async function signStoragePath(path: string, ttlSeconds = 7200): Promise<string | null> {
  // Already a full URL — return as-is (public bucket)
  if (path.startsWith('http')) return path
  // Supabase storage path → create signed URL
  const bucket = 'lessons'
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds)
  if (error || !data?.signedUrl) {
    console.error('[whatsapp/lesson] createSignedUrl failed | bucket:', bucket, '| path:', JSON.stringify(path), '| error:', error?.message)
    return null
  }
  return data.signedUrl
}

/** Detect if a URL is a YouTube or Vimeo embed (can't use <video src>). */
function isEmbedUrl(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com|loom\.com/i.test(url)
}

/** Convert a watch URL to an embed URL for iframes. */
function toEmbedUrl(url: string): string {
  // youtube.com/watch?v=ID → youtube.com/embed/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`
  // vimeo.com/ID → player.vimeo.com/video/ID
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`
  return url
}

function esc(s: string) {
  return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c] ?? c))
}

function renderHtml({
  title, contentUrl, contentType, identity, lessonNum, courseId,
}: {
  title: string; contentUrl: string; contentType: string;
  identity: string; lessonNum: number; courseId: string;
}) {
  const t = esc(title)
  const wm = identity ? `Protected · ${identity.replace('+', '').slice(-4)}` : 'Protected'
  const isPdf = contentType === 'pdf'
  const isEmbed = isEmbedUrl(contentUrl)
  const embedSrc = isEmbed ? toEmbedUrl(contentUrl) : contentUrl

  let player: string
  if (isPdf) {
    player = `<iframe src="${esc(embedSrc)}" title="${t}" class="media"></iframe>`
  } else if (isEmbed) {
    player = `<iframe src="${esc(embedSrc)}" title="${t}" class="media"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>`
  } else {
    player = `<video controls controlsList="nodownload nofullscreen" playsinline
      src="${esc(contentUrl)}" class="media"
      oncontextmenu="return false"></video>`
  }

  const waHref = WA_NUMBER
    ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('done:' + lessonNum)}`
    : '#'
  const waLabel = `Mark Lesson ${lessonNum} Done on WhatsApp`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="robots" content="noindex,nofollow"/>
  <title>${t}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#050505;color:#fff;
      font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
    .wrap{display:flex;flex-direction:column;height:100vh}
    header{flex-shrink:0;padding:12px 16px;
      border-bottom:1px solid rgba(255,255,255,.08);
      display:flex;align-items:center;justify-content:space-between;gap:8px}
    .htitle{font-size:13px;font-weight:700;color:#e4e4e7;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .hbadge{font-size:10px;color:#52525b;white-space:nowrap;flex-shrink:0}
    .player{position:relative;flex:1;background:#000;overflow:hidden;
      display:flex;align-items:center;justify-content:center}
    .media{width:100%;height:100%;border:0;display:block}
    .wm{position:absolute;top:10px;left:10px;padding:4px 8px;border-radius:6px;
      background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);
      font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.6);
      pointer-events:none;user-select:none;z-index:9}
    footer{flex-shrink:0;padding:10px 16px;
      border-top:1px solid rgba(255,255,255,.06);
      display:flex;align-items:center;justify-content:space-between;
      gap:10px;background:#0a0a0a}
    .wa-btn{display:inline-flex;align-items:center;gap:6px;
      padding:9px 16px;border-radius:10px;background:#25D366;
      color:#fff;font-size:12px;font-weight:700;text-decoration:none;
      white-space:nowrap;transition:opacity .15s}
    .wa-btn:hover{opacity:.88}
    .wa-btn svg{width:15px;height:15px;flex-shrink:0}
    .note{font-size:10px;color:#52525b;line-height:1.4}
    /* Prevent right-click save on video */
    video::-webkit-media-controls-enclosure{overflow:hidden}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="htitle">${t}</span>
    <span class="hbadge">Kurso</span>
  </header>

  <section class="player">
    <div class="wm">${esc(wm)}</div>
    ${player}
  </section>

  <footer>
    <span class="note">Link personal &amp; expires in 2 h.<br/>Do not share.</span>
    ${WA_NUMBER ? `
    <a class="wa-btn" href="${esc(waHref)}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      ${esc(waLabel)}
    </a>` : ''}
  </footer>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const courseId  = url.searchParams.get('courseId')  || ''
  const lessonId  = url.searchParams.get('lessonId')  || ''
  const lesson    = Number(url.searchParams.get('lesson') || 0)
  const identity  = url.searchParams.get('identity') || ''
  const exp       = Number(url.searchParams.get('exp')    || 0)
  const sig       = url.searchParams.get('sig')       || ''

  if (!courseId || !lessonId || !lesson || !exp || !sig) {
    return new NextResponse('Invalid lesson link — missing parameters.', { status: 400 })
  }

  if (Date.now() > exp) {
    return new NextResponse(
      'This lesson link has expired. Return to WhatsApp and send "lesson" to get a fresh link.',
      { status: 410 }
    )
  }

  const secret = process.env.WHATSAPP_LINK_SECRET || process.env.LESSON_LINK_SECRET
  if (!secret) {
    console.error('[whatsapp/lesson] WHATSAPP_LINK_SECRET not configured')
    return new NextResponse('Server misconfiguration.', { status: 500 })
  }

  // ── Verify HMAC — must match lessonSender.js signLessonPageUrl ────────────
  // payload = `lesson.${courseId}.${lessonId}.${lessonNum}.${phone}.${exp}`
  const payload  = `lesson.${courseId}.${lessonId}.${lesson}.${identity}.${exp}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (!safeCompare(expected, sig)) {
    console.error('[whatsapp/lesson] bad sig | lesson:', lesson, 'identity:', identity)
    return new NextResponse('Invalid or tampered lesson link.', { status: 403 })
  }

  // ── Fetch lesson + course in parallel ─────────────────────────────────────
  const [{ data: courseRows }, { data: lessonRows }] = await Promise.all([
    supabase.from('courses').select('id, name').eq('id', courseId).limit(1),
    supabase
      .from('lessons')
      // ↓ include video_storage_path so we can sign private Supabase uploads
      .select('id, title, content_url, content_type, video_storage_path, order_num, is_published')
      .eq('id', lessonId)
      .eq('course_id', courseId)
      .limit(1),
  ])

  const lessonData = lessonRows?.[0]
  if (!courseRows?.[0] || !lessonData || !lessonData.is_published) {
    return new NextResponse('Lesson not found.', { status: 404 })
  }

  // ── Resolve the playable content URL ─────────────────────────────────────
  // Priority:
  //  1. video_storage_path  → sign with Supabase storage (private bucket upload)
  //  2. content_url (http)  → use directly (public URL, YouTube, Vimeo, etc.)
  //  3. content_url (path)  → sign with Supabase storage (legacy path-only value)
  let contentUrl = lessonData.content_url || ''
  const storagePath: string | null = (lessonData as any).video_storage_path || null

  if (storagePath) {
    const signed = await signStoragePath(storagePath, 7200)
    if (signed) contentUrl = signed
    else console.warn('[whatsapp/lesson] could not sign storage path:', storagePath)
  } else if (contentUrl && !contentUrl.startsWith('http') && !contentUrl.startsWith('/')) {
    // Looks like a bare storage path stored in content_url
    const signed = await signStoragePath(contentUrl, 7200)
    if (signed) contentUrl = signed
  }

  if (!contentUrl) {
    return new NextResponse('Lesson content not available.', { status: 404 })
  }

  return new NextResponse(
    renderHtml({
      title:       lessonData.title,
      contentUrl,
      contentType: lessonData.content_type || 'video',
      identity,
      lessonNum:   lesson,
      courseId,
    }),
    {
      headers: {
        'Content-Type':   'text/html; charset=utf-8',
        'Cache-Control':  'private, no-store',
        'X-Robots-Tag':   'noindex, nofollow',
      },
    }
  )
}
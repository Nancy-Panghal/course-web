import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { slugify } from '@/lib/utils'

// Creator-facing (not admin-only) — any signed-in creator can read/update
// their OWN course's custom page override. Uses the service-role key but
// enforces ownership manually on every query (.eq('creator_id', user.id))
// since the service role bypasses RLS — this is the same pattern the rest
// of the dashboard already uses for creator-owned resources.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Raw HTML is now something any creator can paste in (not just Nancy via
// the old admin tool), so a size cap is worth having — this is generous
// (well beyond any real standalone page) but stops accidental abuse/bloat.
const MAX_OVERRIDE_LENGTH = 400_000 // ~400KB of HTML/CSS/JS

async function getAuthedUser(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// GET /api/course-custom-page?courseId=xxx            -> this course's override content (owner only)
// GET /api/course-custom-page?exportCourseId=xxx       -> standalone snapshot of its live auto-generated page (owner only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const exportCourseId = req.nextUrl.searchParams.get('exportCourseId')
    if (exportCourseId) {
      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .select('id, name, host_name, creator_id')
        .eq('id', exportCourseId)
        .single()
      if (courseErr || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      if (course.creator_id !== user.id) return NextResponse.json({ error: 'Not your course.' }, { status: 403 })

      const origin = req.nextUrl.origin
      const liveUrl = `${origin}/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}`
      const pageRes = await fetch(liveUrl)
      if (!pageRes.ok) return NextResponse.json({ error: `Could not fetch the live page to export (status ${pageRes.status}). Is the course published?` }, { status: 502 })

      const html = await buildStandaloneSnapshot(await pageRes.text(), origin, course.name)
      return NextResponse.json({ html })
    }

    const courseId = req.nextUrl.searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('courses')
      .select('id, name, host_name, slug, is_published, use_custom_override, custom_page_override, creator_id')
      .eq('id', courseId)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (data.creator_id !== user.id) return NextResponse.json({ error: 'Not your course.' }, { status: 403 })

    return NextResponse.json({ course: data })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'course-custom-page GET')
  }
}

// PATCH /api/course-custom-page
// body: { courseId: string, customPageOverride: string, useCustomOverride: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const body = await req.json()
    const { courseId, customPageOverride, useCustomOverride } = body

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }
    if (useCustomOverride === true && (typeof customPageOverride !== 'string' || customPageOverride.trim().length === 0)) {
      return NextResponse.json({ error: 'Cannot enable the override with empty content' }, { status: 400 })
    }
    if (typeof customPageOverride === 'string' && customPageOverride.length > MAX_OVERRIDE_LENGTH) {
      return NextResponse.json({ error: `Content is too large (max ${Math.floor(MAX_OVERRIDE_LENGTH / 1000)}KB).` }, { status: 400 })
    }

    // Ownership check before writing — the service-role key bypasses RLS,
    // so this manual check is the only thing stopping a creator from
    // editing someone else's course.
    const { data: existing, error: fetchErr } = await supabase
      .from('courses')
      .select('creator_id')
      .eq('id', courseId)
      .single()
    if (fetchErr || !existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (existing.creator_id !== user.id) return NextResponse.json({ error: 'Not your course.' }, { status: 403 })

    const { error } = await supabase
      .from('courses')
      .update({
        custom_page_override: typeof customPageOverride === 'string' ? customPageOverride : null,
        use_custom_override: useCustomOverride === true,
      })
      .eq('id', courseId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'course-custom-page PATCH')
  }
}

/**
 * Best-effort standalone snapshot of the live, auto-generated page — for
 * pasting into an LLM as reference material, NOT a working page to redeploy
 * unedited. It inlines the compiled stylesheet so it looks right outside
 * Kurso, but strips all <script> tags: the enroll/buy button's JS depends on
 * a logged-in Supabase session and Kurso's own API, neither of which exist
 * once this is pasted elsewhere. If an LLM is asked to build a new page from
 * this, the buy button needs to become a plain link (e.g. to Kurso's own
 * enroll page) rather than the original interactive button.
 *
 * This is naive regex-based extraction, not a real HTML parser — fine for
 * reference material, not guaranteed byte-perfect across future Next.js
 * upgrades.
 */
async function buildStandaloneSnapshot(pageHtml: string, origin: string, title: string): Promise<string> {
  const styleHrefs = Array.from(pageHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)).map(m => m[1])
  const fontLinkTags = Array.from(pageHtml.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com[^"]+)"[^>]*>/g)).map(m => `<link rel="stylesheet" href="${m[1]}">`)

  let combinedCss = ''
  for (const href of styleHrefs) {
    try {
      const cssUrl = href.startsWith('http') ? href : `${origin}${href}`
      const cssRes = await fetch(cssUrl)
      if (cssRes.ok) combinedCss += `\n/* ${href} */\n` + (await cssRes.text())
    } catch {
      // best-effort — one missing stylesheet chunk shouldn't fail the whole export
    }
  }

  const bodyMatch = pageHtml.match(/<body[^>]*>([\s\S]*)<\/body>/)
  let bodyInner = bodyMatch ? bodyMatch[1] : pageHtml
  bodyInner = bodyInner.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Iframes (e.g. the YouTube promo video embed) don't work reliably once
  // this becomes a custom page: they'd be nested inside Kurso's own
  // sandboxed iframe, which intentionally has no allow-same-origin — and
  // YouTube's player script fails to initialize in that context, throwing
  // console errors on the live page. Strip them and leave a clear marker
  // so whoever edits this knows a video embed was there and needs to be
  // re-added as a plain link or thumbnail image instead.
  bodyInner = bodyInner.replace(/<iframe[\s\S]*?<\/iframe>/gi, '<!-- Video embed removed — iframes inside iframes don\'t work reliably here. Link to the video instead, e.g. <a href="YOUR_YOUTUBE_URL">Watch the preview</a> -->')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title} — exported snapshot (reference only, buy button will not work as-is)</title>
${fontLinkTags.join('\n')}
<style>${combinedCss}</style>
</head>
<body>
<!--
  EXPORTED SNAPSHOT — reference material for an LLM prompt, not a working
  page. The original buy/enroll button's JavaScript was stripped because it
  depends on a logged-in session and Kurso's own API that won't exist once
  this is pasted elsewhere. Replace it with a plain link before using this
  as a real custom page.
-->
${bodyInner}
</body>
</html>`
}
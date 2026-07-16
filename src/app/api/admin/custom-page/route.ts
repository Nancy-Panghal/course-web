import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { slugify } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Best-effort standalone snapshot of the live, auto-generated page — for
 * pasting into an LLM as reference material, NOT a working page to redeploy
 * unedited. It inlines the compiled stylesheet so it looks right outside
 * Kurso, but strips all <script> tags: the enroll/buy button's JS depends on
 * a logged-in Supabase session and Kurso's own API, neither of which exist
 * once this is pasted elsewhere. If an LLM is asked to build a NEW custom
 * page from this, the buy button needs to become a plain link (e.g. to
 * Kurso's own enroll page) rather than the original interactive button —
 * flag that to whoever's doing the editing.
 *
 * This is naive regex-based extraction, not a real HTML parser. It's built
 * for one person (Nancy) reading/copying output for an LLM prompt, not for
 * arbitrary robustness — if a future Next.js upgrade changes how it emits
 * <link>/<style> tags, this may need a small tweak.
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

// GET /api/admin/custom-page                          -> list courses for the picker
// GET /api/admin/custom-page?courseId=xxx              -> one course's full override content
// GET /api/admin/custom-page?exportCourseId=xxx         -> standalone snapshot of its live auto-generated page
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const exportCourseId = req.nextUrl.searchParams.get('exportCourseId')
    if (exportCourseId) {
      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .select('id, name, host_name')
        .eq('id', exportCourseId)
        .single()
      if (courseErr || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

      const origin = req.nextUrl.origin
      const liveUrl = `${origin}/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}`
      const pageRes = await fetch(liveUrl)
      if (!pageRes.ok) return NextResponse.json({ error: `Could not fetch the live page to export (status ${pageRes.status}). Is the course published?` }, { status: 502 })

      const html = await buildStandaloneSnapshot(await pageRes.text(), origin, course.name)
      return NextResponse.json({ html })
    }

    const courseId = req.nextUrl.searchParams.get('courseId')
    if (courseId) {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, host_name, slug, is_published, use_custom_override, custom_page_override')
        .eq('id', courseId)
        .single()

      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      return NextResponse.json({ course: data })
    }

    const search = (req.nextUrl.searchParams.get('search') || '').trim()
    let query = supabase
      .from('courses')
      .select('id, name, host_name, is_published, use_custom_override')
      .order('name', { ascending: true })
      .limit(50)

    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ courses: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/custom-page GET')
  }
}

// PATCH /api/admin/custom-page
// body: { courseId: string, customPageOverride: string, useCustomOverride: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { courseId, customPageOverride, useCustomOverride } = body

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }
    if (useCustomOverride === true && (typeof customPageOverride !== 'string' || customPageOverride.trim().length === 0)) {
      return NextResponse.json({ error: 'Cannot enable the override with empty content' }, { status: 400 })
    }

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
    return friendlyErrorResponse(err, 'admin/custom-page PATCH')
  }
}
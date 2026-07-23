import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'
import { normalizeLandingConfig, getRenderableSections, type LandingSectionType } from '@/lib/landing-config'

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
// GET /api/course-custom-page?exportCourseId=xxx       -> reference export built from this course's data + theme (owner only)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req)
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const exportCourseId = req.nextUrl.searchParams.get('exportCourseId')
    if (exportCourseId) {
      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .select('*')
        .eq('id', exportCourseId)
        .single()
      if (courseErr || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      if (course.creator_id !== user.id) return NextResponse.json({ error: 'Not your course.' }, { status: 403 })

      // Published lesson titles for the curriculum section — optional, cheap,
      // one extra indexed query, meaningfully improves the reference doc.
      const { data: lessons } = await supabase
        .from('lessons')
        .select('title, order_num, is_published')
        .eq('course_id', exportCourseId)
        .eq('is_published', true)
        .order('order_num', { ascending: true })

      const html = buildStaticExport(course, lessons || [])
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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Builds the export directly from the course row — NOT by fetching the live
 * rendered page. That fetch-based approach was tried first and does not
 * work: this app's course pages use React Suspense/streaming SSR, so a
 * plain server-side fetch() only ever captures the "Loading..." shell that
 * gets sent first, before the real content streams in via inline scripts —
 * and stripping those scripts (needed to remove the broken buy button)
 * strips the exact mechanism that would have filled in the real content.
 * Building flat HTML from the same data the live page reads sidesteps that
 * entirely: there is no live page fetch here, so there is nothing to hang
 * or come back empty.
 *
 * Uses the course's ACTUAL selected theme colors/fonts (same lookup the
 * live page uses: getLandingTheme + getFontPairOverride) and the ACTUAL
 * section enable/order from landing_config — so this reads like a real
 * snapshot of what the creator built, not a generic placeholder page.
 *
 * Still a plain reference document for handing to an LLM, not a pixel-
 * perfect clone — and the buy button is a disabled-looking placeholder,
 * not a working purchase flow (that depends on a logged-in session that
 * won't exist once this is pasted elsewhere).
 */
function buildStaticExport(course: any, lessons: { title: string; order_num: number }[]): string {
  const theme = getLandingTheme(course.landing_theme)
  const c = theme.colors
  const fontOverride = getFontPairOverride(course.landing_font_pair)
  const headingFont = fontOverride?.heading || theme.fonts.heading
  const bodyFont = fontOverride?.body || theme.fonts.body
  const fontImportUrl = fontOverride?.googleFontsImportUrl || theme.fonts.googleFontsImportUrl

  const landingConfig = normalizeLandingConfig(course.landing_config, course.landing_sections)
  const order = getRenderableSections(landingConfig)

  const name = course.name || 'Untitled course'
  const price = typeof course.price === 'number' ? course.price : null
  const originalPrice = typeof course.original_price === 'number' ? course.original_price : null

  function sectionWrap(title: string, inner: string, alt = false): string {
    return `<section style="padding:48px 24px;border-top:1px solid ${c.border};${alt ? `background:${c.sectionAltBg};` : ''}"><div style="max-width:800px;margin:0 auto;">${title ? `<h2 style="font-family:${headingFont};font-size:1.6rem;font-weight:800;margin:0 0 24px;text-align:center;color:${c.textPrimary};">${escapeHtml(title)}</h2>` : ''}${inner}</div></section>`
  }

  const heroHtml = `
    <section style="padding:56px 24px 40px;text-align:center;background:${c.bg};">
      <div style="max-width:720px;margin:0 auto;">
        <h1 style="font-family:${headingFont};font-size:2rem;font-weight:900;line-height:1.15;margin:0 0 16px;color:${c.textPrimary};">${escapeHtml(name)}</h1>
        ${course.description ? `<p style="font-size:1rem;line-height:1.7;color:${c.textSecondary};margin:0 0 28px;">${escapeHtml(course.description)}</p>` : ''}
        <div style="display:flex;align-items:baseline;justify-content:center;gap:12px;margin-bottom:20px;">
          ${price !== null ? `<span style="font-family:${headingFont};font-size:2rem;font-weight:900;color:${c.textPrimary};">₹${price.toLocaleString('en-IN')}</span>` : ''}
          ${originalPrice && price !== null && originalPrice > price ? `<span style="font-size:1.1rem;color:${c.textFaint};text-decoration:line-through;">₹${originalPrice.toLocaleString('en-IN')}</span>` : ''}
        </div>
        <div style="display:inline-block;padding:14px 32px;border-radius:12px;background:${c.accentGradient};color:#fff;font-weight:700;opacity:0.55;">Enroll Now (placeholder — not a working button here)</div>
      </div>
    </section>`

  const finalCtaHtml = `
    <section style="padding:56px 24px;text-align:center;border-top:1px solid ${c.border};background:${c.bg};">
      <h2 style="font-family:${headingFont};font-size:1.6rem;font-weight:900;margin:0 0 12px;color:${c.textPrimary};">Ready to start learning?</h2>
      <div style="display:inline-block;padding:14px 32px;border-radius:12px;background:${c.accentGradient};color:#fff;font-weight:700;opacity:0.55;">Enroll Now (placeholder — not a working button here)</div>
    </section>`

  const sectionHtml: Partial<Record<LandingSectionType, string>> = {}

  const stats = [
    course.duration ? ['Duration', course.duration] : null,
    Array.isArray(course.language) && course.language.length ? ['Language', course.language.join(', ')] : null,
    course.level ? ['Level', course.level] : null,
  ].filter(Boolean) as [string, string][]
  if (stats.length) {
    sectionHtml.stats = sectionWrap('', `<div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">${stats.map(([label, value]) =>
      `<div style="text-align:center;"><div style="font-family:${headingFont};font-size:1.3rem;font-weight:800;color:${c.textPrimary};">${escapeHtml(value)}</div><div style="font-size:0.8rem;color:${c.textMuted};">${escapeHtml(label)}</div></div>`
    ).join('')}</div>`, true)
  }

  if (Array.isArray(course.target_audience) && course.target_audience.filter(Boolean).length) {
    sectionHtml.target = sectionWrap('Who is this course for?', `<div style="display:flex;flex-direction:column;gap:10px;">${course.target_audience.filter(Boolean).map((t: string) =>
      `<div style="padding:14px 18px;border:1px solid ${c.borderSoft};border-radius:10px;background:${c.cardBg};color:${c.textSecondary};">${escapeHtml(t)}</div>`
    ).join('')}</div>`)
  }

  if (Array.isArray(course.what_you_will_learn) && course.what_you_will_learn.filter(Boolean).length) {
    sectionHtml.learn = sectionWrap("What you'll learn", `<div style="display:flex;flex-direction:column;gap:10px;">${course.what_you_will_learn.filter(Boolean).map((t: string) =>
      `<div style="padding:14px 18px;border:1px solid ${c.borderSoft};border-radius:10px;background:${c.cardBg};color:${c.textSecondary};">✓ ${escapeHtml(t)}</div>`
    ).join('')}</div>`, true)
  }

  if (Array.isArray(course.requirements) && course.requirements.filter(Boolean).length) {
    sectionHtml.requirements = sectionWrap('Requirements', `<ul style="line-height:1.9;color:${c.textSecondary};">${course.requirements.filter(Boolean).map((t: string) =>
      `<li>${escapeHtml(t)}</li>`
    ).join('')}</ul>`)
  }

  if (Array.isArray(landingConfig.bonuses) && landingConfig.bonuses.length) {
    sectionHtml.bonuses = sectionWrap("What's included", `<div style="display:flex;flex-direction:column;gap:10px;">${landingConfig.bonuses.map((b) =>
      `<div style="padding:14px 18px;border:1px solid ${c.borderSoft};border-radius:10px;background:${c.cardBg};"><p style="font-weight:700;color:${c.textPrimary};margin:0 0 4px;">${escapeHtml(b.title)}</p>${b.description ? `<p style="font-size:0.85rem;color:${c.textSecondary};margin:0;">${escapeHtml(b.description)}</p>` : ''}</div>`
    ).join('')}</div>`, true)
  }

  if (lessons.length) {
    sectionHtml.curriculum = sectionWrap('Curriculum', `<ol style="display:flex;flex-direction:column;gap:8px;padding:0;margin:0;list-style:none;">${lessons.map((l, i) =>
      `<li style="padding:12px 16px;border:1px solid ${c.borderSoft};border-radius:8px;background:${c.cardBg};color:${c.textSecondary};"><span style="color:${c.accentText};font-weight:700;margin-right:8px;">${String(i + 1).padStart(2, '0')}</span>${escapeHtml(l.title)}</li>`
    ).join('')}</ol>`)
  }

  const instructors = [
    { name: course.host_name, title: course.instructor_title || 'Course Instructor', bio: course.about_creator, image: course.host_image },
    ...(Array.isArray(course.co_instructors) ? course.co_instructors : []),
  ].filter(i => i && i.name)
  if (instructors.length) {
    sectionHtml.instructor = sectionWrap(instructors.length > 1 ? 'Meet your instructors' : 'Meet your instructor',
      `<div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">${instructors.map((inst: any) => `
        <div style="flex:1 1 220px;max-width:260px;text-align:center;border:1px solid ${c.borderSoft};border-radius:14px;padding:24px;background:${c.cardBg};">
          ${inst.image ? `<img src="${escapeHtml(inst.image)}" alt="${escapeHtml(inst.name)}" style="width:80px;height:80px;border-radius:12px;object-fit:cover;margin:0 auto 12px;display:block;border:3px solid ${c.accentBorderStrong};" />` : ''}
          <div style="font-family:${headingFont};font-weight:800;color:${c.textPrimary};">${escapeHtml(inst.name)}</div>
          <div style="font-size:0.75rem;color:${c.accentText};text-transform:uppercase;letter-spacing:0.05em;margin:4px 0 10px;font-weight:700;">${escapeHtml(inst.title || '')}</div>
          ${inst.bio ? `<p style="font-size:0.85rem;color:${c.textSecondary};line-height:1.6;">${escapeHtml(inst.bio)}</p>` : ''}
        </div>`).join('')}
      </div>`)
  }

  if (Array.isArray(course.testimonials) && course.testimonials.filter((t: any) => t?.name && t?.text).length) {
    sectionHtml.testimonials = sectionWrap('What students say', `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">${course.testimonials.filter((t: any) => t?.name && t?.text).map((t: any) =>
      `<div style="border:1px solid ${c.borderSoft};border-radius:12px;padding:20px;background:${c.cardBg};"><p style="font-size:0.9rem;line-height:1.7;margin:0 0 10px;color:${c.textSecondary};">"${escapeHtml(t.text)}"</p><p style="font-weight:700;font-size:0.85rem;margin:0;color:${c.textPrimary};">— ${escapeHtml(t.name)}</p></div>`
    ).join('')}</div>`, true)
  }

  if (Array.isArray(course.faq) && course.faq.filter((f: any) => f?.question && f?.answer).length) {
    sectionHtml.faq = sectionWrap('Frequently asked questions', `<div style="display:flex;flex-direction:column;gap:12px;">${course.faq.filter((f: any) => f?.question && f?.answer).map((f: any) =>
      `<div style="border:1px solid ${c.borderSoft};border-radius:10px;padding:16px 18px;background:${c.cardBg};"><p style="font-weight:700;margin:0 0 8px;color:${c.textPrimary};">${escapeHtml(f.question)}</p><p style="color:${c.textSecondary};font-size:0.9rem;line-height:1.6;margin:0;">${escapeHtml(f.answer)}</p></div>`
    ).join('')}</div>`, true)
  }

  if (course.refund_policy_text || (course.refund_window_days && course.refund_window_days > 0)) {
    sectionHtml.refund = sectionWrap('Refund Policy', `<p style="color:${c.textSecondary};line-height:1.7;">${escapeHtml(course.refund_policy_text || `Refunds available within ${course.refund_window_days} days.`)}</p>`)
  }

  if (landingConfig.disclaimer?.text?.trim()) {
    sectionHtml.disclaimer = sectionWrap(landingConfig.disclaimer.title || 'Important information', `<p style="color:${c.textSecondary};line-height:1.7;">${escapeHtml(landingConfig.disclaimer.text)}</p>`)
  }

  const body = order
    .filter(type => type !== 'hero' && type !== 'finalCta')
    .map(type => sectionHtml[type] || '')
    .join('\n')

  const promoVideoNote = course.promo_video_url
    ? `<!-- Promo video: ${escapeHtml(course.promo_video_url)} — intentionally not embedded here (a video iframe nested inside this custom page's own sandboxed frame doesn't load reliably). To change or re-add the video, update the Promo Video URL in Course Settings, not here — it'll flow into future exports automatically. -->`
    : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(name)} — reference export (buy button is a non-working placeholder)</title>
<style>
  @import url('${fontImportUrl}');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${bodyFont}; color: ${c.textPrimary}; background: ${c.bg}; }
</style>
</head>
<body>
<!--
  REFERENCE EXPORT — built directly from this course's data and its actual
  selected theme/fonts/section order, not the live rendered page. Hand this
  to an LLM along with what you want changed. The buy button above is a
  plain placeholder, not a working purchase flow — that depends on a
  logged-in session that won't exist once this is pasted elsewhere. Have
  your AI tool turn it into a plain link if needed.
-->
${promoVideoNote}
${heroHtml}
${body}
${finalCtaHtml}
</body>
</html>`
}
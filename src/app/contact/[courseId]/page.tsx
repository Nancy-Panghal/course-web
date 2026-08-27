// src/app/contact/[courseId]/page.tsx
//
// Public, theme-matched Contact page — shows a creator's contact email
// and/or phone for a course, only when "Show this on my landing page"
// is on. Linked from the landing page footer next to Privacy/Refund.
// Mirrors src/app/policy/[courseId]/[type]/page.tsx.

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Shield, ArrowLeft, Mail, Phone } from 'lucide-react'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function CourseContactPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name, brand_name, brand_logo_url, landing_theme, landing_font_pair, contact_email, contact_phone, show_contact_on_landing')
    .eq('id', courseId)
    .single()

  if (!course) notFound()
  if (!course.show_contact_on_landing || (!course.contact_email && !course.contact_phone)) notFound()

  const theme = getLandingTheme(course.landing_theme)
  const c = theme.colors
  const fontOverride = getFontPairOverride(course.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  const brandName = course.brand_name || course.host_name || 'this creator'

  return (
    <div className="min-h-screen" style={{ background: c.bg, color: c.textPrimary, fontFamily: fonts.body }}>
      <style>{`
        @import url('${fonts.googleFontsImportUrl}');
        .pd-heading { font-family: ${fonts.heading}; }
      `}</style>

      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: c.border }}>
        <div className="flex items-center gap-2">
          {course.brand_logo_url ? (
            <img src={course.brand_logo_url} alt={brandName} className="h-6 max-w-[120px] object-contain" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.accentGradient }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="font-semibold" style={{ color: c.textPrimary }}>{brandName}</span>
        </div>
        <Link href={`/enroll/${courseId}`} className="flex items-center gap-2 text-sm" style={{ color: c.textMuted }}>
          <ArrowLeft className="w-4 h-4" />
          Back to course
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="pd-heading text-4xl font-bold mb-3" style={{ color: c.textPrimary }}>
          Contact
        </h1>
        <p className="text-sm mb-12" style={{ color: c.textMuted }}>
          Reach {brandName} directly about {course.name}
        </p>

        <div className="flex flex-col gap-4">
          {course.contact_email && (
            <a href={`mailto:${course.contact_email}`} className="flex items-center gap-3 px-5 py-4 rounded-xl"
              style={{ border: `1px solid ${c.border}` }}>
              <Mail className="w-5 h-5" style={{ color: c.accentText }} />
              <span style={{ color: c.textSecondary }}>{course.contact_email}</span>
            </a>
          )}
          {course.contact_phone && (
            <a href={`tel:${course.contact_phone}`} className="flex items-center gap-3 px-5 py-4 rounded-xl"
              style={{ border: `1px solid ${c.border}` }}>
              <Phone className="w-5 h-5" style={{ color: c.accentText }} />
              <span style={{ color: c.textSecondary }}>{course.contact_phone}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
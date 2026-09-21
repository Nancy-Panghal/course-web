// src/app/contact/[courseId]/page.tsx
//
// Public, theme-matched Contact page — shows a creator's contact email
// and/or phone for a course, only when "Show this on my landing page"
// is on. Linked from the landing page footer next to Privacy/Refund.
// Mirrors src/app/policy/[courseId]/[type]/page.tsx.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'
import ContactDetails from '@/components/ContactDetails'
import { getRenderableContactDetails } from '@/lib/contact-details'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Per-course contact page linked from the course footer — keep it out of
// search (it used to inherit the homepage's title, description and canonical).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CourseContactPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name, brand_name, brand_logo_url, landing_theme, landing_font_pair, contact_details')
    .eq('id', courseId)
    .single()

  if (!course) notFound()
  // Only entries the creator chose to show somewhere on the landing page.
  const contacts = getRenderableContactDetails(course.contact_details)
    .filter(d => d.show_below_description || d.show_in_footer)
  if (contacts.length === 0) notFound()

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

                <ContactDetails entries={contacts} variant="block" colors={c} headingFont={fonts.heading} />
      </div>
    </div>
  )
}
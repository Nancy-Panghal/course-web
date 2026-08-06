// src/app/course/[courseId]/policy/[type]/page.tsx
//
// Public, theme-matched renderer for a creator's uploaded Refund Policy /
// Terms & Conditions / Privacy Policy. Linked from the course landing page
// footer. Pulls the raw .txt/.md file the creator uploaded and renders it
// as heading + paragraph blocks (see src/lib/policyDocs.ts for the format).

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'
import { parsePolicyDoc, POLICY_DOC_LABELS, type PolicyDocType } from '@/lib/policyDocs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KURSO_EQUIVALENT: Record<PolicyDocType, string> = {
  refund: '/refund-policy',
  terms: '/terms',
  privacy: '/privacy',
}

function getDocPath(course: any, t: PolicyDocType): string | null {
  if (t === 'refund') return course.refund_policy_storage_path || null
  if (t === 'terms') return course.terms_storage_path || null
  return course.privacy_storage_path || null
}

export default async function CoursePolicyPage({
  params,
}: {
  params: Promise<{ courseId: string; type: string }>
}) {
  const { courseId, type } = await params
  if (type !== 'refund' && type !== 'terms' && type !== 'privacy') notFound()
  const docType = type as PolicyDocType

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name, brand_name, brand_logo_url, landing_theme, landing_font_pair, refund_policy_storage_path, terms_storage_path, privacy_storage_path')
    .eq('id', courseId)
    .single()

  if (!course) notFound()

  const storagePath = getDocPath(course, docType)
  if (!storagePath) notFound()

  const fileRes = await fetch(storagePath, { cache: 'no-store' })
  if (!fileRes.ok) notFound()
  const raw = await fileRes.text()
  const blocks = parsePolicyDoc(raw)

  const theme = getLandingTheme(course.landing_theme)
  const c = theme.colors
  const fontOverride = getFontPairOverride(course.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  const brandName = course.brand_name || course.host_name || 'this creator'
  const siblingDocs = (['refund', 'terms', 'privacy'] as PolicyDocType[]).filter(
    t => t !== docType && getDocPath(course, t)
  )

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
          {POLICY_DOC_LABELS[docType]}
        </h1>
        <p className="text-sm mb-12" style={{ color: c.textMuted }}>
          For {course.name}, provided by {brandName}
        </p>

        <div className="flex flex-col gap-10">
          {blocks.map((b, i) => (
            <div key={i}>
              <h2 className="pd-heading text-xl font-bold mb-2" style={{ color: c.textPrimary }}>{b.heading}</h2>
              {b.body.split(/\n{2,}/).map((para, j) => (
                <p key={j} className="mb-3" style={{ color: c.textSecondary, fontSize: '1rem', lineHeight: 1.8 }}>
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>

        {siblingDocs.length > 0 && (
          <div className="mt-16 pt-8 flex flex-wrap gap-x-6 gap-y-2" style={{ borderTop: `1px solid ${c.border}` }}>
            {siblingDocs.map(t => (
              <Link key={t} href={`/course/${courseId}/policy/${t}`} className="text-sm font-medium" style={{ color: c.accentText }}>
                {POLICY_DOC_LABELS[t]}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <p className="w-full text-xs mb-1" style={{ color: c.textFaint }}>Kurso's own platform policies:</p>
          {(['refund', 'terms', 'privacy'] as PolicyDocType[]).map(t => (
            <a key={t} href={KURSO_EQUIVALENT[t]} className="text-xs" style={{ color: c.textMuted }}>
              Kurso {POLICY_DOC_LABELS[t]}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
// src/components/PolicyDocView.tsx
//
// Theme-matched page for a creator's uploaded policy document (refund, terms,
// privacy), rendered as heading + paragraph blocks (see lib/policyDocs.ts).
// Used by the workshop policy pages. The course policy page has its own copy of
// this markup and can switch to this component later.
// All text goes through React, never innerHTML.

import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import type { LandingThemeColors } from '@/lib/landing-themes/types'
import type { PolicyBlock } from '@/lib/policyDocs'

export default function PolicyDocView({ colors: c, fonts, brandName, brandLogoUrl, title, subtitle, blocks, backHref, backLabel, siblings }: {
  colors: LandingThemeColors
  fonts: { heading: string; body: string; googleFontsImportUrl: string }
  brandName: string
  brandLogoUrl: string | null
  title: string
  subtitle: string
  blocks: PolicyBlock[]
  backHref: string
  backLabel: string
  siblings: { href: string; label: string }[]
}) {
  return (
    <div className="min-h-screen" style={{ background: c.bg, color: c.textPrimary, fontFamily: fonts.body }}>
      <style>{`
        @import url('${fonts.googleFontsImportUrl}');
        .pd-heading { font-family: ${fonts.heading}; }
      `}</style>

      <div className="border-b px-6 py-4 flex items-center justify-between gap-4" style={{ borderColor: c.border }}>
        <div className="flex items-center gap-2 min-w-0">
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt={brandName} className="h-6 max-w-[120px] object-contain" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.accentGradient }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="font-semibold truncate" style={{ color: c.textPrimary }}>{brandName}</span>
        </div>
        <Link href={backHref} className="flex items-center gap-2 text-sm shrink-0" style={{ color: c.textSecondary }}>
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="pd-heading text-4xl font-bold mb-3" style={{ color: c.textPrimary }}>{title}</h1>
        <p className="text-sm mb-12" style={{ color: c.textSecondary }}>{subtitle}</p>

        <div className="flex flex-col gap-10">
          {blocks.map((b, i) => (
            <div key={i}>
              <h2 className="pd-heading text-xl font-bold mb-2" style={{ color: c.textPrimary }}>{b.heading}</h2>
              {b.body.split(/\n{2,}/).map((para, j) => (
                <p key={j} className="mb-3" style={{ color: c.textSecondary, fontSize: '1rem', lineHeight: 1.8 }}>{para}</p>
              ))}
            </div>
          ))}
        </div>

        {siblings.length > 0 && (
          <div className="mt-16 pt-8 flex flex-wrap gap-x-6 gap-y-2" style={{ borderTop: `1px solid ${c.border}` }}>
            {siblings.map(s => (
              <Link key={s.href} href={s.href} className="text-sm font-medium" style={{ color: c.accentText }}>{s.label}</Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
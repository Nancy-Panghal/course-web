// src/app/w/[creatorSlug]/[workshopSlug]/policy/[type]/page.tsx
//
// Public, theme-matched Refund Policy / Terms / Privacy page for a workshop,
// linked from the workshop page footer. Renders the .txt/.md file the creator
// uploaded (format: see lib/policyDocs.ts).
//
// SECURITY: the file is fetched by the SERVER, so the stored URL is only
// followed when it points into this project's own public storage bucket. A
// creator can write any text into that column, and an unchecked server-side
// fetch could be aimed at internal addresses.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PolicyDocView from '@/components/PolicyDocView'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'
import { parsePolicyDoc, POLICY_DOC_LABELS, type PolicyDocType } from '@/lib/policyDocs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// A creator's own policy text: no reason for it to appear in search.
export const metadata: Metadata = { robots: { index: false, follow: false } }

const MAX_POLICY_CHARS = 40000

const isOwnStorageUrl = (url: string) =>
  url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lessons/`)

export default async function WorkshopPolicyPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; workshopSlug: string; type: string }>
}) {
  const { creatorSlug, workshopSlug, type } = await params
  if (type !== 'refund' && type !== 'terms' && type !== 'privacy') notFound()
  const docType = type as PolicyDocType

  const { data: creator } = await supabase.from('creators').select('id, name').eq('creator_slug', creatorSlug).maybeSingle()
  if (!creator) notFound()

  const { data: workshop } = await supabase
    .from('workshops')
    .select('title, host_name, brand_name, brand_logo_url, landing_theme, landing_font_pair, refund_policy_storage_path, terms_storage_path, privacy_storage_path')
    .eq('creator_id', creator.id)
    .eq('slug', workshopSlug)
    .eq('status', 'published')
    .maybeSingle()
  if (!workshop) notFound()

  const pathFor = (t: PolicyDocType): string | null =>
    (t === 'refund' ? workshop.refund_policy_storage_path : t === 'terms' ? workshop.terms_storage_path : workshop.privacy_storage_path) || null

  const url = pathFor(docType)
  if (!url) notFound()
  if (!isOwnStorageUrl(url)) {
    console.warn('[workshop policy] refused to fetch a policy file outside project storage', { creatorSlug, workshopSlug, type })
    notFound()
  }

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) notFound()
  const blocks = parsePolicyDoc((await res.text()).slice(0, MAX_POLICY_CHARS))

  const theme = getLandingTheme(workshop.landing_theme)
  const fontOverride = getFontPairOverride(workshop.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  const basePath = `/w/${creatorSlug}/${workshopSlug}`
  const brandName = workshop.brand_name || workshop.host_name || creator.name
  return (
    <PolicyDocView
      colors={theme.colors}
      fonts={fonts}
      brandName={brandName}
      brandLogoUrl={workshop.brand_logo_url || null}
      title={POLICY_DOC_LABELS[docType]}
      subtitle={`For ${workshop.title}, provided by ${brandName}`}
      blocks={blocks}
      backHref={basePath}
      backLabel="Back to workshop"
      siblings={(['refund', 'terms', 'privacy'] as PolicyDocType[])
        .filter(t => t !== docType && pathFor(t))
        .map(t => ({ href: `${basePath}/policy/${t}`, label: POLICY_DOC_LABELS[t] }))}
    />
  )
}
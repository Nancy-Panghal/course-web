import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import EbookPageClient from './EbookPageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toMetaDescription(raw: string | null | undefined, fallback: string): string {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 155 ? `${text.slice(0, 152)}...` : text
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ebookId: string }>
}): Promise<Metadata> {
  const { ebookId } = await params

  const { data: ebook } = await supabase
    .from('ebooks')
    .select('title, description, cover_image_url, is_published')
    .eq('id', ebookId)
    .maybeSingle()

  if (!ebook) {
    return { title: 'Ebook not found' }
  }

  const title = ebook.title
  const description = toMetaDescription(ebook.description, `Get ${ebook.title} on Kurso.`)
  const image = ebook.cover_image_url || '/icon.jpg'

  return {
    title,
    description,
    robots: ebook.is_published ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: 'website', title, description, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function EbookStorefrontPage({
  params,
}: {
  params: Promise<{ ebookId: string }>
}) {
  const { ebookId } = await params
  return <EbookPageClient ebookId={ebookId} />
}
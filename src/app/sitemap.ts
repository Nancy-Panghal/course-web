import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

// Next.js auto-serves this at /sitemap.xml — no separate static file needed.
// Regenerated on every request (Next.js caches it briefly on its own), so
// newly published courses and creators show up without a manual rebuild.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kurso.in').replace(/\/$/, '')

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/refund-policy`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Only published courses belong in the sitemap — draft/unpublished
  // courses shouldn't be offered to Google for indexing at all.
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, host_name')
    .eq('is_published', true)

  const coursePages: MetadataRoute.Sitemap = (courses || []).map((course) => ({
    url: `${base}/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name || 'course')}/${course.id}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const { data: creators } = await supabase
    .from('creators')
    .select('creator_slug')
    .not('creator_slug', 'is', null)

  const creatorPages: MetadataRoute.Sitemap = (creators || [])
    .filter((c) => c.creator_slug)
    .map((creator) => ({
      url: `${base}/creator/${creator.creator_slug}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

  const { data: ebooks } = await supabase
    .from('ebooks')
    .select('id')
    .eq('is_published', true)

  const ebookPages: MetadataRoute.Sitemap = (ebooks || []).map((ebook) => ({
    url: `${base}/ebook/${ebook.id}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...staticPages, ...coursePages, ...creatorPages, ...ebookPages]
}
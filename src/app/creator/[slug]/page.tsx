import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ArrowRight, Shield } from 'lucide-react'
import type { Metadata } from 'next'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  const { data: creator } = await supabase
    .from('creators')
    .select('name, creator_bio, creator_photo_url')
    .eq('creator_slug', slug)
    .maybeSingle()

  if (!creator) {
    return { title: 'Creator not found' }
  }

  const title = `${creator.name} on Kurso`
  const description = creator.creator_bio
    ? creator.creator_bio.replace(/\s+/g, ' ').trim().slice(0, 155)
    : `Courses by ${creator.name}, delivered through WhatsApp and Telegram.`
  const image = creator.creator_photo_url || '/icon.jpg'

  return {
    title,
    description,
    openGraph: { type: 'profile', title, description, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function CreatorStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: creator } = await supabase
    .from('creators')
    .select('id, name, creator_slug, creator_bio, creator_photo_url')
    .eq('creator_slug', slug)
    .maybeSingle()

  if (!creator) notFound()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, slug, description, price, original_price, host_image, about_creator, host_name')
    .eq('creator_id', creator.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const bio = creator.creator_bio || courses?.[0]?.about_creator || ''
  const photo = creator.creator_photo_url || courses?.[0]?.host_image || ''
  const displayName = creator.name || courses?.[0]?.host_name || 'Instructor'

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white">Kurso</span>
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-5 mb-4">
          {photo ? (
            <img src={photo} alt={displayName} className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'rgba(var(--kurso-primary-rgb), 0.2)' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <p className="text-sm" style={{ color: '#52525b' }}>@{creator.creator_slug}</p>
          </div>
        </div>

        {bio && (
          <p className="text-sm leading-relaxed mb-10" style={{ color: '#a1a1aa' }}>{bio}</p>
        )}

        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#52525b' }}>
          {courses?.length || 0} course{(courses?.length || 0) !== 1 ? 's' : ''}
        </h2>

        <div className="flex flex-col gap-3">
          {(courses || []).map((course) => {
            const courseSlug = slugify(course.slug || course.name)
            const href = `/about-course/${creator.creator_slug}/${courseSlug}/${course.id}`
            return (
              <Link key={course.id} href={href}
                className="flex items-center justify-between gap-4 p-5 rounded-2xl transition-all group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{course.name}</h3>
                  {course.description && (
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: '#71717a' }}>{course.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--kurso-primary-light)' }}>₹{course.price?.toLocaleString('en-IN')}</span>
                    {course.original_price > course.price && (
                      <span className="text-xs line-through" style={{ color: '#52525b' }}>₹{course.original_price?.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-1" style={{ color: '#52525b' }} />
              </Link>
            )
          })}

          {(!courses || courses.length === 0) && (
            <p className="text-sm text-center py-12" style={{ color: '#52525b' }}>No published courses yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
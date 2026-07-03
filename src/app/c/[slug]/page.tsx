import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function SlugRedirectPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, name, host_name')
    .eq('slug', slug)
    .single()

  if (!course) {
    notFound()
  }

  const creatorSlug = slugify(course.host_name || 'instructor')
  const courseSlug = slugify(course.name)

  redirect(`/about-course/${creatorSlug}/${courseSlug}/${course.id}`)
}

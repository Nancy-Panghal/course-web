/**
 * GET  — public, fetches a creator's storefront data by slug (used by /creator/[slug])
 * POST — creator-only, sets/updates their own slug, bio, photo
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

    const { data: creator, error } = await supabase
      .from('creators')
      .select('id, name, creator_slug, creator_bio, creator_photo_url')
      .eq('creator_slug', slug)
      .maybeSingle()

    if (error) throw error
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, name, slug, description, price, original_price, host_image, about_creator, host_name')
      .eq('creator_id', creator.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (coursesError) throw coursesError

    return NextResponse.json({
      creator: {
        name: creator.name,
        slug: creator.creator_slug,
        bio: creator.creator_bio || '',
        photoUrl: creator.creator_photo_url || '',
      },
      courses: courses || [],
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'public-profile GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCreator(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug, bio, photoUrl, businessAddress, gstin } = await req.json()

    const { data: existing } = await supabase
      .from('creators')
      .select('creator_slug')
      .eq('id', user.id)
      .maybeSingle()

    const updates: any = {}

    if (bio !== undefined) updates.creator_bio = String(bio).trim() || null
    if (photoUrl !== undefined) updates.creator_photo_url = photoUrl || null
    if (businessAddress !== undefined) updates.creator_business_address = String(businessAddress).trim() || null
    if (gstin !== undefined) updates.creator_gstin = String(gstin).trim().toUpperCase() || null

    if (slug !== undefined && slug !== existing?.creator_slug) {
      const cleanSlug = slugify(String(slug))
      if (!cleanSlug) {
        return NextResponse.json({ error: 'Please enter a valid handle (letters, numbers, hyphens).' }, { status: 400 })
      }

      const { data: taken } = await supabase
        .from('creators')
        .select('id')
        .eq('creator_slug', cleanSlug)
        .neq('id', user.id)
        .maybeSingle()

      if (taken) {
        return NextResponse.json({ error: `"${cleanSlug}" is already taken. Try another.` }, { status: 409 })
      }

      updates.creator_slug = cleanSlug
    }

    const { error: updateError } = await supabase.from('creators').update(updates).eq('id', user.id)
    if (updateError) throw updateError

    return NextResponse.json({ ok: true, slug: updates.creator_slug || existing?.creator_slug })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'public-profile POST')
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as 'video' | 'pdf' | 'image'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!['video', 'pdf', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 })
    }

    if (type === 'image' && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload an image file' }, { status: 400 })
    }

    // 1. Generate a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${type}s/${fileName}`

    // 2. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('lessons')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Supabase storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lessons')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })

  } catch (err: any) {
    console.error('Upload API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

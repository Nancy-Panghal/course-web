import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { fileName, contentType, folder } = await req.json()

    if (!fileName || !contentType || !folder) {
      return NextResponse.json({ error: 'fileName, contentType, folder required' }, { status: 400 })
    }

    const ext = fileName.split('.').pop()
    const safeName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('lessons')
      .createSignedUploadUrl(safeName)

    if (error) {
      console.error('Signed URL error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lessons/${safeName}`

    return NextResponse.json({ signedUrl: data.signedUrl, publicUrl })
  } catch (err: any) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
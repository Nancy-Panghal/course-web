import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json({ error: 'path parameter required' }, { status: 400 })
    }

    // Get file extension to determine content type
    const ext = path.split('.').pop()?.toLowerCase()

    // Map extensions to content types
    const contentTypeMap: Record<string, string> = {
      txt: 'text/plain; charset=utf-8',
      md: 'text/markdown; charset=utf-8',
      markdown: 'text/markdown; charset=utf-8',
      pdf: 'application/pdf',
    }

    const contentType = contentTypeMap[ext || ''] || 'text/plain; charset=utf-8'

    // Fetch file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('lessons')
      .download(path)

    if (error) {
      console.error('File download error:', error.message)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Convert blob to buffer
    const buffer = await data.arrayBuffer()

    // Return file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.split('/').pop()}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: any) {
    console.error('Resource view route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

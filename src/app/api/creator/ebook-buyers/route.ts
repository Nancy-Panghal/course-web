import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ebookId = req.nextUrl.searchParams.get('ebookId')
    if (!ebookId) return NextResponse.json({ error: 'Missing ebookId' }, { status: 400 })

    const { data: ebook } = await supabase.from('ebooks').select('id').eq('id', ebookId).eq('creator_id', userData.user.id).maybeSingle()
    if (!ebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('transactions')
      .select('id, student_name, student_email, amount, status, created_at, ebook_download_count, ebook_download_limit')
      .eq('ebook_id', ebookId)
      .eq('product_type', 'ebook')
      .in('status', ['success', 'refunded'])
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({ buyers: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/ebook-buyers')
  }
}
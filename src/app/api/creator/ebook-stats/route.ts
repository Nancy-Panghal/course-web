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
    let query = supabase
      .from('transactions')
      .select('amount, created_at, ebook_download_count')
      .eq('product_type', 'ebook')
      .eq('creator_id', userData.user.id)
      .eq('status', 'success')
    if (ebookId) query = query.eq('ebook_id', ebookId)

    const { data: purchases, error } = await query
    if (error) throw error

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const buyers = purchases?.length || 0
    const totalRevenue = (purchases || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const thisMonthRevenue = (purchases || []).filter(p => new Date(p.created_at) >= monthStart).reduce((sum, p) => sum + Number(p.amount), 0)
    const totalDownloads = (purchases || []).reduce((sum, p) => sum + (p.ebook_download_count || 0), 0)

    return NextResponse.json({ buyers, totalRevenue, thisMonthRevenue, totalDownloads })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/ebook-stats')
  }
}
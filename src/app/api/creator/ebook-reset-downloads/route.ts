import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { purchaseId } = await req.json()
    if (!purchaseId) return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 })

    const { data: purchase } = await supabase
      .from('transactions')
      .select('id, creator_id')
      .eq('id', purchaseId)
      .eq('product_type', 'ebook')
      .maybeSingle()
    if (!purchase || purchase.creator_id !== userData.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await supabase.from('transactions').update({ ebook_download_count: 0 }).eq('id', purchaseId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/ebook-reset-downloads')
  }
}
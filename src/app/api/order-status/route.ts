import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const clientTxnId = req.nextUrl.searchParams.get('clientTxnId')
  if (!clientTxnId) return NextResponse.json({ error: 'Missing clientTxnId' }, { status: 400 })

    let { data, error } = await supabase
    .from('transactions')
    .select('status, enrollment_id')
    .eq('id', clientTxnId)
    .maybeSingle()

  if (!data) {
    const sub = await supabase.from('subscriptions').select('status').eq('id', clientTxnId).maybeSingle()
    data = sub.data ? { status: sub.data.status, enrollment_id: null } : null
    error = sub.error
  }

  if (!data) {
    const invoice = await supabase.from('revenue_share_invoices').select('status').eq('id', clientTxnId).maybeSingle()
    // The invoice flow's "success" state is status: 'paid', not 'active' —
    // translate it here so the shared polling helper (which only checks
    // for 'active' | 'success') doesn't need to know about invoices at all.
    data = invoice.data ? { status: invoice.data.status === 'paid' ? 'success' : invoice.data.status, enrollment_id: null } : null
    error = invoice.error
  }

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ status: data.status, enrollmentId: data.enrollment_id })
}

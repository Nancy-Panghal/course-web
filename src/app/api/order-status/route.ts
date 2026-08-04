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

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ status: data.status, enrollmentId: data.enrollment_id })
}

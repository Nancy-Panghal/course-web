import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const paymentId = body?.paymentId
    if (!paymentId) return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })

    const { data: payment, error: paymentError } = await supabase
      .from('kurso_subscription_payments')
      .select('id, creator_id, plan_name, amount, paid_at')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentError || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    if (payment.creator_id !== authData.user.id) {
      return NextResponse.json({ error: 'You do not have access to this invoice.' }, { status: 403 })
    }

    // Check existing invoice
    let invoiceRow = await supabase
      .from('kurso_invoices')
      .select('*')
      .eq('subscription_payment_id', payment.id)
      .maybeSingle()
      .then((r) => r.data)

    if (!invoiceRow) {
      const { data: seqResult, error: seqError } = await supabase.rpc('next_kurso_invoice_sequence')
      if (seqError) throw seqError

      const invoiceNumber = `KURSO-INV-${String(seqResult).padStart(4, '0')}`

      const { data: inserted, error: insertError } = await supabase
        .from('kurso_invoices')
        .insert({
          creator_id: payment.creator_id,
          subscription_payment_id: payment.id,
          invoice_number: invoiceNumber,
          invoice_sequence_num: seqResult,
          plan_name: payment.plan_name,
          amount: payment.amount,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      invoiceRow = inserted
    }

    return NextResponse.json({ invoice: invoiceRow })
  } catch (err: any) {
    console.error('[creator/kurso-invoice/create]', err)
    return NextResponse.json({ error: 'Could not create invoice. Please try again.' }, { status: 500 })
  }
}

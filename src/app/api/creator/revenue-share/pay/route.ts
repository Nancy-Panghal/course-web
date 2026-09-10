import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createKursoSubscriptionOrder, KursoCashfreeError } from '@/lib/kurso-cashfree'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const creatorId = userData.user.id

    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })

    const { data: invoice, error: invErr } = await supabase
      .from('revenue_share_invoices')
      .select('id, creator_id, total_amount_due, status, period_start')
      .eq('id', invoiceId)
      .maybeSingle()
    if (invErr) throw invErr
    if (!invoice || invoice.creator_id !== creatorId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 400 })
    }
    if (invoice.status === 'waived') {
      return NextResponse.json({ error: 'This invoice was waived — nothing to pay.' }, { status: 400 })
    }
    if (invoice.total_amount_due <= 0) {
      return NextResponse.json({ error: 'Nothing due for this period.' }, { status: 400 })
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('name, email')
      .eq('id', creatorId)
      .maybeSingle()

    try {
      const order = await createKursoSubscriptionOrder({
        orderId: invoice.id,
        amount: invoice.total_amount_due,
        customerName: creator?.name || creator?.email || 'Creator',
        customerEmail: creator?.email || '',
        returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade?revenue_share_invoice=${invoice.id}`,
      })

      await supabase
        .from('revenue_share_invoices')
        .update({ gateway_order_id: order.order_id })
        .eq('id', invoice.id)

      return NextResponse.json({
        clientTxnId: invoice.id,
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        amount: invoice.total_amount_due,
      })
    } catch (err: any) {
      const msg = err instanceof KursoCashfreeError ? err.message : 'Could not start this payment.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/revenue-share/pay POST')
  }
}
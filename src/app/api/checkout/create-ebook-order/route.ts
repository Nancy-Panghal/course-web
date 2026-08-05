import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getCreatorCheckoutGateway, createCheckoutOrder, CheckoutOrderError } from '@/lib/gateway-checkout'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { ebookId, buyerName, buyerEmail, buyerPhone } = await req.json()
    if (!ebookId) {
      return NextResponse.json({ error: 'Missing ebook ID' }, { status: 400 })
    }
    if (!buyerName?.trim() || !buyerEmail?.trim()) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    const { data: ebookRows, error: ebookError } = await supabase
      .from('ebooks')
      .select('id, title, price, creator_id, is_published')
      .eq('id', ebookId)
      .limit(1)

    const ebook = ebookRows?.[0]
    if (ebookError || !ebook) {
      return NextResponse.json({ error: 'Ebook not found' }, { status: 404 })
    }
    if (!ebook.is_published) {
      return NextResponse.json({ error: 'This ebook is not currently available for purchase.' }, { status: 403 })
    }

    const amount = Number(ebook.price)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'This ebook is not correctly priced. Please contact the creator.' }, { status: 400 })
    }
    if (amount > 100000) {
      return NextResponse.json(
        { error: 'This amount exceeds what the payment gateway supports (₹1,00,000 max). Please contact the creator.' },
        { status: 400 }
      )
    }

    const gateway = await getCreatorCheckoutGateway(ebook.creator_id)
    if (!gateway) {
      return NextResponse.json(
        { error: "This creator hasn't finished setting up payments yet. Please check back shortly or contact them directly." },
        { status: 409 }
      )
    }

    const transactionId = randomUUID()
    const { error: txnError } = await supabase.from('transactions').insert({
      id: transactionId,
      client_txn_id: transactionId,
      ebook_id: ebookId,
      product_type: 'ebook',
      creator_id: ebook.creator_id,
      student_name: buyerName,
      student_email: buyerEmail,
      student_phone: buyerPhone || null,
      amount,
      original_amount: amount,
      discount_amount: 0,
      status: 'pending',
      payment_provider: gateway.provider,
    })
    if (txnError) throw txnError

    try {
      const order = await createCheckoutOrder({
        gateway,
        transactionId,
        amount,
        description: ebook.title,
        customerName: buyerName,
        customerEmail: buyerEmail,
        customerPhone: buyerPhone,
        returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/ebook/${ebookId}?order_id=${transactionId}`,
      })

      await supabase.from('transactions').update({ gateway_order_id: order.orderId }).eq('id', transactionId)

      return NextResponse.json({
        clientTxnId: transactionId,
        order,
      })
    } catch (err: any) {
      await supabase.from('transactions')
        .update({ status: 'failed', error_message: err?.message || 'Order creation failed' })
        .eq('id', transactionId)
      const msg = err instanceof CheckoutOrderError
        ? err.message
        : 'Could not start the payment. Please try again in a moment.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'checkout/create-ebook-order')
  }
}

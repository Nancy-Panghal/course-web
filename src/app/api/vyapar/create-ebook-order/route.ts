import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { createVyaparOrder, VyaparError } from '@/lib/vyapar'
import { decryptSecret } from '@/lib/creator-secrets'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { ebookId, buyerName, buyerEmail, buyerPhone } = await req.json()
    if (!ebookId) return NextResponse.json({ error: 'Missing ebookId' }, { status: 400 })

    const { data: ebook } = await supabase.from('ebooks').select('id, title, price, creator_id, is_published').eq('id', ebookId).maybeSingle()
    if (!ebook || !ebook.is_published) return NextResponse.json({ error: 'Ebook not found' }, { status: 404 })

    const { data: creator } = await supabase.from('creators').select('id, vyapar_api_key_encrypted, vyapar_onboarding_status').eq('id', ebook.creator_id).maybeSingle()
    if (!creator || creator.vyapar_onboarding_status !== 'connected' || !creator.vyapar_api_key_encrypted) {
      return NextResponse.json({ error: "This creator hasn't finished setting up payments yet." }, { status: 409 })
    }

    const transactionId = randomUUID()
    const { error: txnError } = await supabase.from('transactions').insert({
      id: transactionId,
      client_txn_id: transactionId,
      product_type: 'ebook',
      ebook_id: ebookId,
      creator_id: creator.id,
      student_name: buyerName || null,
      student_email: buyerEmail || null,
      student_phone: buyerPhone || null,
      amount: ebook.price,
      status: 'pending',
    })
    if (txnError) throw txnError

    let apiKey: string
    try {
      apiKey = decryptSecret(creator.vyapar_api_key_encrypted)
    } catch {
      await supabase.from('transactions').update({ status: 'failed', error_message: 'Could not decrypt creator API key' }).eq('id', transactionId)
      return NextResponse.json({ error: "This creator's payment setup needs attention." }, { status: 500 })
    }

    try {
      const order = await createVyaparOrder({
        apiKey,
        amount: ebook.price,
        clientTxnId: transactionId,
        customerName: buyerName || 'Reader',
        customerMobile: buyerPhone ? buyerPhone.replace(/\D/g, '').slice(-10) : undefined,
        customerEmail: buyerEmail,
        pInfo: ebook.title,
        callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/vyapar/webhook`,
      })

      await supabase.from('transactions').update({ gateway_order_id: order.order_id }).eq('id', transactionId)

      return NextResponse.json({
        clientTxnId: transactionId,
        orderId: order.order_id,
        amount: order.amount,
        qrCode: order.qr_code,
        upiIntent: order.upi_intent,
        expiresAt: order.expires_at,
      })
    } catch (err: any) {
      await supabase.from('transactions').update({ status: 'failed', error_message: err?.message || 'Vyapar order creation failed' }).eq('id', transactionId)
      const msg = err instanceof VyaparError && err.status === 401
        ? "This creator's payment account isn't authorized."
        : 'Could not start the payment. Please try again.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'vyapar/create-ebook-order')
  }
}
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthenticatedCreator, supabaseAdmin } from '../subscription-auth'
import { getSubscriptionPlan } from '../subscription-plans'

function safeCompare(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    if (left.length !== right.length) return false
    return crypto.timingSafeEqual(left, right)
  } catch {
    return false
  }
}

async function fetchRazorpayPayment(paymentId: string) {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Razorpay API error: ${res.status}`)
  return res.json()
}

async function fetchRazorpayOrder(orderId: string) {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Razorpay order API error: ${res.status}`)
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { creator, error: authError } = await getAuthenticatedCreator(req)
    if (authError || !creator) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const {
      planId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json()

    const plan = getSubscriptionPlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Invalid subscription plan.' }, { status: 400 })
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields.' }, { status: 400 })
    }

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!safeCompare(expectedSig, razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 })
    }

    const [payment, order] = await Promise.all([
      fetchRazorpayPayment(razorpay_payment_id),
      fetchRazorpayOrder(razorpay_order_id),
    ])
    const expectedAmount = plan.amount * 100

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured'
    ) {
      return NextResponse.json(
        { error: 'Payment details do not match the selected plan.' },
        { status: 400 }
      )
    }

    if (
      order.amount !== expectedAmount ||
      order.currency !== 'INR' ||
      order.notes?.purpose !== 'creator_subscription' ||
      order.notes?.creatorId !== creator.id ||
      order.notes?.planId !== plan.id
    ) {
      return NextResponse.json(
        { error: 'Subscription order details do not match this creator.' },
        { status: 400 }
      )
    }

    const { data: updatedCreator, error: updateError } = await supabaseAdmin
      .from('creators')
      .update({
        plan: plan.id,
        is_active: true,
      })
      .eq('id', creator.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      creator: updatedCreator,
      plan: {
        id: plan.id,
        name: plan.name,
      },
    })
  } catch (err: any) {
    console.error('[razorpay/verify-subscription]', err)
    return NextResponse.json(
      { error: err.message || 'Subscription payment verification failed.' },
      { status: 500 }
    )
  }
}

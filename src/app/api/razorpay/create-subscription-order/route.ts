import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { getAuthenticatedCreator } from '../subscription-auth'
import { getSubscriptionPlan } from '../subscription-plans'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const { creator, error: authError } = await getAuthenticatedCreator(req)
    if (authError || !creator) {
      return NextResponse.json({ error: authError }, { status: 401 })
    }

    const { planId, currency = 'INR' } = await req.json()
    const plan = getSubscriptionPlan(planId)

    if (!plan) {
      return NextResponse.json({ error: 'Invalid subscription plan.' }, { status: 400 })
    }

    if (currency !== 'INR') {
      return NextResponse.json({ error: 'Unsupported currency.' }, { status: 400 })
    }

    const order = await razorpay.orders.create({
      amount: plan.amount * 100,
      currency,
      notes: {
        purpose: 'creator_subscription',
        creatorId: creator.id,
        planId: plan.id,
        planName: plan.name,
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
      },
    })
  } catch (err: any) {
    console.error('[razorpay/create-subscription-order]', err)
    return NextResponse.json(
      { error: err.message || 'Unable to create subscription order.' },
      { status: 500 }
    )
  }
}

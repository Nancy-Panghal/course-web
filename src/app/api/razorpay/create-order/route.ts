import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = 'INR', courseId, creatorSlug } = await req.json()

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay takes paise
      currency,
      notes: {
        courseId,
        creatorSlug,
      },
    })

    return NextResponse.json({ orderId: order.id, amount: order.amount })
  } catch (err: any) {
    console.error('Razorpay order error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
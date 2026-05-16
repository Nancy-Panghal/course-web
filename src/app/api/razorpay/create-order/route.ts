import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@supabase/supabase-js'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { currency = 'INR', courseId, creatorSlug } = await req.json()

    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 })
    }

    const { data: courseRows, error: courseError } = await supabase
      .from('courses')
      .select('id, price')
      .eq('id', courseId)
      .limit(1)

    const course = courseRows?.[0]
    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const amountInPaise = Math.round(Number(course.price) * 100)
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return NextResponse.json({ error: 'Invalid course price' }, { status: 400 })
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
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

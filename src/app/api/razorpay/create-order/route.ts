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
    const { currency = 'INR', courseId, creatorSlug, couponCode } = await req.json()

    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 })
    }

    const { data: courseRows, error: courseError } = await supabase
      .from('courses')
      .select('id, price, is_published')
      .eq('id', courseId)
      .limit(1)

    const course = courseRows?.[0]
    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (!course.is_published) {
      return NextResponse.json({ error: 'This course is not currently available for enrollment.' }, { status: 403 })
    }

    let pricing = {
      originalAmount: Number(course.price),
      discountAmount: 0,
      finalAmount: Number(course.price),
      couponId: null as string | null,
      couponCode: null as string | null,
    }

    const normalizedCoupon = String(couponCode || '').trim()
    if (normalizedCoupon) {
      const { data: couponRows, error: couponError } = await supabase.rpc(
        'validate_coupon_for_course',
        {
          input_course_id: courseId,
          input_coupon_code: normalizedCoupon,
        }
      )

      if (couponError) throw couponError

      const coupon = couponRows?.[0]
      if (!coupon?.valid) {
        return NextResponse.json(
          { error: coupon?.reason || 'Invalid coupon code' },
          { status: 400 }
        )
      }

      pricing = {
        originalAmount: Number(coupon.original_amount),
        discountAmount: Number(coupon.discount_amount),
        finalAmount: Number(coupon.final_amount),
        couponId: coupon.coupon_id,
        couponCode: coupon.coupon_code,
      }
    }

    const amountInPaise = Math.round(Number(pricing.finalAmount) * 100)
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return NextResponse.json(
        { error: 'This coupon makes the course free. Please use the free enrollment option.' },
        { status: 400 }
      )
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      notes: {
        courseId,
        creatorSlug,
        couponId: pricing.couponId || '',
        couponCode: pricing.couponCode || '',
        originalAmount: String(pricing.originalAmount),
        discountAmount: String(pricing.discountAmount),
        finalAmount: String(pricing.finalAmount),
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      pricing,
    })
  } catch (err: any) {
    console.error('Razorpay order error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

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
    const { courseId, couponCode, studentName, studentEmail, studentPhone, returnUrl: clientReturnUrl } = await req.json()
    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 })
    }

    const { data: courseRows, error: courseError } = await supabase
      .from('courses')
      .select('id, name, price, creator_id, is_published')
      .eq('id', courseId)
      .limit(1)

    const course = courseRows?.[0]
    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (!course.is_published) {
      return NextResponse.json({ error: 'This course is not currently available for enrollment.' }, { status: 403 })
    }

    const gateway = await getCreatorCheckoutGateway(course.creator_id)
    if (!gateway) {
      return NextResponse.json(
        { error: "This creator hasn't finished setting up payments yet. Please check back shortly or contact them directly." },
        { status: 409 }
      )
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
      const { data: couponRows, error: couponError } = await supabase.rpc('validate_coupon_for_course', {
        input_course_id: courseId,
        input_coupon_code: normalizedCoupon,
      })
      if (couponError) throw couponError
      const coupon = couponRows?.[0]
      if (!coupon?.valid) {
        return NextResponse.json({ error: coupon?.reason || 'Invalid coupon code' }, { status: 400 })
      }
      pricing = {
        originalAmount: Number(coupon.original_amount),
        discountAmount: Number(coupon.discount_amount),
        finalAmount: Number(coupon.final_amount),
        couponId: coupon.coupon_id,
        couponCode: coupon.coupon_code,
      }
    }

    if (!Number.isFinite(pricing.finalAmount) || pricing.finalAmount <= 0) {
      return NextResponse.json(
        { error: 'This coupon makes the course free. Please use the free enrollment option.' },
        { status: 400 }
      )
    }
    if (pricing.finalAmount > 100000) {
      return NextResponse.json(
        { error: 'This amount exceeds what the payment gateway supports (₹1,00,000 max). Please contact the creator.' },
        { status: 400 }
      )
    }

    // Our own row's id becomes client_txn_id / receipt / order_id across all
    // three providers — the webhook trusts nothing from the payload for
    // lookups except this id chain.
    const transactionId = randomUUID()
    const { error: txnError } = await supabase.from('transactions').insert({
      id: transactionId,
      client_txn_id: transactionId,
      course_id: courseId,
      creator_id: course.creator_id,
      student_name: studentName || null,
      student_email: studentEmail || null,
      student_phone: studentPhone || null,
      amount: pricing.finalAmount,
      status: 'pending',
      coupon_id: pricing.couponId,
      coupon_code: pricing.couponCode,
      original_amount: pricing.originalAmount,
      discount_amount: pricing.discountAmount,
      payment_provider: gateway.provider,
    })
    if (txnError) throw txnError

    // Guarantee order_id is present on the return URL ourselves — never
    // depend on Cashfree/Razorpay's own return-URL templating, and never
    // trust the client-supplied URL to already have it (EnrollModal passes
    // window.location.href as-is, which doesn't include it).
    const baseReturnUrl = clientReturnUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/course/${courseId}`
    const returnUrlWithOrderId = baseReturnUrl.includes('order_id=')
      ? baseReturnUrl
      : `${baseReturnUrl}${baseReturnUrl.includes('?') ? '&' : '?'}order_id=${transactionId}`

    try {
      const order = await createCheckoutOrder({
        gateway,
        transactionId,
        amount: pricing.finalAmount,
        description: course.name,
        customerName: studentName,
        customerEmail: studentEmail,
        customerPhone: studentPhone,
        returnUrl: returnUrlWithOrderId,
      })

      // Stripe's CheckoutResult has no orderId — it's correlated by
      // client_reference_id (= our transactionId) instead, handled in
      // the webhook. Only Cashfree/Razorpay have a real gateway order id
      // to store here.
      const gatewayOrderId = 'orderId' in order ? order.orderId : null
      await supabase.from('transactions').update({ gateway_order_id: gatewayOrderId }).eq('id', transactionId)

      return NextResponse.json({
        clientTxnId: transactionId,
        pricing,
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
    return friendlyErrorResponse(err, 'checkout/create-order')
  }
}

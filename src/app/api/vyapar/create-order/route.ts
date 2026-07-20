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
    const { courseId, couponCode, studentName, studentEmail, studentPhone } = await req.json()
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

    const { data: creatorRows, error: creatorError } = await supabase
      .from('creators')
      .select('id, vyapar_api_key_encrypted, vyapar_onboarding_status')
      .eq('id', course.creator_id)
      .limit(1)

    const creator = creatorRows?.[0]
    if (creatorError || !creator || creator.vyapar_onboarding_status !== 'connected' || !creator.vyapar_api_key_encrypted) {
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

    // Our own row's id becomes client_txn_id — the webhook trusts nothing
    // from the payload for lookups, only this id chain.
    const transactionId = randomUUID()
    const { error: txnError } = await supabase.from('transactions').insert({
      id: transactionId,
      client_txn_id: transactionId,
      course_id: courseId,
      creator_id: creator.id,
      student_name: studentName || null,
      student_email: studentEmail || null,
      student_phone: studentPhone || null,
      amount: pricing.finalAmount,
      status: 'pending',
      coupon_id: pricing.couponId,
      coupon_code: pricing.couponCode,
      original_amount: pricing.originalAmount,
      discount_amount: pricing.discountAmount,
    })
    if (txnError) throw txnError

    let apiKey: string
    try {
      apiKey = decryptSecret(creator.vyapar_api_key_encrypted)
    } catch {
      await supabase.from('transactions')
        .update({ status: 'failed', error_message: 'Could not decrypt creator API key' })
        .eq('id', transactionId)
      return NextResponse.json({ error: "This creator's payment setup needs attention. Please contact them directly." }, { status: 500 })
    }

    try {
      const order = await createVyaparOrder({
        apiKey,
        amount: pricing.finalAmount,
        clientTxnId: transactionId,
        customerName: studentName || 'Student',
        customerMobile: studentPhone ? studentPhone.replace(/\D/g, '').slice(-10) : undefined,
        customerEmail: studentEmail,
        pInfo: course.name,
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
        pricing,
      })
    } catch (err: any) {
      await supabase.from('transactions')
        .update({ status: 'failed', error_message: err?.message || 'Vyapar order creation failed' })
        .eq('id', transactionId)
      const msg = err instanceof VyaparError && err.status === 401
        ? "This creator's payment account isn't authorized. Please contact them directly — their gateway key may need reconnecting."
        : 'Could not start the payment. Please try again in a moment.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'vyapar/create-order')
  }
}
import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export type RefundResult =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string }

export async function initiateRefund({
  enrollmentId,
  requireCreatorId,
  bypassWindow,
  initiatedBy,
}: {
  enrollmentId: string
  requireCreatorId?: string // if set, enrollment must belong to this creator
  bypassWindow?: boolean // admin override
  initiatedBy: 'creator' | 'admin'
}): Promise<RefundResult> {
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, creator_id, course_id, payment_id, payment_status, amount_paid, enrolled_at')
    .eq('id', enrollmentId)
    .maybeSingle()

  if (enrollError) return { ok: false, status: 500, error: 'Could not look up this enrollment.' }
  if (!enrollment) return { ok: false, status: 404, error: 'Enrollment not found.' }

  if (requireCreatorId && enrollment.creator_id !== requireCreatorId) {
    return { ok: false, status: 403, error: 'You do not have access to this enrollment.' }
  }

  if (enrollment.payment_status !== 'paid') {
    return { ok: false, status: 400, error: 'This enrollment is not in a refundable state (already refunded, or never paid).' }
  }

  if (!enrollment.payment_id) {
    return { ok: false, status: 400, error: 'No payment record found for this enrollment.' }
  }

  if (!bypassWindow) {
    const { data: course } = await supabase
      .from('courses')
      .select('refund_window_days')
      .eq('id', enrollment.course_id)
      .maybeSingle()

    const windowDays = course?.refund_window_days ?? 0
    const daysSince = (Date.now() - new Date(enrollment.enrolled_at).getTime()) / (1000 * 60 * 60 * 24)

    if (windowDays <= 0) {
      return { ok: false, status: 400, error: 'This course does not accept refunds.' }
    }
    if (daysSince > windowDays) {
      return { ok: false, status: 400, error: `The ${windowDays}-day refund window for this course has closed.` }
    }
  }

  try {
    await razorpay.payments.refund(enrollment.payment_id, {
      amount: Math.round(Number(enrollment.amount_paid) * 100),
      notes: { initiated_by: initiatedBy, enrollment_id: enrollment.id },
    })
  } catch (err: any) {
    console.error('[refund-actions] Razorpay refund failed:', err)
    const desc = String(err?.error?.description || err?.message || '').toLowerCase()
    if (desc.includes('already been refunded') || desc.includes('fully refunded')) {
      return { ok: false, status: 400, error: 'This payment has already been refunded.' }
    }
    return { ok: false, status: 502, error: 'Razorpay could not process this refund right now. Please try again shortly.' }
  }

  return {
    ok: true,
    message: 'Refund initiated. Access will be revoked automatically once Razorpay confirms it — usually within a few minutes, with the money reflecting for the student in 5–10 business days.',
  }
}
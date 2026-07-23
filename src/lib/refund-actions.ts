import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string }

// ── Flow A: course refund requests (student ↔ creator) ──────────────
export async function checkCourseRefundEligibility(enrollmentId: string): Promise<{ eligible: boolean; reason?: string }> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, course_uuid, payment_status, enrolled_at')
    .eq('id', enrollmentId)
    .maybeSingle()

  if (!enrollment || enrollment.payment_status !== 'paid') return { eligible: false, reason: 'Not a paid enrollment' }

  const { data: course } = await supabase
    .from('courses')
    .select('refund_window_days')
    .eq('id', enrollment.course_uuid)
    .maybeSingle()

  const windowDays = course?.refund_window_days ?? 0
  if (windowDays <= 0) return { eligible: false, reason: 'This course does not accept refunds' }

  const daysSince = (Date.now() - new Date(enrollment.enrolled_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > windowDays) return { eligible: false, reason: 'Refund window has closed' }

  const { data: existing } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('type', 'course')
    .maybeSingle()
  if (existing) return { eligible: false, reason: 'A request already exists for this enrollment' }

  return { eligible: true }
}

export async function createCourseRefundRequest({ enrollmentId, reason }: { enrollmentId: string; reason?: string }): Promise<ActionResult> {
  const elig = await checkCourseRefundEligibility(enrollmentId)
  if (!elig.eligible) return { ok: false, status: 400, error: elig.reason || 'Not eligible for a refund' }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, creator_id, student_id')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (!enrollment) return { ok: false, status: 404, error: 'Enrollment not found' }

  const { error } = await supabase.from('refund_requests').insert({
    type: 'course',
    enrollment_id: enrollmentId,
    creator_id: enrollment.creator_id,
    student_id: enrollment.student_id,
    requested_by: 'student',
    reason: reason || null,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, status: 400, error: 'A request already exists for this enrollment' }
    return { ok: false, status: 500, error: 'Could not submit your request' }
  }
  return { ok: true, message: 'Your refund request has been sent to the creator.' }
}

export async function decideCourseRefundRequest({ requestId, creatorId, decision, note }: { requestId: string; creatorId: string; decision: 'approved' | 'denied'; note?: string }): Promise<ActionResult> {
  const { data: request } = await supabase
    .from('refund_requests')
    .select('id, enrollment_id, creator_id, status, type')
    .eq('id', requestId)
    .maybeSingle()

  if (!request || request.type !== 'course') return { ok: false, status: 404, error: 'Request not found' }
  if (request.creator_id !== creatorId) return { ok: false, status: 403, error: 'Not your request to decide' }
  if (request.status !== 'pending') return { ok: false, status: 400, error: 'This request has already been decided' }

  await supabase.from('refund_requests').update({
    status: decision === 'approved' ? 'completed' : 'denied',
    decision_note: note || null,
    decided_at: new Date().toISOString(),
    decided_by: 'creator',
    completed_at: decision === 'approved' ? new Date().toISOString() : null,
  }).eq('id', requestId)

  if (decision === 'approved') {
    await supabase.from('enrollments').update({ payment_status: 'refunded' }).eq('id', request.enrollment_id)
    await supabase.from('transactions').update({ status: 'refunded' }).eq('enrollment_id', request.enrollment_id)
    return { ok: true, message: "Marked as refunded. The student's access has been revoked." }
  }
  return { ok: true, message: 'Request denied.' }
}

// ── Flow B: subscription refund requests (creator ↔ Kurso) ──────────
export async function checkSubscriptionRefundEligibility(creatorId: string): Promise<{ eligible: boolean; reason?: string; subscriptionId?: string }> {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_start')
    .eq('creator_id', creatorId)
    .maybeSingle()

  if (!subscription || subscription.status !== 'active') return { eligible: false, reason: 'No active subscription found' }

  const daysSince = (Date.now() - new Date(subscription.current_period_start).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 15) return { eligible: false, reason: 'Refunds are only available within 15 days of your billing date' }

  const { data: existing } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('subscription_id', subscription.id)
    .eq('type', 'subscription')
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  if (existing) return { eligible: false, reason: 'A request is already pending for this subscription' }

  return { eligible: true, subscriptionId: subscription.id }
}

export async function createSubscriptionRefundRequest({ creatorId, reason }: { creatorId: string; reason?: string }): Promise<ActionResult> {
  const elig = await checkSubscriptionRefundEligibility(creatorId)
  if (!elig.eligible) return { ok: false, status: 400, error: elig.reason || 'Not eligible for a refund' }

  const { error } = await supabase.from('refund_requests').insert({
    type: 'subscription',
    subscription_id: elig.subscriptionId,
    creator_id: creatorId,
    requested_by: 'creator',
    reason: reason || null,
  })
  if (error) return { ok: false, status: 500, error: 'Could not submit your request' }
  return { ok: true, message: 'Your refund request has been sent to Kurso for review.' }
}
// ── Ebook refund requests (student ↔ creator) ────────────────────────
export async function checkEbookRefundEligibility(purchaseId: string): Promise<{ eligible: boolean; reason?: string }> {
  const { data: purchase } = await supabase
    .from('transactions')
    .select('id, status, ebook_id, created_at')
    .eq('id', purchaseId)
    .eq('product_type', 'ebook')
    .maybeSingle()

  if (!purchase || purchase.status !== 'success') return { eligible: false, reason: 'Not a completed purchase' }

  const { data: ebook } = await supabase.from('ebooks').select('refund_window_days').eq('id', purchase.ebook_id).maybeSingle()
  const windowDays = ebook?.refund_window_days ?? 0
  if (windowDays <= 0) return { eligible: false, reason: 'This ebook does not accept refunds' }

  const daysSince = (Date.now() - new Date(purchase.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > windowDays) return { eligible: false, reason: 'Refund window has closed' }

  const { data: existing } = await supabase.from('refund_requests').select('id').eq('purchase_id', purchaseId).eq('type', 'ebook').maybeSingle()
  if (existing) return { eligible: false, reason: 'A request already exists for this purchase' }

  return { eligible: true }
}

export async function createEbookRefundRequest({ purchaseId, reason }: { purchaseId: string; reason?: string }): Promise<ActionResult> {
  const elig = await checkEbookRefundEligibility(purchaseId)
  if (!elig.eligible) return { ok: false, status: 400, error: elig.reason || 'Not eligible for a refund' }

  const { data: purchase } = await supabase.from('transactions').select('id, creator_id, student_id').eq('id', purchaseId).maybeSingle()
  if (!purchase) return { ok: false, status: 404, error: 'Purchase not found' }

  const { error } = await supabase.from('refund_requests').insert({
    type: 'ebook',
    purchase_id: purchaseId,
    creator_id: purchase.creator_id,
    student_id: purchase.student_id,
    requested_by: 'student',
    reason: reason || null,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, status: 400, error: 'A request already exists for this purchase' }
    return { ok: false, status: 500, error: 'Could not submit your request' }
  }
  return { ok: true, message: 'Your refund request has been sent to the creator.' }
}

export async function decideEbookRefundRequest({ requestId, creatorId, decision, note }: { requestId: string; creatorId: string; decision: 'approved' | 'denied'; note?: string }): Promise<ActionResult> {
  const { data: request } = await supabase.from('refund_requests').select('id, purchase_id, creator_id, status, type').eq('id', requestId).maybeSingle()
  if (!request || request.type !== 'ebook') return { ok: false, status: 404, error: 'Request not found' }
  if (request.creator_id !== creatorId) return { ok: false, status: 403, error: 'Not your request to decide' }
  if (request.status !== 'pending') return { ok: false, status: 400, error: 'This request has already been decided' }

  await supabase.from('refund_requests').update({
    status: decision === 'approved' ? 'completed' : 'denied',
    decision_note: note || null,
    decided_at: new Date().toISOString(),
    decided_by: 'creator',
    completed_at: decision === 'approved' ? new Date().toISOString() : null,
  }).eq('id', requestId)

  if (decision === 'approved') {
    // Block further downloads immediately rather than deleting the record
    const { data: purchase } = await supabase.from('transactions').select('ebook_download_count').eq('id', request.purchase_id).maybeSingle()
    await supabase.from('transactions').update({
      status: 'refunded',
      ebook_download_limit: purchase?.ebook_download_count ?? 0,
    }).eq('id', request.purchase_id)
    return { ok: true, message: 'Marked as refunded. Further downloads have been blocked.' }
  }
  return { ok: true, message: 'Request denied.' }
}

export async function decideSubscriptionRefundRequest({ requestId, decision, note }: { requestId: string; decision: 'approved' | 'denied'; note?: string }): Promise<ActionResult> {
  const { data: request } = await supabase
    .from('refund_requests')
    .select('id, subscription_id, status, type')
    .eq('id', requestId)
    .maybeSingle()

  if (!request || request.type !== 'subscription') return { ok: false, status: 404, error: 'Request not found' }
  if (request.status !== 'pending') return { ok: false, status: 400, error: 'This request has already been decided' }

  await supabase.from('refund_requests').update({
    status: decision === 'approved' ? 'completed' : 'denied',
    decision_note: note || null,
    decided_at: new Date().toISOString(),
    decided_by: 'admin',
    completed_at: decision === 'approved' ? new Date().toISOString() : null,
  }).eq('id', requestId)

  if (decision === 'approved') {
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', request.subscription_id)
    return { ok: true, message: 'Marked as refunded and subscription cancelled.' }
  }
  return { ok: true, message: 'Request denied.' }
}
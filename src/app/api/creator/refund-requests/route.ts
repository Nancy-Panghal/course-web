import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decideCourseRefundRequest, decideEbookRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreatorId(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function GET(req: NextRequest) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requests, error } = await supabase
      .from('refund_requests')
      .select('id, type, enrollment_id, purchase_id, reason, status, requested_at, decision_note, student_id')
      .eq('creator_id', creatorId)
      .in('type', ['course', 'ebook'])
      .order('requested_at', { ascending: false })
    if (error) throw error
    if (!requests || requests.length === 0) return NextResponse.json({ requests: [] })

    const courseReqs = requests.filter(r => r.type === 'course')
    const ebookReqs = requests.filter(r => r.type === 'ebook')
    const enrollmentIds = [...new Set(courseReqs.map(r => r.enrollment_id).filter(Boolean))]
    const purchaseIds = [...new Set(ebookReqs.map(r => r.purchase_id).filter(Boolean))]
    const studentIds = [...new Set(requests.map(r => r.student_id).filter(Boolean))]

    const [{ data: enrollments }, { data: purchases }, { data: students }] = await Promise.all([
      enrollmentIds.length ? supabase.from('enrollments').select('id, course_uuid, amount_paid').in('id', enrollmentIds) : Promise.resolve({ data: [] as any[] }),
      purchaseIds.length ? supabase.from('transactions').select('id, ebook_id, amount, student_name, student_email').in('id', purchaseIds) : Promise.resolve({ data: [] as any[] }),
      studentIds.length ? supabase.from('students').select('id, name, email').in('id', studentIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const courseIds = [...new Set((enrollments || []).map(e => e.course_uuid).filter(Boolean))]
    const ebookIds = [...new Set((purchases || []).map(p => p.ebook_id).filter(Boolean))]
    const [{ data: courses }, { data: ebooks }] = await Promise.all([
      courseIds.length ? supabase.from('courses').select('id, name').in('id', courseIds) : Promise.resolve({ data: [] as any[] }),
      ebookIds.length ? supabase.from('ebooks').select('id, title').in('id', ebookIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const enrollmentMap = new Map((enrollments || []).map(e => [e.id, e]))
    const purchaseMap = new Map((purchases || []).map(p => [p.id, p]))
    const studentMap = new Map((students || []).map(s => [s.id, s]))
    const courseMap = new Map((courses || []).map(c => [c.id, c]))
    const ebookMap = new Map((ebooks || []).map(e => [e.id, e]))

    // Normalized shape — same fields for course and ebook requests, so the
    // dashboard page only needs one rendering path.
    const enriched = requests.map(r => {
      const student = studentMap.get(r.student_id)
      if (r.type === 'course') {
        const enrollment = enrollmentMap.get(r.enrollment_id)
        const course = enrollment ? courseMap.get(enrollment.course_uuid) : null
        return {
          id: r.id, type: r.type, reason: r.reason, status: r.status,
          requested_at: r.requested_at, decision_note: r.decision_note,
          product_name: course?.name || 'Course', amount: enrollment?.amount_paid || 0,
          buyer_name: student?.name || null, buyer_email: student?.email || null,
        }
      }
      const purchase = purchaseMap.get(r.purchase_id)
      const ebook = purchase ? ebookMap.get(purchase.ebook_id) : null
      return {
        id: r.id, type: r.type, reason: r.reason, status: r.status,
        requested_at: r.requested_at, decision_note: r.decision_note,
        product_name: ebook?.title || 'Ebook', amount: purchase?.amount || 0,
        buyer_name: purchase?.student_name || student?.name || null,
        buyer_email: purchase?.student_email || student?.email || null,
      }
    })

    return NextResponse.json({ requests: enriched })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund-requests GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { requestId, decision, note } = await req.json()
    if (!requestId || !['approved', 'denied'].includes(decision)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: request } = await supabase.from('refund_requests').select('type').eq('id', requestId).maybeSingle()
    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const result = request.type === 'ebook'
      ? await decideEbookRefundRequest({ requestId, creatorId, decision, note })
      : await decideCourseRefundRequest({ requestId, creatorId, decision, note })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund-requests POST')
  }
}
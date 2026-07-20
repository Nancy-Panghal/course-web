import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decideCourseRefundRequest } from '@/lib/refund-actions'
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
      .select('id, enrollment_id, reason, status, requested_at, decision_note, student_id')
      .eq('creator_id', creatorId)
      .eq('type', 'course')
      .order('requested_at', { ascending: false })
    if (error) throw error
    if (!requests || requests.length === 0) return NextResponse.json({ requests: [] })

    const enrollmentIds = [...new Set(requests.map(r => r.enrollment_id).filter(Boolean))]
    const studentIds = [...new Set(requests.map(r => r.student_id).filter(Boolean))]

    const [{ data: enrollments }, { data: students }] = await Promise.all([
      supabase.from('enrollments').select('id, course_uuid, amount_paid').in('id', enrollmentIds),
      supabase.from('students').select('id, name, email').in('id', studentIds),
    ])

    const courseIds = [...new Set((enrollments || []).map(e => e.course_uuid).filter(Boolean))]
    const { data: courses } = await supabase.from('courses').select('id, name').in('id', courseIds)

    const enrollmentMap = new Map((enrollments || []).map(e => [e.id, e]))
    const studentMap = new Map((students || []).map(s => [s.id, s]))
    const courseMap = new Map((courses || []).map(c => [c.id, c]))

    const enriched = requests.map(r => {
      const enrollment = enrollmentMap.get(r.enrollment_id)
      const course = enrollment ? courseMap.get(enrollment.course_uuid) : null
      const student = studentMap.get(r.student_id)
      return {
        ...r,
        enrollments: enrollment ? { amount_paid: enrollment.amount_paid, courses: { name: course?.name || 'Course' } } : null,
        students: student ? { name: student.name, email: student.email } : null,
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
    const result = await decideCourseRefundRequest({ requestId, creatorId, decision, note })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund-requests POST')
  }
}
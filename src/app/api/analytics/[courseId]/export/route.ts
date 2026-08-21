/**
 * src/app/api/analytics/[courseId]/export/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Downloads a CSV of every paid, non-test student enrolled in one
 * course. Same ownership check and same enrollments query shape as
 * /api/analytics/[courseId] — this exists as a separate endpoint
 * rather than a "?format=csv" flag on the analytics route so the two
 * stay simple: one always returns JSON for the dashboard UI, this one
 * always returns a file download.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildStudentCsv, type ExportRow } from '@/lib/studentExportCsv'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

function slugify(text: string) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const creator = await getCreator(req)
  if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', courseId)
    .eq('creator_id', creator.id)
    .maybeSingle()

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 403 })

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_published', true)

  const totalLessons = (lessons || []).length

  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('phone, current_lesson, completed_lessons, last_accessed, enrolled_at, amount_paid, payment_status, telegram_chat_id, certificate_id, students(name, email, reminder_channel)')
    .eq('course_uuid', courseId)
    .eq('payment_status', 'paid')
    .eq('is_test', false)
    .order('enrolled_at', { ascending: false })

  if (error) {
    console.error('[analytics/export] failed to fetch enrollments:', error)
    return NextResponse.json({ error: 'Failed to load students' }, { status: 500 })
  }

  const rows: ExportRow[] = (enrollments || []).map((e: any) => ({
    studentName: e.students?.name || '',
    phone: e.phone || '',
    email: e.students?.email || '',
    enrolledAt: e.enrolled_at,
    paymentStatus: e.payment_status,
    amountPaid: e.amount_paid,
    completedCount: Array.isArray(e.completed_lessons) ? e.completed_lessons.length : 0,
    totalLessons,
    lastAccessed: e.last_accessed,
    channel: e.telegram_chat_id ? 'Telegram' : (e.students?.reminder_channel === 'telegram' ? 'Telegram' : 'WhatsApp'),
    certificateIssued: !!e.certificate_id,
  }))

  const csv = buildStudentCsv(rows, false)
  const filename = `${slugify(course.name) || 'course'}-students-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
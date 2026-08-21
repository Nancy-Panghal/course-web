/**
 * src/app/api/creator/students/export/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Downloads a CSV of every paid, non-test student across every course
 * this creator owns (adds a "Course" column, unlike the per-course
 * export). Reuses the exact same row-building rules as the per-course
 * export via the shared studentExportCsv helper.
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

export async function GET(req: NextRequest) {
  const creator = await getCreator(req)
  if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .eq('creator_id', creator.id)

  const courseList = courses || []
  if (courseList.length === 0) {
    const csv = buildStudentCsv([], true)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="all-students-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const courseIds = courseList.map(c => c.id)
  const courseNameById = new Map(courseList.map(c => [c.id, c.name]))

  // Published-lesson counts per course, needed for each row's progress
  // %. Fetched once for all courses rather than per-enrollment to keep
  // this to a small, fixed number of queries regardless of student count.
  const { data: lessons } = await supabase
    .from('lessons')
    .select('course_id')
    .in('course_id', courseIds)
    .eq('is_published', true)

  const lessonCountByCourse = new Map<string, number>()
  for (const l of lessons || []) {
    lessonCountByCourse.set(l.course_id, (lessonCountByCourse.get(l.course_id) || 0) + 1)
  }

  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('course_uuid, phone, completed_lessons, last_accessed, enrolled_at, amount_paid, payment_status, telegram_chat_id, certificate_id, students(name, email, reminder_channel)')
    .in('course_uuid', courseIds)
    .eq('payment_status', 'paid')
    .eq('is_test', false)
    .order('enrolled_at', { ascending: false })

  if (error) {
    console.error('[creator/students/export] failed to fetch enrollments:', error)
    return NextResponse.json({ error: 'Failed to load students' }, { status: 500 })
  }

  const rows: ExportRow[] = (enrollments || []).map((e: any) => ({
    studentName: e.students?.name || '',
    phone: e.phone || '',
    email: e.students?.email || '',
    courseName: courseNameById.get(e.course_uuid) || '',
    enrolledAt: e.enrolled_at,
    paymentStatus: e.payment_status,
    amountPaid: e.amount_paid,
    completedCount: Array.isArray(e.completed_lessons) ? e.completed_lessons.length : 0,
    totalLessons: lessonCountByCourse.get(e.course_uuid) || 0,
    lastAccessed: e.last_accessed,
    channel: e.telegram_chat_id ? 'Telegram' : (e.students?.reminder_channel === 'telegram' ? 'Telegram' : 'WhatsApp'),
    certificateIssued: !!e.certificate_id,
  }))

  const csv = buildStudentCsv(rows, true)
  const filename = `all-students-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
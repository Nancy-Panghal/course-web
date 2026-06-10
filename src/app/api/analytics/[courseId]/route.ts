/**
 * src/app/api/analytics/[courseId]/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET — returns all analytics data for a course:
 *   - Overall stats (completion rate, avg progress, active/inactive)
 *   - Lesson drop-off (how many students completed each lesson)
 *   - Inactive student list (not accessed in 7+ days)
 *   - Revenue breakdown
 *
 * All computed from existing enrollments + lessons tables.
 * No new tables needed.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { courseId } = await params

    // Verify creator owns this course
    const { data: course } = await supabase
      .from('courses')
      .select('id, name, price')
      .eq('id', courseId)
      .eq('creator_id', creator.id)
      .maybeSingle()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 403 })

    // Fetch all paid enrollments for this course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, phone, current_lesson, completed_lessons, last_accessed, enrolled_at, amount_paid, payment_status, telegram_chat_id')
      .eq('course_uuid', courseId)
      .eq('payment_status', 'paid')
      .order('enrolled_at', { ascending: false })

    // Fetch all published lessons
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, order_num, title')
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('order_num', { ascending: true })

    const allEnrollments = enrollments || []
    const allLessons = lessons || []
    const totalLessons = allLessons.length
    const totalEnrolled = allEnrollments.length

    // ── Overall stats ─────────────────────────────────────────────
    const completed = allEnrollments.filter(
      e => Array.isArray(e.completed_lessons) && e.completed_lessons.length >= totalLessons && totalLessons > 0
    )
    const completionRate = totalEnrolled > 0
      ? Math.round((completed.length / totalEnrolled) * 100)
      : 0

    const avgProgress = totalEnrolled > 0 && totalLessons > 0
      ? Math.round(
          allEnrollments.reduce((sum, e) => {
            const done = Array.isArray(e.completed_lessons) ? e.completed_lessons.length : 0
            return sum + Math.min(done / totalLessons, 1) * 100
          }, 0) / totalEnrolled
        )
      : 0

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const inactiveStudents = allEnrollments.filter(e => {
      const lastAccess = e.last_accessed
      if (!lastAccess) return true // never accessed = inactive
      return lastAccess < sevenDaysAgo
    })
    const activeStudents = allEnrollments.filter(e => {
      const lastAccess = e.last_accessed
      if (!lastAccess) return false
      return lastAccess >= sevenDaysAgo
    })

    // ── Lesson drop-off ───────────────────────────────────────────
    // For each lesson, count how many students have completed it
    const lessonDropoff = allLessons.map(lesson => {
      const completedCount = allEnrollments.filter(
        e => Array.isArray(e.completed_lessons) && e.completed_lessons.includes(lesson.order_num)
      ).length
      return {
        orderNum: lesson.order_num,
        title: lesson.title,
        completedCount,
        completionPct: totalEnrolled > 0
          ? Math.round((completedCount / totalEnrolled) * 100)
          : 0,
      }
    })

    // Find the biggest drop between consecutive lessons
    let biggestDropLesson = -1
    let biggestDrop = 0
    for (let i = 1; i < lessonDropoff.length; i++) {
      const drop = lessonDropoff[i - 1].completedCount - lessonDropoff[i].completedCount
      if (drop > biggestDrop) {
        biggestDrop = drop
        biggestDropLesson = lessonDropoff[i].orderNum
      }
    }

    // ── Inactive student list (for Send Reminder feature) ─────────
    const inactiveList = inactiveStudents.map(e => {
      const daysSince = e.last_accessed
        ? Math.floor((Date.now() - new Date(e.last_accessed).getTime()) / (24 * 60 * 60 * 1000))
        : null
      const lessonInfo = allLessons.find(l => l.order_num === e.current_lesson)
      return {
        id: e.id,
        phone: e.phone,
        currentLesson: e.current_lesson,
        currentLessonTitle: lessonInfo?.title || `Lesson ${e.current_lesson}`,
        daysSinceAccess: daysSince,
        lastAccessed: e.last_accessed || null,
        enrolledAt: e.enrolled_at,
        hasTelegram: !!e.telegram_chat_id,
      }
    })

    // ── Revenue breakdown ──────────────────────────────────────────
    const totalRevenue = allEnrollments.reduce((sum, e) => sum + (Number(e.amount_paid) || 0), 0)
    const paidEnrollments = allEnrollments.filter(e => Number(e.amount_paid) > 0)
    const avgAmountPaid = paidEnrollments.length > 0
      ? Math.round(totalRevenue / paidEnrollments.length)
      : 0

    return NextResponse.json({
      courseId,
      courseName: course.name,
      coursePrice: course.price,
      overview: {
        totalEnrolled,
        completedCount: completed.length,
        completionRate,
        avgProgress,
        activeCount: activeStudents.length,
        inactiveCount: inactiveStudents.length,
        totalLessons,
      },
      lessonDropoff,
      biggestDropLesson,
      inactiveStudents: inactiveList,
      revenue: {
        totalRevenue,
        paidCount: paidEnrollments.length,
        avgAmountPaid,
      },
    })
  } catch (err: any) {
    console.error('[analytics GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

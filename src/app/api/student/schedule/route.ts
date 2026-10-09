/**
 * GET /api/student/schedule
 *
 * Returns every module's unlock status across all of a student's paid
 * enrollments, aggregated into a single list sorted by unlock time.
 *
 * Auth: Supabase Bearer token (standard web login).
 *
 * Response shape:
 *   {
 *     items: ScheduleItem[]
 *   }
 *
 * ScheduleItem:
 *   - courseId, courseName, creatorName, courseSlug
 *   - moduleId, moduleName, moduleOrder
 *   - status: 'unlocked' | 'locked' | 'immediate'
 *       unlocked   — already open; link field is populated
 *       locked     — not yet open; unlockAt field is populated (ISO UTC string)
 *       immediate  — open from day-0 enrollment (no specific unlock moment)
 *   - unlockAt?: string   — ISO UTC (only when status === 'locked')
 *   - link?: string       — course URL with lesson hint (only when status === 'unlocked' or 'immediate')
 *   - firstLessonNum?: number
 *
 * For `locked` items with delivery_mode === 'fixed_calendar', unlockAt is the
 * same for every student on that course. For `per_student_drip`, it's computed
 * specifically from THIS student's enrolled_at using the same IST calendar-day
 * math the lock-check and cron use.
 *
 * `all_at_once` courses have no module-level schedule — they are excluded from
 * the list entirely (everything is already open; no schedule to show).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeModuleUnlockAt } from '@/lib/moduleLock'
import { slugify } from '@/lib/emailAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function courseUrl(
  creatorName: string | null,
  courseName: string | null,
  courseSlug: string | null,
  courseId: string,
  lessonNum?: number | null
) {
  const creator = slugify(creatorName || 'instructor')
  const course = courseSlug || slugify(courseName || 'course')
  const base = `/course/${creator}/${course}/${courseId}`
  return lessonNum ? `${base}?lesson=${lessonNum}` : base
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Find student row ─────────────────────────────────────────────
  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  // ── Collect paid enrollments ─────────────────────────────────────
  // Same multi-strategy lookup as my-courses page: student_id + phone + email.
  const seen = new Set<string>()
  const allEnrollments: any[] = []

  async function absorb(query: any) {
    const { data } = await query
    if (!data) return
    for (const e of data) {
      if (!seen.has(e.id)) {
        seen.add(e.id)
        allEnrollments.push(e)
      }
    }
  }

  const baseSelect = 'id, course_uuid, enrolled_at, current_lesson, completed_lessons'

  function makeBase() {
    return supabase
      .from('enrollments')
      .select(baseSelect)
      .eq('payment_status', 'paid')
  }

  const fetches: Promise<void>[] = []
  if (studentRow?.id) fetches.push(absorb(makeBase().eq('student_id', studentRow.id)))

  const phones = [user.user_metadata?.phone, user.phone].filter(Boolean) as string[]
  for (const p of phones) fetches.push(absorb(makeBase().eq('phone', p)))
  if (user.email) fetches.push(absorb(makeBase().eq('phone', user.email)))

  await Promise.all(fetches)

  if (allEnrollments.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const courseIds = [...new Set(allEnrollments.map((e: any) => e.course_uuid))]

  // ── Fetch course metadata (drip courses only) ────────────────────
  const { data: coursesRaw } = await supabase
    .from('courses')
    .select('id, name, slug, host_name, delivery_mode, delivery_unlock_time')
    .in('id', courseIds)
    .in('delivery_mode', ['fixed_calendar', 'per_student_drip'])

  const dripCourses = coursesRaw || []
  if (dripCourses.length === 0) return NextResponse.json({ items: [] })

  const dripCourseIds = dripCourses.map((c: any) => c.id)
  const courseById = new Map(dripCourses.map((c: any) => [c.id, c]))

  // Enrollments restricted to drip courses only.
  const dripEnrollments = allEnrollments.filter((e: any) => dripCourseIds.includes(e.course_uuid))
  if (dripEnrollments.length === 0) return NextResponse.json({ items: [] })

  // ── Fetch modules for those courses ─────────────────────────────
  const { data: modulesRaw } = await supabase
    .from('course_modules')
    .select('id, course_id, name, order_num, unlock_date, unlock_after_days')
    .in('course_id', dripCourseIds)
    .order('order_num', { ascending: true })

  const modules = modulesRaw || []
  if (modules.length === 0) return NextResponse.json({ items: [] })

  // ── First published lesson per module ────────────────────────────
  const { data: lessonsRaw } = await supabase
    .from('lessons')
    .select('module_id, order_num')
    .in('course_id', dripCourseIds)
    .eq('is_published', true)

  const firstLessonByModule = new Map<string, number>()
  for (const l of lessonsRaw || []) {
    if (!l.module_id) continue
    const prev = firstLessonByModule.get(l.module_id)
    if (prev === undefined || l.order_num < prev) firstLessonByModule.set(l.module_id, l.order_num)
  }

  // ── Build schedule items ─────────────────────────────────────────
  const now = new Date()

  // One enrollment per course (the most recent paid one).
  const enrollmentByCourse = new Map<string, any>()
  for (const e of dripEnrollments) {
    const prev = enrollmentByCourse.get(e.course_uuid)
    if (!prev || new Date(e.enrolled_at) > new Date(prev.enrolled_at)) {
      enrollmentByCourse.set(e.course_uuid, e)
    }
  }

  const items: any[] = []

  for (const mod of modules) {
    const course = courseById.get(mod.course_id)
    if (!course) continue

    const enrollment = enrollmentByCourse.get(mod.course_id)
    if (!enrollment) continue

    const firstLesson = firstLessonByModule.get(mod.id)
    // Skip modules with no published lessons — nothing to link to.
    if (firstLesson === undefined) continue

    const unlockAt = computeModuleUnlockAt({
      deliveryMode: course.delivery_mode,
      unlockTime: course.delivery_unlock_time,
      module: mod,
      enrolledAt: enrollment.enrolled_at,
    })

    const link = courseUrl(course.host_name, course.name, course.slug, course.id, firstLesson)

    if (!unlockAt) {
      // No release rule — open from the start (day-0 or unscheduled).
      items.push({
        courseId: course.id,
        courseName: course.name,
        creatorName: course.host_name || 'Instructor',
        courseSlug: course.slug || '',
        moduleId: mod.id,
        moduleName: mod.name,
        moduleOrder: mod.order_num,
        status: 'immediate',
        link,
        firstLessonNum: firstLesson,
      })
    } else if (now >= unlockAt) {
      // Already unlocked.
      items.push({
        courseId: course.id,
        courseName: course.name,
        creatorName: course.host_name || 'Instructor',
        courseSlug: course.slug || '',
        moduleId: mod.id,
        moduleName: mod.name,
        moduleOrder: mod.order_num,
        status: 'unlocked',
        link,
        firstLessonNum: firstLesson,
      })
    } else {
      // Still locked.
      items.push({
        courseId: course.id,
        courseName: course.name,
        creatorName: course.host_name || 'Instructor',
        courseSlug: course.slug || '',
        moduleId: mod.id,
        moduleName: mod.name,
        moduleOrder: mod.order_num,
        status: 'locked',
        unlockAt: unlockAt.toISOString(),
        firstLessonNum: firstLesson,
      })
    }
  }

  // Sort: locked items first (soonest first), then unlocked/immediate by course then module order.
  items.sort((a, b) => {
    if (a.status === 'locked' && b.status !== 'locked') return -1
    if (a.status !== 'locked' && b.status === 'locked') return 1
    if (a.status === 'locked' && b.status === 'locked') {
      return new Date(a.unlockAt).getTime() - new Date(b.unlockAt).getTime()
    }
    // Both unlocked/immediate: sort by course name then module order.
    if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName)
    return a.moduleOrder - b.moduleOrder
  })

  return NextResponse.json({ items })
}

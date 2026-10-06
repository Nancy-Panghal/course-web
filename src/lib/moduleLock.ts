// Module release-schedule lock check (server only).
//
// Decides whether a lesson's module is still locked for a given student under
// the course's delivery_mode. Pure rules live in evaluateModuleLock so they can
// be tested without a database; getLessonLock is the DB-backed wrapper.
//
// KEEP IN SYNC BY HAND with telegram-bot/moduleLock.js (no shared package).
//
// Policy, in one place:
//   - all_at_once, lesson with no module, or a module with no release rule -> UNLOCKED
//     (an unscheduled module never locks anyone out)
//   - fixed_calendar     -> locked until module.unlock_date, same for everyone
//   - per_student_drip   -> locked until the student's own computed moment
//                           (IST calendar math, see releaseSchedule.ts)
//   - missing/unparseable data -> UNLOCKED, never locked. A paying student must not
//     be locked out by a data gap; the schedule is something the creator opted into.

import {
  computePerStudentUnlockAt,
  normalizeDeliveryMode,
  normalizeUnlockTime,
} from './releaseSchedule'

export interface LockModule {
  name?: string | null
  unlock_date?: string | null
  unlock_after_days?: number | null
}

export type LockResult =
  | { locked: false }
  | { locked: true; unlockAt: string; moduleName: string | null }

export function evaluateModuleLock(input: {
  deliveryMode: unknown
  unlockTime: unknown
  module: LockModule | null | undefined
  enrolledAt: string | null | undefined
  now?: Date
}): LockResult {
  const now = input.now ?? new Date()
  const mode = normalizeDeliveryMode(input.deliveryMode)
  const mod = input.module
  if (mode === 'all_at_once' || !mod) return { locked: false }

  let unlockAt: Date | null = null

  if (mode === 'fixed_calendar') {
    if (!mod.unlock_date) return { locked: false }
    const d = new Date(mod.unlock_date)
    if (Number.isNaN(d.getTime())) return { locked: false }
    unlockAt = d
  } else {
    if (mod.unlock_after_days === null || mod.unlock_after_days === undefined) return { locked: false }
    if (!input.enrolledAt) return { locked: false }
    unlockAt = computePerStudentUnlockAt(
      input.enrolledAt,
      Number(mod.unlock_after_days),
      normalizeUnlockTime(input.unlockTime)
    )
    if (!unlockAt) return { locked: false }
  }

  if (now.getTime() >= unlockAt.getTime()) return { locked: false }
  return { locked: true, unlockAt: unlockAt.toISOString(), moduleName: mod.name ?? null }
}

// A student can hold more than one valid enrollment for a course (cookie session
// and a Supabase login can resolve to different rows). Access paths are additive
// everywhere else in this codebase, so the lesson is locked only if EVERY
// enrollment is locked; the reported unlock time is the soonest one.
export function evaluateLockForEnrollments(input: {
  deliveryMode: unknown
  unlockTime: unknown
  module: LockModule | null | undefined
  enrolledAts: (string | null | undefined)[]
  now?: Date
}): LockResult {
  const list = input.enrolledAts.length ? input.enrolledAts : [null]
  let soonest: LockResult | null = null
  for (const enrolledAt of list) {
    const r = evaluateModuleLock({ ...input, enrolledAt })
    if (!r.locked) return r
    if (!soonest || (soonest.locked && r.unlockAt < soonest.unlockAt)) soonest = r
  }
  return soonest ?? { locked: false }
}

// DB-backed wrapper. `client` is a service-role Supabase client.
export async function getLessonLock(
  client: any,
  lessonId: string,
  enrolledAts: (string | null | undefined)[],
  now?: Date
): Promise<LockResult> {
  const { data: lesson } = await client
    .from('lessons')
    .select('module_id, course_id')
    .eq('id', lessonId)
    .maybeSingle()
  if (!lesson?.module_id) return { locked: false }

  const { data: course } = await client
    .from('courses')
    .select('delivery_mode, delivery_unlock_time')
    .eq('id', lesson.course_id)
    .maybeSingle()
  if (normalizeDeliveryMode(course?.delivery_mode) === 'all_at_once') return { locked: false }

  const { data: mod } = await client
    .from('course_modules')
    .select('name, unlock_date, unlock_after_days')
    .eq('id', lesson.module_id)
    .maybeSingle()

  return evaluateLockForEnrollments({
    deliveryMode: course?.delivery_mode,
    unlockTime: course?.delivery_unlock_time,
    module: mod,
    enrolledAts,
    now,
  })
}


// The exact moment a module opens for one student, or null when the module has
// no usable release rule (all_at_once, unscheduled, or bad data). Used by the
// unlock-notification cron. Mirrors evaluateModuleLock's rules exactly: a module
// is locked at `now` iff now < computeModuleUnlockAt(...).
export function computeModuleUnlockAt(input: {
  deliveryMode: unknown
  unlockTime: unknown
  module: LockModule | null | undefined
  enrolledAt: string | null | undefined
}): Date | null {
  const mode = normalizeDeliveryMode(input.deliveryMode)
  const mod = input.module
  if (mode === 'all_at_once' || !mod) return null

  if (mode === 'fixed_calendar') {
    if (!mod.unlock_date) return null
    const d = new Date(mod.unlock_date)
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (mod.unlock_after_days === null || mod.unlock_after_days === undefined) return null
  if (!input.enrolledAt) return null
  return computePerStudentUnlockAt(
    input.enrolledAt,
    Number(mod.unlock_after_days),
    normalizeUnlockTime(input.unlockTime)
  )
}
// Release-schedule helpers for course drip delivery.
//
// All unlock times are interpreted in IST (Asia/Kolkata), consistent with the
// rest of the codebase (workshop reminders, live-session reminders). IST is a
// fixed UTC+05:30 with no daylight saving, so plain offset arithmetic is safe
// here. Do NOT replace this with `enrollmentTimestamp + N * 24h` — that makes
// unlock moments drift to whatever time of day a student happened to enroll.

export type DeliveryMode = 'all_at_once' | 'fixed_calendar' | 'per_student_drip'

export const DELIVERY_MODES: DeliveryMode[] = ['all_at_once', 'fixed_calendar', 'per_student_drip']

export const DEFAULT_UNLOCK_TIME = '09:00'

const IST_OFFSET_MS = 330 * 60 * 1000 // +05:30

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function normalizeDeliveryMode(value: unknown): DeliveryMode {
  return DELIVERY_MODES.includes(value as DeliveryMode) ? (value as DeliveryMode) : 'all_at_once'
}

// Postgres `time` columns come back as 'HH:MM:SS'. Inputs and this module use 'HH:MM'.
export function normalizeUnlockTime(value: unknown): string {
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5)
  return DEFAULT_UNLOCK_TIME
}

// ISO timestamp -> { date: 'YYYY-MM-DD', time: 'HH:MM' } as seen in IST.
export function istPartsFromIso(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const shifted = new Date(d.getTime() + IST_OFFSET_MS).toISOString()
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }
}

// IST wall-clock date + time -> UTC ISO string (what gets stored in timestamptz).
export function istPartsToIso(date: string, time: string): string | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null
  const d = new Date(`${date}T${time}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Calendar-day arithmetic on a 'YYYY-MM-DD' string (no timezone involved).
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// The exact unlock moment for one student and one per_student_drip module:
//   1. enrollment.created_at -> IST calendar date (time dropped)
//   2. + unlock_after_days calendar days
//   3. combined with the course's unlock time, in IST
//   4. returned as an absolute instant (compare against Date.now() for cron)
//
// Day 0 is the exception: "0 days after enrollment" means available the moment the
// student enrolls, not at the course's unlock time that day. There is then no later
// moment to wait for (and nothing to announce), so it returns null, which every caller
// treats as "not locked". null also covers unusable input; both mean "never lock".
export function computePerStudentUnlockAt(
  enrollmentCreatedAt: string,
  unlockAfterDays: number,
  unlockTime: string
): Date | null {
  const parts = istPartsFromIso(enrollmentCreatedAt)
  if (!parts || !Number.isInteger(unlockAfterDays) || unlockAfterDays < 0) return null
  if (unlockAfterDays === 0) return null
  const iso = istPartsToIso(addCalendarDays(parts.date, unlockAfterDays), normalizeUnlockTime(unlockTime))
  return iso ? new Date(iso) : null
}
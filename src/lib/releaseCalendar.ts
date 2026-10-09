// Pure helpers behind the creator release calendar (no React, no database), so the
// date maths can be tested on its own. Everything is IST (Asia/Kolkata), matching the
// rest of the release schedule (see releaseSchedule.ts).

import {
  type DeliveryMode,
  addCalendarDays,
  computePerStudentUnlockAt,
  istPartsFromIso,
  istPartsToIso,
  normalizeUnlockTime,
} from './releaseSchedule'

export interface CalendarModule {
  id: string
  name: string
  order_num: number
  unlock_date?: string | null
  unlock_after_days?: number | null
}

export interface CalendarItem {
  id: string
  name: string
  time: string // 'HH:MM' IST
  opened: boolean // the unlock moment has already passed
}

export interface DayCell {
  date: string | null // 'YYYY-MM-DD' (IST), null for the blank cells padding the grid
  day: number | null
  isToday: boolean
  items: CalendarItem[]
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

export function istTodayKey(now: Date = new Date()): string {
  return istPartsFromIso(now.toISOString())!.date
}

function scheduledParts(m: CalendarModule) {
  return m.unlock_date ? istPartsFromIso(m.unlock_date) : null
}

// Weeks (Sunday first) for one month, each cell carrying the modules that unlock that IST day.
export function buildMonthGrid(year: number, month0: number, modules: CalendarModule[], now: Date = new Date()): DayCell[][] {
  const today = istTodayKey(now)
  const byDate = new Map<string, (CalendarItem & { order: number })[]>()
  for (const m of modules) {
    const p = scheduledParts(m)
    if (!p) continue
    const list = byDate.get(p.date) ?? []
    list.push({
      id: m.id,
      name: m.name,
      time: p.time,
      opened: new Date(m.unlock_date as string).getTime() <= now.getTime(),
      order: m.order_num,
    })
    byDate.set(p.date, list)
  }

  const firstWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const cells: DayCell[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, day: null, isToday: false, items: [] })
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad2(month0 + 1)}-${pad2(d)}`
    const items = (byDate.get(key) ?? [])
      .sort((a, b) => a.time.localeCompare(b.time) || a.order - b.order)
      .map(({ order: _order, ...rest }) => rest)
    cells.push({ date: key, day: d, isToday: key === today, items })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, isToday: false, items: [] })

  const weeks: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// Month to show first: the next scheduled unlock, else the last one, else this month.
export function initialMonth(modules: CalendarModule[], now: Date = new Date()): { year: number; month0: number } {
  const today = istTodayKey(now)
  const dates = modules
    .map(scheduledParts)
    .filter((p): p is { date: string; time: string } => !!p)
    .map(p => p.date)
    .sort()
  const pick = dates.find(d => d >= today) ?? dates[dates.length - 1] ?? today
  return { year: Number(pick.slice(0, 4)), month0: Number(pick.slice(5, 7)) - 1 }
}

export function shiftMonth(cur: { year: number; month0: number }, delta: number) {
  const d = new Date(Date.UTC(cur.year, cur.month0 + delta, 1))
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth() }
}

export function monthTitle(cur: { year: number; month0: number }) {
  return new Date(Date.UTC(cur.year, cur.month0, 1)).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// In fixed-calendar mode a module with no date never locks: it is open to everyone from the start.
export function unscheduledModules(modules: CalendarModule[]): CalendarModule[] {
  return modules.filter(m => !scheduledParts(m)).sort((a, b) => a.order_num - b.order_num)
}

export interface DripRowInfo {
  id: string
  name: string
  order_num: number
  days: number | null
}

// Timeline order: by day, then module order; modules with no rule last.
export function dripRows(modules: CalendarModule[]): DripRowInfo[] {
  return modules
    .map(m => ({
      id: m.id,
      name: m.name,
      order_num: m.order_num,
      days: m.unlock_after_days === null || m.unlock_after_days === undefined ? null : Number(m.unlock_after_days),
    }))
    .sort((a, b) => {
      if (a.days === null && b.days === null) return a.order_num - b.order_num
      if (a.days === null) return 1
      if (b.days === null) return -1
      return a.days - b.days || a.order_num - b.order_num
    })
}

// What "a student who joins right now" would see for this module. Uses the real unlock
// rule, so Day 0 = immediate and Day N+ = IST calendar days at the course's unlock time.
export function dripExample(days: number | null, unlockTime: unknown, now: Date = new Date()):
  | { kind: 'unscheduled' }
  | { kind: 'immediate' }
  | { kind: 'at'; at: Date } {
  if (days === null || !Number.isInteger(days) || days < 0) return { kind: 'unscheduled' }
  if (days === 0) return { kind: 'immediate' }
  const at = computePerStudentUnlockAt(now.toISOString(), days, normalizeUnlockTime(unlockTime))
  return at ? { kind: 'at', at } : { kind: 'unscheduled' }
}

export function parseDaysDraft(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (t === '') return { ok: true, value: null }
  if (!/^\d+$/.test(t)) return { ok: false, error: 'Enter a whole number of days, 0 or more.' }
  const n = Number(t)
  if (n > 3650) return { ok: false, error: 'Enter a whole number of days, 0 or more.' }
  return { ok: true, value: n }
}

export function fmtIst(d: Date) {
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtTime12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad2(m)} ${suffix}`
}


// ── Drag to reschedule ───────────────────────────────────────────

export type MoveRejection = 'already_open' | 'past' | 'same_day' | 'invalid'

export type MovePlan =
  | { ok: true; iso: string; time: string; needsConfirm: boolean }
  | { ok: false; reason: MoveRejection }

// Can this module be moved onto `targetDate` (an IST day, 'YYYY-MM-DD')? The time of day is kept;
// an unscheduled module gets the course's default unlock time.
//   - already_open: students already have access, and moving it later would lock them out again
//   - past: the resulting moment is not in the future, which would open it to everyone instantly
//   - same_day: nothing to do
//   - needsConfirm: the module is currently unscheduled (= open to everyone); a date will lock it
export function planMove(input: { module: CalendarModule; targetDate: string; defaultTime: unknown; now?: Date }): MovePlan {
  const now = input.now ?? new Date()
  const cur = input.module.unlock_date ? istPartsFromIso(input.module.unlock_date) : null
  if (cur && new Date(input.module.unlock_date as string).getTime() <= now.getTime()) {
    return { ok: false, reason: 'already_open' }
  }
  if (cur && cur.date === input.targetDate) return { ok: false, reason: 'same_day' }
  const time = cur?.time ?? normalizeUnlockTime(input.defaultTime)
  const iso = istPartsToIso(input.targetDate, time)
  if (!iso) return { ok: false, reason: 'invalid' }
  if (new Date(iso).getTime() <= now.getTime()) return { ok: false, reason: 'past' }
  return { ok: true, iso, time, needsConfirm: !cur }
}

export function shiftDateKey(date: string, days: number): string {
  return addCalendarDays(date, days)
}

// ── Order check ──────────────────────────────────────────────────

export interface OrderWarning {
  moduleId: string
  name: string
  beforeId: string // the earlier-ordered module that opens AFTER this one
  beforeName: string
}

// A module that comes later in the course but opens before an earlier one. Only a heads-up
// (creators sometimes do this on purpose), so it never blocks anything. Unscheduled modules
// are skipped, and modules opening at the same moment are fine.
export function findOrderWarnings(mode: DeliveryMode | string, modules: CalendarModule[]): OrderWarning[] {
  const key = (m: CalendarModule): number | null => {
    if (mode === 'fixed_calendar') {
      if (!m.unlock_date) return null
      const t = new Date(m.unlock_date).getTime()
      return Number.isNaN(t) ? null : t
    }
    if (mode === 'per_student_drip') {
      if (m.unlock_after_days === null || m.unlock_after_days === undefined) return null
      const n = Number(m.unlock_after_days)
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  const keyed = modules
    .map(m => ({ m, k: key(m) }))
    .filter((x): x is { m: CalendarModule; k: number } => x.k !== null)
    .sort((a, b) => a.m.order_num - b.m.order_num)

  const out: OrderWarning[] = []
  for (const cur of keyed) {
    let worst: { m: CalendarModule; k: number } | null = null
    for (const e of keyed) {
      if (e.m.order_num >= cur.m.order_num) continue
      if (e.k > cur.k && (!worst || e.k > worst.k || (e.k === worst.k && e.m.order_num > worst.m.order_num))) worst = e
    }
    if (worst) out.push({ moduleId: cur.m.id, name: cur.m.name, beforeId: worst.m.id, beforeName: worst.m.name })
  }
  return out
}
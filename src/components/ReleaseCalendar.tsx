'use client'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type DeliveryMode, normalizeUnlockTime } from '@/lib/releaseSchedule'
import {
  type CalendarModule,
  type DripRowInfo,
  type MoveRejection,
  type OrderWarning,
  buildMonthGrid,
  dripExample,
  dripRows,
  findOrderWarnings,
  fmtIst,
  fmtTime12,
  initialMonth,
  monthTitle,
  parseDaysDraft,
  planMove,
  shiftDateKey,
  shiftMonth,
  unscheduledModules,
} from '@/lib/releaseCalendar'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const panel = { border: '1px solid rgba(255,255,255,0.06)' }
const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  colorScheme: 'dark' as const,
}

const ARROW_DAYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

function rejectionText(reason: MoveRejection, name: string): string {
  switch (reason) {
    case 'already_open':
      return `“${name}” is already open to students, so it can't be moved here. If you really need to change it, use the date box under the module.`
    case 'past':
      return 'That time has already passed. Pick a later day.'
    case 'invalid':
      return "Couldn't read that date."
    default:
      return ''
  }
}

// Creator-facing view of the release schedule. Sits next to the module list (it does not
// replace it): fixed_calendar courses get a month grid you can drag modules around on,
// per_student_drip courses get a relative timeline, all_at_once courses get nothing because
// there is nothing to schedule.
export default function ReleaseCalendar({
  mode,
  unlockTime,
  modules,
  onSaved,
  onJumpToModule,
}: {
  mode: DeliveryMode
  unlockTime: string
  modules: CalendarModule[]
  onSaved: () => void
  onJumpToModule?: (moduleId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const warnings = useMemo(() => findOrderWarnings(mode, modules), [mode, modules])
  if (mode === 'all_at_once') return null

  const isFixed = mode === 'fixed_calendar'
  return (
    <div className="rounded-2xl p-5 mb-6 glass" style={panel}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm">Release calendar</h3>
          <p className="text-xs mt-0.5" style={{ color: '#a6a6ab' }}>
            {isFixed ? '📅 Shared calendar — every student sees these exact dates and times (IST).'
                     : '💧 Personal timeline — each student has their own clock, starting the day they enroll. There is no shared calendar.'}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', border: '1px solid rgba(255,255,255,0.1)' }}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (modules.length === 0
        ? <p className="text-xs mt-4" style={{ color: 'var(--kurso-hint)' }}>Add a module to start planning its release.</p>
        : (
          <>
            {isFixed
              ? <FixedCalendar modules={modules} unlockTime={unlockTime} warnings={warnings} onSaved={onSaved} onJumpToModule={onJumpToModule} />
              : <DripTimeline modules={modules} unlockTime={unlockTime} warnings={warnings} onSaved={onSaved} />}
            <OrderWarnings warnings={warnings} onJumpToModule={onJumpToModule} />
          </>
        ))}
    </div>
  )
}

function OrderWarnings({ warnings, onJumpToModule }: { warnings: OrderWarning[]; onJumpToModule?: (id: string) => void }) {
  if (warnings.length === 0) return null
  return (
    <div role="status" className="mt-4 rounded-xl p-3" style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.18)' }}>
      <p className="text-xs font-semibold" style={{ color: '#fde047' }}>Check your release order</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {warnings.map(w => (
          <li key={w.moduleId} className="text-xs" style={{ color: '#e4e4e7' }}>
            <button type="button" onClick={() => onJumpToModule?.(w.moduleId)} className="underline text-left">
              ⚠ “{w.name}” opens before “{w.beforeName}”
            </button>
            <span style={{ color: '#a1a1aa' }}>, which comes earlier in your course.</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] mt-1.5" style={{ color: '#a1a1aa' }}>That's fine if it's on purpose. Students will simply see the later module first.</p>
    </div>
  )
}

// ── fixed_calendar: month grid with drag-to-reschedule ──
function FixedCalendar({
  modules,
  unlockTime,
  warnings,
  onSaved,
  onJumpToModule,
}: {
  modules: CalendarModule[]
  unlockTime: string
  warnings: OrderWarning[]
  onSaved: () => void
  onJumpToModule?: (id: string) => void
}) {
  const [cursor, setCursor] = useState(() => initialMonth(modules))
  const [dragId, setDragId] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ id: string; name: string; iso: string } | null>(null)

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month0, modules, new Date()), [cursor, modules])
  const byId = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const warnIds = new Set(warnings.map(w => w.moduleId))
  const unscheduled = unscheduledModules(modules)
  const locked = !!busyId || !!pending

  const plan = (id: string, date: string) => {
    const m = byId.get(id)
    return m ? planMove({ module: m, targetDate: date, defaultTime: unlockTime, now: new Date() }) : null
  }

  async function commit(id: string, iso: string) {
    setError('')
    setBusyId(id)
    const { error: updateError } = await supabase.from('course_modules').update({ unlock_date: iso }).eq('id', id)
    setBusyId(null)
    if (updateError) { setError(updateError.message); return }
    onSaved()
  }

  function attemptMove(id: string, date: string) {
    if (locked) return
    setError('')
    const m = byId.get(id)
    const p = plan(id, date)
    if (!m || !p) return
    if (!p.ok) {
      const text = rejectionText(p.reason, m.name)
      if (text) setError(text)
      return
    }
    if (p.needsConfirm) { setPending({ id, name: m.name, iso: p.iso }); return }
    void commit(id, p.iso)
  }

  // Chips are div role="button" rather than <button>: Firefox does not start a drag from a <button>.
  const dragProps = (id: string, movable: boolean) => ({
    draggable: movable && !locked,
    onDragStart: (e: React.DragEvent) => {
      if (!movable || locked) { e.preventDefault(); return }
      e.dataTransfer?.setData('text/plain', id)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      setDragId(id)
      setError('')
    },
    onDragEnd: () => { setDragId(null); setHoverDate(null) },
  })

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setCursor(c => shiftMonth(c, -1))}
            className="w-8 h-8 rounded-lg text-white" style={inputStyle}>‹</button>
          <span className="text-sm font-semibold text-white min-w-[130px] text-center">{monthTitle(cursor)}</span>
          <button type="button" aria-label="Next month" onClick={() => setCursor(c => shiftMonth(c, 1))}
            className="w-8 h-8 rounded-lg text-white" style={inputStyle}>›</button>
        </div>
        <button type="button" onClick={() => setCursor(initialMonth([], new Date()))}
          className="text-xs px-3 py-1.5 rounded-lg" style={{ ...inputStyle, color: '#d4d4d8' }}>Today</button>
      </div>

      {pending && (
        <div role="alertdialog" className="mb-3 rounded-xl p-3" style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)' }}>
          <p className="text-xs" style={{ color: '#fde047' }}>
            Schedule “{pending.name}” for {fmtIst(new Date(pending.iso))} IST? It is open to every student right now,
            so this will lock it until then, including for students who have already started it.
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => { const p = pending; setPending(null); void commit(p.id, p.iso) }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white violet-gradient hover:opacity-90">Schedule it</button>
            <button type="button" onClick={() => setPending(null)}
              className="px-3 py-1.5 rounded-lg text-xs" style={{ ...inputStyle, color: '#e4e4e7' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-[11px] text-center font-medium" style={{ color: '#71717a' }}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
              {week.map((cell, ci) => {
                const dropOk = !!(dragId && cell.date && plan(dragId, cell.date)?.ok)
                const hovering = dropOk && hoverDate === cell.date
                return (
                  <div key={ci} data-date={cell.date ?? undefined} className="rounded-lg p-1.5"
                    onDragOver={e => {
                      if (!dragId || !cell.date) return
                      if (plan(dragId, cell.date)?.ok) {
                        e.preventDefault() // this day accepts the drop
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                        if (hoverDate !== cell.date) setHoverDate(cell.date)
                      }
                    }}
                    onDragLeave={() => { if (hoverDate === cell.date) setHoverDate(null) }}
                    onDrop={e => {
                      e.preventDefault()
                      const id = dragId ?? e.dataTransfer?.getData('text/plain') ?? ''
                      setDragId(null)
                      setHoverDate(null)
                      if (id && cell.date) attemptMove(id, cell.date)
                    }}
                    style={{
                      minHeight: 78,
                      opacity: dragId && cell.date && !dropOk ? 0.45 : 1,
                      background: hovering ? 'rgba(var(--kurso-primary-rgb), 0.14)' : cell.date ? 'rgba(255,255,255,0.03)' : 'transparent',
                      border: hovering ? '1px dashed var(--kurso-primary)' : cell.isToday ? '1px solid var(--kurso-primary)' : cell.date ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                    }}>
                    {cell.day && (
                      <div className="text-[11px] mb-1" style={{ color: cell.isToday ? 'var(--kurso-primary-light)' : '#71717a', fontWeight: cell.isToday ? 700 : 400 }}>
                        {cell.day}
                      </div>
                    )}
                    {cell.items.slice(0, 2).map(it => {
                      const warned = warnIds.has(it.id)
                      return (
                        <div key={it.id} role="button" tabIndex={0} {...dragProps(it.id, !it.opened)}
                          onClick={() => onJumpToModule?.(it.id)}
                          onKeyDown={e => {
                            const delta = ARROW_DAYS[e.key]
                            if (e.altKey && delta !== undefined && cell.date) {
                              e.preventDefault()
                              attemptMove(it.id, shiftDateKey(cell.date, delta))
                              return
                            }
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onJumpToModule?.(it.id)
                            }
                          }}
                          title={`${it.name} — ${it.opened ? 'already open, can’t be dragged' : `opens ${fmtTime12(it.time)} IST. Drag to another day, or press Alt + arrow keys.`}${warned ? ' — opens before an earlier module' : ''}`}
                          className="block w-full text-left rounded px-1.5 py-1 mb-1 text-[11px] leading-tight truncate"
                          style={{
                            cursor: it.opened || locked ? 'default' : 'grab',
                            opacity: busyId === it.id ? 0.5 : 1,
                            background: it.opened ? 'rgba(74,222,128,0.10)' : 'rgba(var(--kurso-primary-rgb), 0.16)',
                            color: it.opened ? '#86efac' : 'var(--kurso-primary-lighter)',
                            outline: warned ? '1px solid rgba(250,204,21,0.5)' : undefined,
                          }}>
                          {it.opened ? '✓ ' : ''}{warned ? '⚠ ' : ''}{it.name}
                          <span className="block opacity-70">{busyId === it.id ? 'Saving…' : fmtTime12(it.time)}</span>
                        </div>
                      )
                    })}
                    {cell.items.length > 2 && (
                      <div className="text-[10px]" style={{ color: '#a1a1aa' }}
                        title={cell.items.slice(2).map(i => i.name).join(', ')}>
                        +{cell.items.length - 2} more
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}

      <div className="flex flex-wrap gap-4 mt-3 text-[11px]" style={{ color: '#a1a1aa' }}>
        <span><span style={{ color: 'var(--kurso-primary-lighter)' }}>■</span> Upcoming</span>
        <span><span style={{ color: '#86efac' }}>■</span> Already open</span>
        <span>All times are IST.</span>
      </div>

      {unscheduled.length > 0 && (
        <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.18)' }}>
          <p className="text-xs font-semibold" style={{ color: '#fde047' }}>
            Not scheduled — open to every student right away
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: '#a1a1aa' }}>Drag one onto a day to schedule it.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {unscheduled.map(m => (
              <div key={m.id} role="button" tabIndex={0} {...dragProps(m.id, true)} onClick={() => onJumpToModule?.(m.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJumpToModule?.(m.id) } }}
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ ...inputStyle, color: '#e4e4e7', cursor: locked ? 'default' : 'grab', opacity: busyId === m.id ? 0.5 : 1 }}>
                {m.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: 'var(--kurso-hint)' }}>
        Drag an upcoming module to another day to reschedule it. The time of day stays the same. Keyboard: focus a module and press Alt + arrow keys.
        Modules that are already open can't be dragged, and neither can anything onto a time that has passed.
        On a touch screen, use the date and time boxes under each module below. Click a module here to jump to it.
      </p>
    </div>
  )
}

// ── per_student_drip: relative timeline ──
function DripTimeline({
  modules,
  unlockTime,
  warnings,
  onSaved,
}: {
  modules: CalendarModule[]
  unlockTime: string
  warnings: OrderWarning[]
  onSaved: () => void
}) {
  const time = normalizeUnlockTime(unlockTime)
  const rows = dripRows(modules)
  const warnByModule = new Map(warnings.map(w => [w.moduleId, w]))
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2">
        {rows.map(r => <DripRow key={r.id} row={r} time={time} warning={warnByModule.get(r.id)} onSaved={onSaved} />)}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--kurso-hint)' }}>
        Day 0 opens the moment a student enrolls. Later days open at {fmtTime12(time)} IST, counted in calendar days from the day each student enrolls.
        The “joining today” dates show what a student who enrolls right now would get.
      </p>
    </div>
  )
}

function DripRow({ row, time, warning, onSaved }: { row: DripRowInfo; time: string; warning?: OrderWarning; onSaved: () => void }) {
  const saved = row.days === null ? '' : String(row.days)
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastSaved, setLastSaved] = useState(saved)

  // Follow the module when it changes elsewhere (e.g. edited in the list below).
  if (saved !== lastSaved) {
    setLastSaved(saved)
    setDraft(saved)
  }

  const dirty = draft !== saved
  const example = dripExample(row.days, time)

  async function save() {
    setError('')
    const parsed = parseDaysDraft(draft)
    if (!parsed.ok) { setError(parsed.error); return }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('course_modules')
      .update({ unlock_after_days: parsed.value })
      .eq('id', row.id)
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    onSaved()
  }

  const dayLabel = row.days === null ? '—' : `Day ${row.days}`
  const detail =
    row.days === null ? 'Not scheduled — open from the start'
    : row.days === 0 ? 'Opens the moment a student enrolls'
    : `Opens ${row.days} day${row.days === 1 ? '' : 's'} after enrollment, at ${fmtTime12(time)} IST`
  const joiningToday =
    example.kind === 'immediate' ? 'Joining today → right away'
    : example.kind === 'at' ? `Joining today → ${fmtIst(example.at)}`
    : ''

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: warning ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 min-w-[64px] text-center"
        style={{ background: 'rgba(var(--kurso-primary-rgb), 0.14)', color: 'var(--kurso-primary-lighter)' }}>
        {dayLabel}
      </span>
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-medium text-white truncate">{row.name}</p>
        <p className="text-xs" style={{ color: '#a6a6ab' }}>{detail}</p>
        {joiningToday && <p className="text-[11px]" style={{ color: 'var(--kurso-hint)' }}>{joiningToday}</p>}
        {warning && <p className="text-[11px]" style={{ color: '#fde047' }}>⚠ Opens before “{warning.beforeName}”, which comes earlier in your course.</p>}
        {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={0} step={1} value={draft} placeholder="—" aria-label={`Days after enrollment for ${row.name}`}
          onChange={e => setDraft(e.target.value)}
          className="w-20 px-2.5 py-1.5 rounded-lg text-xs text-white outline-none" style={inputStyle} />
        <span className="text-xs" style={{ color: '#a6a6ab' }}>days</span>
        {dirty && (
          <button type="button" onClick={save} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}
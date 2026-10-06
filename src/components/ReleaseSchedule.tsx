'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type DeliveryMode,
  DEFAULT_UNLOCK_TIME,
  istPartsFromIso,
  istPartsToIso,
  normalizeUnlockTime,
} from '@/lib/releaseSchedule'

const MODE_OPTIONS: { id: DeliveryMode; icon: string; title: string; blurb: string; tag?: string }[] = [
  {
    id: 'per_student_drip',
    icon: '💧',
    title: 'Per-student drip',
    blurb: 'Each module unlocks a set number of days after that student enrolls. Everyone follows their own timeline.',
    tag: 'Recommended',
  },
  {
    id: 'fixed_calendar',
    icon: '📅',
    title: 'Fixed calendar',
    blurb: 'Each module unlocks on a specific date for every student at once, like a cohort.',
  },
  {
    id: 'all_at_once',
    icon: '📚',
    title: 'All at once',
    blurb: 'Every lesson is available as soon as a student enrolls.',
  },
]

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  colorScheme: 'dark' as const,
}

// ── Course-level card: pick the release mode + the daily unlock time ──
export function ReleaseScheduleCard({
  courseId,
  mode,
  unlockTime,
  onChange,
}: {
  courseId: string
  mode: DeliveryMode
  unlockTime: string
  onChange: (next: { delivery_mode: DeliveryMode; delivery_unlock_time: string }) => void
}) {
  const [timeDraft, setTimeDraft] = useState(unlockTime)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setTimeDraft(unlockTime) }, [unlockTime])

  async function save(nextMode: DeliveryMode, nextTime: string) {
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: updateError } = await supabase
      .from('courses')
      .update({ delivery_mode: nextMode, delivery_unlock_time: `${nextTime}:00` })
      .eq('id', courseId)
    setSaving(false)
    if (updateError) {
      setError('Could not save — please try again.')
      setTimeDraft(unlockTime)
      return
    }
    onChange({ delivery_mode: nextMode, delivery_unlock_time: nextTime })
    setSaved(true)
  }

  function handleTimeBlur() {
    if (!/^\d{2}:\d{2}$/.test(timeDraft)) { setTimeDraft(unlockTime); return }
    if (timeDraft !== unlockTime) save(mode, timeDraft)
  }

  return (
    <div className="rounded-2xl p-5 mb-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h3 className="font-semibold text-white text-sm">Release schedule</h3>
        {saving && <span className="text-xs" style={{ color: 'var(--kurso-primary-light)' }}>Saving…</span>}
        {!saving && saved && <span className="text-xs" style={{ color: '#4ade80' }}>Saved</span>}
      </div>
      <p className="text-xs mb-4" style={{ color: '#a6a6ab' }}>
        Choose when students get access to each module. Spreading content out usually helps students keep going instead of dropping off.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODE_OPTIONS.map(opt => {
          const active = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={saving}
              onClick={() => { if (!active) save(opt.id, unlockTime) }}
              className="flex flex-col items-start p-3 rounded-xl text-left transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                background: active ? 'rgba(var(--kurso-primary-rgb), 0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(var(--kurso-primary-rgb), 0.45)' : 'rgba(255,255,255,0.1)'}`,
              }}>
              <div className="flex items-center gap-2 mb-1.5 w-full">
                <span className="text-base">{opt.icon}</span>
                <span className="text-sm font-bold text-white">{opt.title}</span>
                {active && <span className="ml-auto text-xs" style={{ color: 'var(--kurso-primary-light)' }}>✓</span>}
              </div>
              {opt.tag && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1.5"
                  style={{ background: 'rgba(var(--kurso-primary-rgb), 0.18)', color: 'var(--kurso-primary-lighter)' }}>
                  {opt.tag}
                </span>
              )}
              <p className="text-xs" style={{ color: '#a6a6ab', lineHeight: 1.5 }}>{opt.blurb}</p>
            </button>
          )
        })}
      </div>

      {mode !== 'all_at_once' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-white" htmlFor="release-unlock-time">
            Default unlock time (IST)
          </label>
          <input
            id="release-unlock-time"
            type="time"
            value={timeDraft}
            onChange={e => setTimeDraft(e.target.value)}
            onBlur={handleTimeBlur}
            className="px-3 py-1.5 rounded-lg text-sm text-white outline-none"
            style={inputStyle}
          />
          <span className="text-xs" style={{ color: 'var(--kurso-hint)' }}>
            Modules unlock at this time of day, India time. Modules set to 0 days open immediately.
          </span>
        </div>
      )}

      {error && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}

// ── Per-module control: sits under each module's details in the lessons tab ──
export function ModuleReleaseControl({
  moduleId,
  mode,
  unlockDate,
  unlockAfterDays,
  defaultTime,
  onSaved,
}: {
  moduleId: string
  mode: DeliveryMode
  unlockDate: string | null | undefined
  unlockAfterDays: number | null | undefined
  defaultTime: string
  onSaved: () => void
}) {
  const fallbackTime = normalizeUnlockTime(defaultTime || DEFAULT_UNLOCK_TIME)
  const savedParts = istPartsFromIso(unlockDate)

  const [dateDraft, setDateDraft] = useState(savedParts?.date ?? '')
  const [timeDraft, setTimeDraft] = useState(savedParts?.time ?? fallbackTime)
  const [daysDraft, setDaysDraft] = useState(unlockAfterDays == null ? '' : String(unlockAfterDays))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = istPartsFromIso(unlockDate)
    setDateDraft(p?.date ?? '')
    setTimeDraft(p?.time ?? fallbackTime)
  }, [unlockDate, fallbackTime])

  useEffect(() => {
    setDaysDraft(unlockAfterDays == null ? '' : String(unlockAfterDays))
  }, [unlockAfterDays])

  if (mode === 'all_at_once') return null

  const dateDirty =
    dateDraft !== (savedParts?.date ?? '') || (dateDraft !== '' && timeDraft !== (savedParts?.time ?? fallbackTime))
  const daysDirty = daysDraft !== (unlockAfterDays == null ? '' : String(unlockAfterDays))
  const dirty = mode === 'fixed_calendar' ? dateDirty : daysDirty

  async function handleSave() {
    setError('')
    let patch: { unlock_date?: string | null; unlock_after_days?: number | null }

    if (mode === 'fixed_calendar') {
      if (dateDraft === '') {
        patch = { unlock_date: null }
      } else {
        const iso = istPartsToIso(dateDraft, timeDraft || fallbackTime)
        if (!iso) { setError('Pick a valid date and time.'); return }
        patch = { unlock_date: iso }
      }
    } else {
      if (daysDraft.trim() === '') {
        patch = { unlock_after_days: null }
      } else {
        const n = Number(daysDraft)
        if (!Number.isInteger(n) || n < 0 || n > 3650) { setError('Enter a whole number of days, 0 or more.'); return }
        patch = { unlock_after_days: n }
      }
    }

    setSaving(true)
    const { error: updateError } = await supabase.from('course_modules').update(patch).eq('id', moduleId)
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    onSaved()
  }

  const unscheduled = mode === 'fixed_calendar' ? !savedParts : unlockAfterDays == null
  const inPast = mode === 'fixed_calendar' && !!unlockDate && new Date(unlockDate).getTime() < Date.now()

  return (
    <div className="mb-3 rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-white">
          {mode === 'fixed_calendar' ? '📅 Unlocks on' : '💧 Unlocks'}
        </span>

        {mode === 'fixed_calendar' ? (
          <>
            <input type="date" value={dateDraft} onChange={e => setDateDraft(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-white outline-none" style={inputStyle} />
            <input type="time" value={timeDraft} onChange={e => setTimeDraft(e.target.value)}
              disabled={dateDraft === ''}
              className="px-2.5 py-1.5 rounded-lg text-xs text-white outline-none disabled:opacity-50" style={inputStyle} />
            <span className="text-xs" style={{ color: 'var(--kurso-hint)' }}>IST</span>
          </>
        ) : (
          <>
            <input type="number" min={0} step={1} value={daysDraft} placeholder="0"
              onChange={e => setDaysDraft(e.target.value)}
              className="w-20 px-2.5 py-1.5 rounded-lg text-xs text-white outline-none" style={inputStyle} />
            <span className="text-xs" style={{ color: '#a6a6ab' }}>days after enrollment</span>
          </>
        )}

        {dirty && (
          <button type="button" onClick={handleSave} disabled={saving}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--kurso-hint)' }}>
        {unscheduled
          ? 'Not scheduled yet — this module has no release rule.'
          : mode === 'fixed_calendar'
            ? inPast ? 'This date has already passed.' : 'Same date and time for every student.'
            : unlockAfterDays === 0
              ? 'Opens immediately when a student enrolls.'
              : `Unlocks ${unlockAfterDays} day${unlockAfterDays === 1 ? '' : 's'} after each student's enrollment date.`}
      </p>

      {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
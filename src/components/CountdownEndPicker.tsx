'use client'

import { useEffect, useState } from 'react'

/**
 * Friendly "when does the countdown end?" picker for creators.
 *
 * Replaces the browser's raw <input type="datetime-local"> (which shows
 * "dd/mm/yyyy, --:-- --" and is confusing) with a date picker plus clearly
 * labelled Hr / Min / AM-PM dropdowns, quick presets, and a plain-English
 * summary line.
 *
 * The stored value format is unchanged: '' (not set) or 'YYYY-MM-DDTHH:mm'
 * (24-hour, no timezone) — exactly what datetime-local used to produce — so
 * nothing else that reads `urgency.endAt` needs to change.
 */

type Meridiem = 'AM' | 'PM'
type TimeParts = { hour12: number; minute: number; ampm: Meridiem }

const pad = (n: number) => String(n).padStart(2, '0')
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 59]
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function toLocalValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseValue(value: string): (TimeParts & { date: string }) | null {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value || '')
    if (!m) return null
    const hour24 = parseInt(m[2], 10)
    return {
        date: m[1],
        hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
        minute: parseInt(m[3], 10),
        ampm: hour24 >= 12 ? 'PM' : 'AM',
    }
}

const PRESETS: { label: string; hours: number }[] = [
    { label: 'In 24 hours', hours: 24 },
    { label: 'In 3 days', hours: 72 },
    { label: 'In 7 days', hours: 168 },
]

const fieldClass = 'w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white'
const smallLabelClass = 'text-[11px] block mb-1'
const optionStyle = { background: '#18181b', color: '#ffffff' }

export default function CountdownEndPicker({
    value,
    onChange,
}: {
    value: string
    onChange: (value: string) => void
}) {
    const parsed = parseValue(value)
    const date = parsed?.date ?? ''

    // The time dropdowns keep their own state so a time picked before a date
    // isn't lost. Default: 11:59 PM (closes at the end of the chosen day).
    const [time, setTime] = useState<TimeParts>({
        hour12: parsed?.hour12 ?? 11,
        minute: parsed?.minute ?? 59,
        ampm: parsed?.ampm ?? 'PM',
    })

    useEffect(() => {
        const p = parseValue(value)
        if (p) setTime({ hour12: p.hour12, minute: p.minute, ampm: p.ampm })
    }, [value])

    function emit(nextDate: string, t: TimeParts) {
        if (!nextDate) {
            onChange('')
            return
        }
        const hour24 = (t.hour12 % 12) + (t.ampm === 'PM' ? 12 : 0)
        onChange(`${nextDate}T${pad(hour24)}:${pad(t.minute)}`)
    }

    function updateTime(patch: Partial<TimeParts>) {
        const next = { ...time, ...patch }
        setTime(next)
        emit(date, next)
    }

    function applyPreset(hours: number) {
        const d = new Date(Date.now() + hours * 3600000)
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
        onChange(toLocalValue(d))
    }

    const minuteOptions = Array.from(new Set([...MINUTE_STEPS, time.minute])).sort((a, b) => a - b)
    const todayStr = toLocalValue(new Date()).slice(0, 10)

    let summary = 'Pick a date, then the time the countdown should end.'
    if (parsed) {
        const [y, mo, da] = parsed.date.split('-').map(Number)
        const dateText = new Date(y, mo - 1, da).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
        summary = `Ends on ${dateText} at ${parsed.hour12}:${pad(parsed.minute)} ${parsed.ampm}`
    }

    return (
        <div>
            <label className="text-[13px] block mb-1.5" style={{ color: '#a1a1aa' }}>Countdown ends at</label>
            <div className="grid grid-cols-3 sm:grid-cols-[minmax(0,1.7fr)_1fr_1fr_1fr] gap-2">
                <div className="col-span-3 sm:col-span-1">
                    <span className={smallLabelClass} style={{ color: '#71717a' }}>Date</span>
                    <input
                        type="date"
                        value={date}
                        min={todayStr}
                        onChange={e => emit(e.target.value, time)}
                        className={fieldClass}
                        style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                    <span className={smallLabelClass} style={{ color: '#71717a' }}>Hr</span>
                    <select
                        value={time.hour12}
                        onChange={e => updateTime({ hour12: Number(e.target.value) })}
                        className={fieldClass}
                        style={{ colorScheme: 'dark' }}>
                        {HOURS.map(h => (
                            <option key={h} value={h} style={optionStyle}>{h}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <span className={smallLabelClass} style={{ color: '#71717a' }}>Min</span>
                    <select
                        value={time.minute}
                        onChange={e => updateTime({ minute: Number(e.target.value) })}
                        className={fieldClass}
                        style={{ colorScheme: 'dark' }}>
                        {minuteOptions.map(m => (
                            <option key={m} value={m} style={optionStyle}>{pad(m)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <span className={smallLabelClass} style={{ color: '#71717a' }}>AM / PM</span>
                    <select
                        value={time.ampm}
                        onChange={e => updateTime({ ampm: e.target.value as Meridiem })}
                        className={fieldClass}
                        style={{ colorScheme: 'dark' }}>
                        <option value="AM" style={optionStyle}>AM</option>
                        <option value="PM" style={optionStyle}>PM</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                {PRESETS.map(preset => (
                    <button
                        key={preset.hours}
                        type="button"
                        onClick={() => applyPreset(preset.hours)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {preset.label}
                    </button>
                ))}
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ color: '#f87171' }}>
                        Clear
                    </button>
                )}
            </div>

            <p className="text-xs mt-2" style={{ color: 'var(--kurso-hint)' }}>{summary}</p>
        </div>
    )
}
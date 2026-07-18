'use client'

import { useEffect, useState } from 'react'

/**
 * Ticking countdown for the landing page urgency banner — boxed digit
 * style (each unit in its own accent-gradient tile with a label
 * underneath), matching the visual language real course-selling landing
 * pages use for deadline timers, instead of a single inline text string.
 *
 * Renders nothing until mounted (avoids an SSR/client text mismatch), and
 * renders nothing once the target time has passed — never gets stuck
 * showing "00:00:00" forever after the deadline.
 */
export default function CountdownTimer({
  endAt,
  accentGradient,
  boxShadowColor,
  numberColor = '#ffffff',
  labelColor,
}: {
  endAt: string
  accentGradient: string
  boxShadowColor: string
  numberColor?: string
  labelColor?: string
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    const target = new Date(endAt).getTime()
    if (Number.isNaN(target)) return

    function tick() {
      setRemainingMs(Math.max(0, target - Date.now()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endAt])

  if (remainingMs === null || remainingMs <= 0) return null

  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const units: [number, string][] = days > 0
    ? [[days, 'Days'], [hours, 'Hrs'], [minutes, 'Min'], [seconds, 'Sec']]
    : [[hours, 'Hrs'], [minutes, 'Min'], [seconds, 'Sec']]

  return (
    <div style={{ display: 'inline-flex', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
      {units.map(([value, label], i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div
            style={{
              background: accentGradient,
              boxShadow: `0 4px 16px ${boxShadowColor}`,
              borderRadius: 10,
              minWidth: 46,
              padding: '7px 4px',
              fontWeight: 800,
              fontSize: '1.05rem',
              color: numberColor,
              lineHeight: 1,
            }}
          >
            {String(value).padStart(2, '0')}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: labelColor,
              marginTop: 5,
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Ticking countdown for the landing page urgency banner — boxed digit
 * style (each unit in its own tile with a label underneath), matching the
 * visual language real course-selling landing pages use for deadline
 * timers, instead of a single inline text string.
 *
 * Tiles are a soft, low-opacity tint of the course's accent color (not
 * the bold accent gradient used for buttons) — the numbers stay readable
 * against it in every theme because `numberColor` is meant to be the
 * theme's own `accentText` token, which already resolves to a light color
 * on dark themes and a dark color on light themes.
 *
 * Renders nothing until mounted (avoids an SSR/client text mismatch), and
 * renders nothing once the target time has passed — never gets stuck
 * showing "00:00:00" forever after the deadline.
 */
export default function CountdownTimer({
  endAt,
  tileBg,
  tileBorder,
  numberColor,
  labelColor,
  onExpire,
}: {
  endAt: string
  /** Soft tile background — pass the theme's accentSoft, not accentGradient. */
  tileBg: string
  /** Tile border — pass the theme's accentBorder. */
  tileBorder: string
  /** Digit color — pass the theme's accentText so it stays readable on tileBg. */
  numberColor: string
  labelColor?: string
  /** Called once when the countdown reaches zero while the page is open. */
  onExpire?: () => void
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const onExpireRef = useRef(onExpire)
  const expiredFiredRef = useRef(false)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    const target = new Date(endAt).getTime()
    if (Number.isNaN(target)) return
    expiredFiredRef.current = false

    function tick() {
      const remaining = Math.max(0, target - Date.now())
      setRemainingMs(remaining)
      if (remaining === 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true
        onExpireRef.current?.()
      }
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
    <div style={{ display: 'inline-flex', gap: 'clamp(4px, 1.4vw, 8px)', fontVariantNumeric: 'tabular-nums' }}>
      {units.map(([value, label], i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div
            style={{
              background: tileBg,
              border: `1px solid ${tileBorder}`,
              borderRadius: 10,
              minWidth: 'clamp(34px, 9vw, 46px)',
              padding: 'clamp(4px, 1.3vw, 7px) 3px',
              fontWeight: 800,
              fontSize: 'clamp(0.85rem, 2.6vw, 1.05rem)',
              color: numberColor,
              lineHeight: 1,
            }}
          >
            {String(value).padStart(2, '0')}
          </div>
          <div
            style={{
              fontSize: 'clamp(0.54rem, 1.6vw, 0.62rem)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: labelColor,
              marginTop: 'clamp(3px, 1vw, 5px)',
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
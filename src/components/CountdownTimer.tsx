'use client'

import { useEffect, useState } from 'react'

/**
 * Small ticking countdown for the landing page urgency banner.
 * Renders nothing until mounted (avoids an SSR/client text mismatch), and
 * renders nothing once the target time has passed — never gets stuck
 * showing "00:00:00" forever after the deadline.
 */
export default function CountdownTimer({ endAt, textColor }: { endAt: string; textColor: string }) {
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

  const parts: [number, string][] = days > 0
    ? [[days, 'd'], [hours, 'h'], [minutes, 'm']]
    : [[hours, 'h'], [minutes, 'm'], [seconds, 's']]

  return (
    <span style={{ display: 'inline-flex', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
      {parts.map(([value, unit], i) => (
        <span key={i} style={{ fontWeight: 800, fontSize: '0.85rem', color: textColor }}>
          {String(value).padStart(2, '0')}{unit}
        </span>
      ))}
    </span>
  )
}
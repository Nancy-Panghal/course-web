'use client'
/**
 * components/WatermarkedPlayer.tsx
 * ─────────────────────────────────────────────────────────────────
 * Secure video player for the WEBSITE lesson page.
 * - src must be a signed /api/video/stream URL (never raw storage)
 * - Canvas watermark floats + drifts every 8s
 * - Diagonal tiled watermark survives cropping
 * - Blocks right-click, F12, PrintScreen, Ctrl+S
 * - Pauses on tab switch
 * - No download, no PiP, no remote playback
 * ─────────────────────────────────────────────────────────────────
 * Props:
 *   src          — signed stream URL
 *   studentName  — shown on watermark
 *   studentId    — phone / email / short ID on watermark
 *   lessonTitle  — shown in top bar
 *   onEnded      — called when video finishes
 */

import { useEffect, useRef, useState, useCallback } from 'react'

const DRIFT_MS = 8000

export default function WatermarkedPlayer({
  src,
  studentName = 'Student',
  studentId = '',
  lessonTitle = '',
  onEnded,
}: {
  src: string
  studentName?: string
  studentId?: string
  lessonTitle?: string
  onEnded?: () => void
}) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const animRef    = useRef<number>(0)
  const tRef       = useRef<number>(0)
  const playPromiseRef = useRef<Promise<void> | null>(null)

  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted,    setMuted]    = useState(false)
  const [volume,   setVolume]   = useState(1)
  const [fullscreen, setFS]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const wmText = studentId ? `${studentName} · ${studentId}` : studentName

  // ── Canvas size sync ────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c) return
    const ro = new ResizeObserver(() => {
      const r = v.getBoundingClientRect()
      c.width  = r.width
      c.height = r.height
    })
    ro.observe(v)
    return () => ro.disconnect()
  }, [])

  // ── Draw watermark (Smooth continuous Lissajous drift) ──────────
  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width, H = c.height
    ctx.clearRect(0, 0, W, H)

    if (!W || !H) { animRef.current = requestAnimationFrame(draw); return }

    // Increment time step for smooth continuous movement
    tRef.current += 0.0018

    // Boundaries with padding so watermark never goes out of frame
    const paddingX = W * 0.12
    const paddingY = H * 0.12
    const rangeX = W - paddingX * 2
    const rangeY = H - paddingY * 2

    // Lissajous curve movement for natural smooth floating
    const x = paddingX + (0.5 + 0.5 * Math.sin(tRef.current * 0.72) * Math.cos(tRef.current * 0.44)) * rangeX
    const y = paddingY + (0.5 + 0.5 * Math.sin(tRef.current * 0.52) * Math.sin(tRef.current * 0.96)) * rangeY

    const fs = Math.max(11, Math.min(W * 0.021, 17))
    ctx.font = `bold ${fs}px 'Courier New', monospace`

    // Measure text to draw dark background box
    const metrics = ctx.measureText(wmText)
    const boxW = metrics.width + 16
    const boxH = fs + 12
    const boxX = x - 8
    const boxY = y - fs - 5

    // Rounded rectangle dark background
    const radius = 6
    ctx.fillStyle = 'rgba(10, 10, 10, 0.72)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(boxX + radius, boxY)
    ctx.lineTo(boxX + boxW - radius, boxY)
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius)
    ctx.lineTo(boxX + boxW, boxY + boxH - radius)
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH)
    ctx.lineTo(boxX + radius, boxY + boxH)
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius)
    ctx.lineTo(boxX, boxY + radius)
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Draw high-contrast text with dropshadow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'
    ctx.shadowBlur = 4
    ctx.fillText(wmText, x, y - 2)

    // Reset shadow
    ctx.shadowBlur = 0

    // Diagonal tile watermark
    ctx.globalAlpha = 0.038
    ctx.font = `bold ${Math.max(9, fs * 0.75)}px 'Courier New', monospace`
    const step = 190
    for (let tx = -step; tx < W + step; tx += step) {
      for (let ty = -step; ty < H + step; ty += step) {
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(-Math.PI / 6)
        ctx.fillText(wmText, 0, 0)
        ctx.restore()
      }
    }

    ctx.globalAlpha = 1
    animRef.current = requestAnimationFrame(draw)
  }, [wmText])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // ── Anti-piracy event blockers ──────────────────────────────────
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    const container = document.getElementById('ak-wm-player')
    container?.addEventListener('contextmenu', block)

    const blockKeys = (e: KeyboardEvent) => {
      const blocked =
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) ||
        (e.ctrlKey && ['s','S','u','U'].includes(e.key))
      if (blocked) { e.preventDefault(); e.stopPropagation() }
    }
    document.addEventListener('keydown', blockKeys, true)

    const onVis = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause()
        setPlaying(false)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      container?.removeEventListener('contextmenu', block)
      document.removeEventListener('keydown', blockKeys, true)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // ── Video events ────────────────────────────────────────────────
  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress((v.currentTime / v.duration) * 100)
    setDuration(v.duration)
  }

  const onError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const code = (e.target as HTMLVideoElement).error?.code
    const msgs: Record<number, string> = {
      1: 'Playback aborted.',
      2: 'Network error.',
      3: 'Video decoding failed.',
      4: 'Link expired. Go back to Telegram for a fresh link.',
    }
    setError(msgs[code ?? 4] || 'Playback failed. Link may have expired.')
  }

  // ── Controls (With AbortError play/pause promise management) ────
  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      playPromiseRef.current = v.play()
      playPromiseRef.current
        .then(() => setPlaying(true))
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Play request failed:', err)
          }
        })
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            v.pause()
            setPlaying(false)
          })
          .catch(() => {
            v.pause()
            setPlaying(false)
          })
      } else {
        v.pause()
        setPlaying(false)
      }
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const r = e.currentTarget.getBoundingClientRect()
    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration
  }

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div
      id="ak-wm-player"
      onContextMenu={e => e.preventDefault()}
      style={{
        background: '#000', borderRadius: 12, overflow: 'hidden',
        userSelect: 'none', WebkitUserSelect: 'none',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Title bar */}
      {lessonTitle && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 600 }}>{lessonTitle}</span>
          <span style={{
            fontSize: 10, color: '#4ade80', fontWeight: 700,
            padding: '2px 8px', borderRadius: 999,
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.2)',
          }}>🔒 Protected</span>
        </div>
      )}

      {/* Video + Canvas */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
        <video
          ref={videoRef}
          src={src}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => { setPlaying(false); onEnded?.() }}
          onError={onError}
          onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
          onClick={toggle}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          playsInline
          preload="metadata"
        />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />

        {/* Play overlay */}
        {!playing && (
          <div
            onClick={toggle}
            style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 11,
            }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(124,58,237,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(124,58,237,0.5)',
            }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
          padding: '10px 14px', fontSize: 13,
          border: '1px solid rgba(239,68,68,0.3)',
        }}>⚠️ {error}</div>
      )}

      {/* Progress + controls */}
      <div style={{ padding: '8px 12px 10px', background: 'rgba(0,0,0,0.6)' }}>
        <div
          onClick={seek}
          style={{
            width: '100%', height: 4, background: 'rgba(255,255,255,0.1)',
            borderRadius: 2, cursor: 'pointer', marginBottom: 8,
          }}
        >
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', borderRadius: 2, transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggle} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>
            {playing ? '⏸' : '▶️'}
          </button>
          <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setMuted(m => !m) } }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
            {muted ? '🔇' : '🔊'}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
            {fmt(videoRef.current?.currentTime ?? 0)} / {fmt(duration)}
          </span>
        </div>
      </div>

      {/* Footer watermark strip */}
      <div style={{
        textAlign: 'center', padding: '5px 12px',
        fontSize: 10, color: 'rgba(255,255,255,0.18)',
        background: 'rgba(0,0,0,0.4)', letterSpacing: '0.03em',
        userSelect: 'none',
      }}>
        Licensed to {wmText} · AcademyKit · Unauthorized sharing is tracked
      </div>
    </div>
  )
}
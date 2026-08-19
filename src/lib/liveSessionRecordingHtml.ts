/**
 * lib/liveSessionRecordingHtml.ts
 * ─────────────────────────────────────────────────────────────────
 * Standalone HTML renderer for a live_sessions recording, opened from
 * a WhatsApp/Telegram notification link. Deliberately NOT built on top
 * of lessonPageHtml.ts's renderLessonPage — that renderer assumes a
 * `lessons` table row with quiz/assignment/"mark complete" state, none
 * of which applies to a live_sessions recording. Reusing it would mean
 * either faking a lesson object (fragile) or showing a "Mark Complete"
 * button wired to nothing real. This is a smaller, purpose-built
 * renderer instead, reusing the same watermark canvas approach and the
 * same security conventions (no right-click, no download, pause on
 * tab-hide) as the main watermarked player.
 * ─────────────────────────────────────────────────────────────────
 */

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SHELL_HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #000; color: #e4e4e7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
    .card { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; }
    .header { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .header h1 { font-size: 15px; font-weight: 700; margin: 0 0 2px; color: #fff; }
    .header p { font-size: 12px; color: #a1a1aa; margin: 0; }
    .empty { padding: 48px 24px; text-align: center; }
    .empty .icon { font-size: 40px; margin-bottom: 12px; }
    .empty h2 { font-size: 16px; color: #fff; margin: 0 0 8px; }
    .empty p { font-size: 13px; color: #a1a1aa; margin: 0; line-height: 1.6; }
  </style>
`

export function renderLiveSessionRecordingPage(params: {
  sessionTitle: string
  courseName: string
  identity: string
  videoStreamUrl: string
}): string {
  const title = escapeHtml(params.sessionTitle)
  const course = escapeHtml(params.courseName)
  const wmText = escapeHtml(params.identity)
  const src = escapeHtml(params.videoStreamUrl)

  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>${title}</title>
  <style>
    .player-wrap { position: relative; background: #000; aspect-ratio: 16/9; }
    .player-wrap.fs { position: fixed; inset: 0; z-index: 9999; aspect-ratio: unset; display: flex; flex-direction: column; }
    video { width: 100%; height: 100%; display: block; object-fit: contain; }
    .watermark-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
    .protected-badge { font-size: 10px; color: #4ade80; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2); }
    .controls-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(0,0,0,0.6); }
    .controls-bar button { background: none; border: none; color: #fff; font-size: 16px; cursor: pointer; }
    .fs-btn { margin-left: auto; color: rgba(255,255,255,0.7); }
    .footer-strip { text-align: center; padding: 5px 12px; font-size: 10px; color: rgba(255,255,255,0.18); background: rgba(0,0,0,0.4); user-select: none; }
  </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="header" style="display:flex;align-items:center;justify-content:space-between">
          <div><h1>${title}</h1><p>${course}</p></div>
          <span class="protected-badge">🔒 Protected</span>
        </div>
        <div class="player-wrap" id="playerWrap">
          <video id="rec" src="${src}" playsinline webkit-playsinline="true" disablePictureInPicture disableRemotePlayback controlsList="nodownload nofullscreen noremoteplayback" preload="metadata"></video>
          <canvas id="wmCanvas" class="watermark-canvas"></canvas>
        </div>
        <div class="controls-bar">
          <button id="playBtn">▶️</button>
          <button id="muteBtn">🔊</button>
          <span id="timeLabel" style="color:rgba(255,255,255,0.5);font-size:11px">0:00 / 0:00</span>
          <button id="fsBtn" class="fs-btn">⤢</button>
        </div>
        <div class="footer-strip">Licensed to ${wmText} · Kurso · Unauthorized sharing is tracked</div>
      </div>
    </div>
    <script>
      const video = document.getElementById('rec')
      const canvas = document.getElementById('wmCanvas')
      const ctx = canvas.getContext('2d')
      const wrap = document.getElementById('playerWrap')
      const playBtn = document.getElementById('playBtn')
      const muteBtn = document.getElementById('muteBtn')
      const fsBtn = document.getElementById('fsBtn')
      const timeLabel = document.getElementById('timeLabel')
      const wmText = ${JSON.stringify(params.identity)}
      let fullscreen = false

      function resize() {
        const r = video.getBoundingClientRect()
        canvas.width = r.width
        canvas.height = r.height
      }
      new ResizeObserver(resize).observe(video)

      let t = 0
      function draw() {
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)
        if (W && H) {
          t += 0.0018
          const paddingX = W * 0.12, paddingY = H * 0.12
          const x = paddingX + (0.5 + 0.5 * Math.sin(t * 0.72) * Math.cos(t * 0.44)) * (W - paddingX * 2)
          const y = paddingY + (0.5 + 0.5 * Math.sin(t * 0.52) * Math.sin(t * 0.96)) * (H - paddingY * 2)
          const fs = Math.max(11, Math.min(W * 0.021, 17))
          ctx.font = "bold " + fs + "px 'Courier New', monospace"
          const metrics = ctx.measureText(wmText)
          const boxW = metrics.width + 16, boxH = fs + 12
          ctx.fillStyle = 'rgba(10,10,10,0.72)'
          ctx.fillRect(x - 8, y - fs - 5, boxW, boxH)
          ctx.fillStyle = 'rgba(255,255,255,0.88)'
          ctx.fillText(wmText, x, y - 2)
          ctx.globalAlpha = 0.038
          ctx.font = "bold " + Math.max(9, fs * 0.75) + "px 'Courier New', monospace"
          const step = 190
          for (let tx = -step; tx < W + step; tx += step) {
            for (let ty = -step; ty < H + step; ty += step) {
              ctx.save(); ctx.translate(tx, ty); ctx.rotate(-Math.PI / 6); ctx.fillText(wmText, 0, 0); ctx.restore()
            }
          }
          ctx.globalAlpha = 1
        }
        requestAnimationFrame(draw)
      }
      requestAnimationFrame(draw)

      function fmt(s) { if (!s || isNaN(s)) return '0:00'; return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0') }
      video.addEventListener('timeupdate', () => { timeLabel.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration) })
      playBtn.addEventListener('click', () => { if (video.paused) { video.play(); playBtn.textContent = '⏸' } else { video.pause(); playBtn.textContent = '▶️' } })
      video.addEventListener('click', () => playBtn.click())
      video.addEventListener('dblclick', e => e.preventDefault())
      muteBtn.addEventListener('click', () => { video.muted = !video.muted; muteBtn.textContent = video.muted ? '🔇' : '🔊' })

      // Same fix as the main WatermarkedPlayer: never let the bare
      // <video> take over native OS-level fullscreen (the watermark
      // canvas can't reach it there) — use a CSS-only pseudo-fullscreen
      // on the wrapper div instead.
      function setFullscreen(on) {
        fullscreen = on
        wrap.classList.toggle('fs', on)
        document.body.style.overflow = on ? 'hidden' : ''
        fsBtn.textContent = on ? '⤡' : '⤢'
      }
      fsBtn.addEventListener('click', () => setFullscreen(!fullscreen))
      video.addEventListener('webkitbeginfullscreen', () => { try { video.webkitExitFullscreen && video.webkitExitFullscreen() } catch (e) {}; setFullscreen(true) })
      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === video) { document.exitFullscreen().catch(() => {}); setFullscreen(true) }
      })
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && fullscreen) setFullscreen(false) })

      document.addEventListener('contextmenu', e => e.preventDefault())
      document.addEventListener('keydown', e => {
        if (e.key === 'PrintScreen' || e.key === 'F12' || ((e.ctrlKey||e.metaKey) && ['s','S','u','U'].includes(e.key))) e.preventDefault()
      }, true)
      document.addEventListener('visibilitychange', () => { if (document.hidden && !video.paused) { video.pause(); playBtn.textContent = '▶️' } })
    </script>
  </body></html>`
}

export function renderExternalRecordingLinkPage(params: {
  sessionTitle: string
  courseName: string
  recordingUrl: string
}): string {
  const title = escapeHtml(params.sessionTitle)
  const course = escapeHtml(params.courseName)
  // The href itself is intentionally NOT escaped with escapeHtml (which
  // would mangle valid URL characters like & into &amp; twice-encoded) —
  // it's placed only inside an href attribute, and creators entering this
  // field are already trusted actors (same trust level as everywhere
  // else a creator supplies a URL in this codebase, e.g. join_url).
  const url = params.recordingUrl
  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>${title}</title></head>
  <body><div class="wrap"><div class="card">
    <div class="header" style="display:flex;align-items:center;justify-content:space-between">
      <div><h1>${title}</h1><p>${course}</p></div>
    </div>
    <div class="empty">
      <div class="icon">🎬</div>
      <h2>Recording ready</h2>
      <p style="margin-bottom:20px">Your instructor shared this recording as an external link — it opens outside Kurso, so playback protection doesn't apply to it the way it does for uploaded recordings.</p>
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#fff;color:#000;font-weight:600;text-decoration:none;font-size:14px">Watch recording →</a>
    </div>
  </div></div></body></html>`
}

export function renderRecordingNotAvailablePage(params: { sessionTitle: string; courseName: string }): string {
  const title = escapeHtml(params.sessionTitle)
  const course = escapeHtml(params.courseName)
  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>${title}</title></head>
  <body><div class="wrap"><div class="card">
    <div class="header"><h1>${title}</h1><p>${course}</p></div>
    <div class="empty">
      <div class="icon">⏳</div>
      <h2>Recording not available yet</h2>
      <p>This live session has ended and your instructor hasn't uploaded a recording yet. You'll be notified as soon as it's ready.</p>
    </div>
  </div></div></body></html>`
}

export function expiredRecordingLinkHtml(): string {
  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>Link expired</title></head>
  <body><div class="wrap"><div class="card"><div class="empty">
    <div class="icon">⌛</div>
    <h2>This link has expired</h2>
    <p>Please open the recording from your latest message, or visit your dashboard on the Kurso website.</p>
  </div></div></div></body></html>`
}

export function invalidRecordingLinkHtml(): string {
  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>Invalid link</title></head>
  <body><div class="wrap"><div class="card"><div class="empty">
    <div class="icon">⚠️</div>
    <h2>This link isn't valid</h2>
    <p>Please open the recording from your latest message, or visit your dashboard on the Kurso website.</p>
  </div></div></div></body></html>`
}

export function recordingSessionNotFoundHtml(): string {
  return `<!DOCTYPE html><html><head>${SHELL_HEAD}<title>Not found</title></head>
  <body><div class="wrap"><div class="card"><div class="empty">
    <div class="icon">🔍</div>
    <h2>Session not found</h2>
    <p>This live session may have been removed. Please check your dashboard on the Kurso website.</p>
  </div></div></div></body></html>`
}
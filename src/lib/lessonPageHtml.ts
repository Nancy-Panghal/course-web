/**
 * src/lib/lessonPageHtml.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for the lesson viewer page shown to students
 * opening a lesson link from Telegram OR WhatsApp.
 *
 * Previously Telegram and WhatsApp had two completely separate
 * implementations — Telegram's had full watermarking + a proper
 * resources/quiz/assignment/live layout, WhatsApp's was a stripped-down
 * page with no watermark and no handling for non-video/pdf lessons.
 * This file is the one renderer both routes now call, parameterized by
 * `platform` for the small bits that genuinely differ (the "continue on
 * X" deep link button at the bottom).
 * ─────────────────────────────────────────────────────────────────
 */

export type ContentKind = 'video' | 'pdf' | 'quiz' | 'assignment' | 'live'

export interface LessonPageLesson {
  id: string
  title: string
  content_type: string
  order_num: number
  duration?: string | null
  course_id: string
  summary_url?: string | null
  notes_url?: string | null
  quiz_questions?: { question: string; options: string[]; answerIndex: number }[] | null
  assignment_prompt?: string | null
  assignment_required?: boolean | null
  assignment_file_url?: string | null
  assignment_file_name?: string | null
  content_url?: string | null // used for the live-class join link
}

export interface RenderLessonPageParams {
  platform: 'telegram' | 'whatsapp'
  lesson: LessonPageLesson
  course: { id: string; name: string } | null
  studentName: string
  identity: string
  contentUrl: string | null // signed video/pdf proxy URL — null for quiz/assignment/live
  fingerprint: string
  summaryUrl: string | null
  notesUrl: string | null
  quizUrl: string | null
  quizResult: { score: number; total: number } | null
  isCompleted: boolean
  ctaUrl: string | null
  ctaLabel: string
  ctaColor: string
}

function resolveContentKind(contentType: string): ContentKind {
  if (contentType === 'pdf') return 'pdf'
  if (contentType === 'quiz') return 'quiz'
  if (contentType === 'assignment') return 'assignment'
  if (contentType === 'live') return 'live'
  return 'video'
}

function isImageFile(nameOrUrl: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(nameOrUrl)
}

export function renderLessonPage({
  platform,
  lesson,
  course,
  studentName,
  identity,
  contentUrl,
  fingerprint,
  summaryUrl,
  notesUrl,
  quizUrl,
  quizResult,
  isCompleted,
  ctaUrl,
  ctaLabel,
  ctaColor,
}: RenderLessonPageParams): string {
  const title = lesson.title || 'Lesson'
  const courseName = course?.name || 'Course'
  const shortId = identity.slice(-6)
  const contentKind = resolveContentKind(lesson.content_type)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>${title} — AcademyKit</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #080808;
      --surface: #111;
      --border: rgba(255,255,255,0.07);
      --purple: #7c3aed;
      --purple-light: #a78bfa;
      --text: #e4e4e7;
      --muted: #71717a;
    }

    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      height: 100%;
      overflow-x: hidden;
      -webkit-user-select: none;
      user-select: none;
    }

    .nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: rgba(8,8,8,0.95);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      backdrop-filter: blur(16px);
    }
    .nav-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
    .nav-logo-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .nav-logo-text { font-size: 13px; font-weight: 700; color: #fff; }
    .nav-badge {
      font-size: 10px; font-weight: 700; padding: 3px 10px;
      border-radius: 999px; letter-spacing: 0.08em; text-transform: uppercase;
      background: rgba(124,58,237,0.12); color: var(--purple-light);
      border: 1px solid rgba(124,58,237,0.25);
    }

    .main { max-width: 800px; margin: 0 auto; padding: 0 0 40px; }

    .lesson-header {
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--border);
    }
    .lesson-meta {
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--purple-light); margin-bottom: 6px;
    }
    .lesson-title {
      font-size: clamp(1.1rem, 4vw, 1.4rem);
      font-weight: 800; color: #fff; line-height: 1.3;
    }
    .lesson-sub {
      margin-top: 6px; font-size: 12px; color: var(--muted);
    }

    .player-wrap {
      position: relative;
      background: #000;
      aspect-ratio: 16/9;
      width: 100%;
      overflow: hidden;
    }
    .player-wrap video {
      width: 100%; height: 100%; display: block; object-fit: contain;
    }
    .watermark-canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 20;
    }

    .pdf-container {
      position: relative;
      width: 100%;
      height: calc(100vh - 120px);
      min-height: 500px;
      background: #0b0b0b;
      overflow: hidden;
    }
    .pdf-wrap {
      width: 100%; height: 100%;
      border: none;
    }
    .screen-watermark {
      position: absolute;
      inset: 0;
      z-index: 15;
      pointer-events: none;
      overflow: hidden;
    }
    .wm-floating {
      position: absolute;
      left: 7%;
      top: 10%;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(0,0,0,0.66);
      border: 1px solid rgba(255,255,255,0.36);
      color: rgba(255,255,255,0.92);
      font: 800 12px/1.2 monospace;
      text-shadow: 0 2px 6px #000, 0 0 2px #000;
      animation: drift 26s infinite alternate ease-in-out;
    }
    .wm-grid {
      position: absolute;
      inset: -30%;
      transform: rotate(-24deg);
      color: rgba(255,255,255,0.14);
      font: 800 17px monospace;
      line-height: 92px;
      word-spacing: 58px;
      text-shadow: 0 1px 2px #000;
      opacity: 0.95;
    }
    @keyframes drift {
      0% { transform: translate(0, 0); }
      35% { transform: translate(44vw, 14vh); }
      70% { transform: translate(16vw, 46vh); }
      100% { transform: translate(58vw, 56vh); }
    }

    .controls {
      padding: 10px 16px;
      background: rgba(0,0,0,0.5);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px;
    }
    .ctrl-btn {
      background: none; border: none; color: #fff;
      font-size: 18px; cursor: pointer; padding: 4px; opacity: 0.8;
    }
    .ctrl-btn:hover { opacity: 1; }
    .progress-track {
      flex: 1; height: 4px; background: rgba(255,255,255,0.1);
      border-radius: 2px; cursor: pointer; position: relative;
      touch-action: none;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg,#7c3aed,#4f46e5);
      border-radius: 2px; transition: width 0.1s linear;
      pointer-events: none;
    }
    .time-label { font-size: 11px; color: var(--muted); white-space: nowrap; }

    .wm-strip {
      text-align: center; padding: 8px 16px;
      font-size: 10px; color: rgba(255,255,255,0.18);
      background: rgba(0,0,0,0.4); letter-spacing: 0.04em;
      user-select: none; -webkit-user-select: none;
    }

    .done-section { padding: 20px 16px; display: flex; flex-direction: column; gap: 14px; }
    .done-btn {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg,#7c3aed,#4f46e5);
      border: none; border-radius: 12px;
      color: #fff; font-size: 15px; font-weight: 700;
      cursor: pointer; transition: opacity 0.2s;
    }
    .done-btn:hover { opacity: 0.9; }
    .done-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .done-msg {
      text-align: center; font-size: 13px; color: #4ade80;
    }

    .resources-section {
      padding: 24px 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border-bottom: 1px solid var(--border);
    }
    .resources-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--purple-light);
    }
    .resources-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .resource-link {
      display: inline-flex;
      align-items: center;
      padding: 8px 14px;
      border-radius: 10px;
      background: rgba(124,58,237,0.12);
      color: #c4b5fd;
      border: 1px solid rgba(124,58,237,0.22);
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .resource-link:hover {
      background: rgba(124,58,237,0.2);
      border-color: rgba(124,58,237,0.35);
      transform: translateY(-1px);
    }
    .resource-link.quiz-complete-badge {
      background: rgba(74,222,128,0.1);
      color: #4ade80;
      border-color: rgba(74,222,128,0.22);
    }
    .resource-link.quiz-complete-badge:hover {
      background: rgba(74,222,128,0.18);
      border-color: rgba(74,222,128,0.35);
    }

    .platform-cta-container { margin-top: 4px; }
    .platform-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .platform-cta-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }

    /* ── Quiz / Assignment / Live content cards ── */
    .content-card {
      aspect-ratio: 16/9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 24px;
      text-align: center;
    }
    .content-card.quiz { background: rgba(124,58,237,0.06); border-bottom: 1px solid rgba(124,58,237,0.2); }
    .content-card.live { background: rgba(234,179,8,0.06); border-bottom: 1px solid rgba(234,179,8,0.2); }
    .content-card-title { font-size: 16px; font-weight: 700; color: #fff; }
    .content-card-empty { font-size: 13px; color: var(--muted); }
    .content-card-btn {
      padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 700;
      text-decoration: none; display: inline-block;
    }
    .content-card-btn.quiz { background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #fff; }
    .content-card-btn.live { background: #eab308; color: #000; }

    .assignment-section {
      margin: 18px 16px; padding: 16px; border-radius: 12px;
      background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
    }
    .assignment-title { font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 8px; }
    .assignment-prompt { font-size: 13px; color: #e4e4e7; margin-bottom: 12px; line-height: 1.6; }
    .assignment-empty { font-size: 13px; color: var(--muted); }
    .assignment-file-link {
      display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
      color: #c4b5fd; padding: 6px 12px; border-radius: 8px;
      background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.22);
      text-decoration: none;
    }
    .assignment-image { max-width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); display: block; }
  </style>
</head>
<body>

  <nav class="nav">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">🛡</div>
      <span class="nav-logo-text">AcademyKit</span>
    </a>
    <span class="nav-badge">🔒 Protected</span>
  </nav>

  <div class="main">

    <div class="lesson-header">
      <p class="lesson-meta">${courseName} · Lesson ${lesson.order_num}${lesson.duration ? ` · ${lesson.duration}` : ''}</p>
      <h1 class="lesson-title">${title}</h1>
      <p class="lesson-sub">Licensed to: <strong style="color:#e4e4e7">${studentName}</strong>${fingerprint}</p>
    </div>

    ${contentKind === 'pdf' && contentUrl ? `
    <!-- PDF viewer -->
    <div class="pdf-container">
      <iframe src="${contentUrl}" class="pdf-wrap" title="${title}"></iframe>
      <div class="screen-watermark">
        <div class="wm-grid">${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit</div>
        <div class="wm-floating">Licensed to ${studentName} · ID ${shortId}</div>
      </div>
    </div>
    ` : contentKind === 'quiz' ? `
    <!-- Quiz lesson -->
    <div class="content-card quiz">
      ${quizUrl ? `
        <p class="content-card-title">🧠 This lesson is a quiz</p>
        <a href="${quizUrl}" target="_blank" class="content-card-btn quiz">
          ${quizResult ? `Retake Quiz (Last score: ${quizResult.score}/${quizResult.total})` : 'Take the Quiz'}
        </a>
      ` : `<p class="content-card-empty">This quiz hasn't been added yet. Check back soon.</p>`}
    </div>
    ` : contentKind === 'live' ? `
    <!-- Live class lesson -->
    <div class="content-card live">
      ${lesson.content_url ? `
        <p class="content-card-title">🔴 This is a live class</p>
        <a href="${lesson.content_url}" target="_blank" class="content-card-btn live">Join Live Class</a>
      ` : `<p class="content-card-empty">Live class details haven't been added yet. Check back soon.</p>`}
    </div>
    ` : contentKind === 'assignment' ? `
    <!-- Assignment lesson — rendered entirely in the assignment section below -->
    ` : contentUrl ? `
    <!-- Video player + canvas watermark -->
    <div class="player-wrap" id="playerWrap">
      <video
        id="vid"
        src="${contentUrl}"
        preload="metadata"
        playsinline
        controlslist="nodownload nofullscreen noremoteplayback"
        disablepictureinpicture
      ></video>
      <div class="screen-watermark">
        <div class="wm-grid">${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit</div>
        <div class="wm-floating">Licensed to ${studentName} · ID ${shortId}</div>
      </div>
      <canvas id="wmCanvas" class="watermark-canvas"></canvas>
    </div>

    <div class="controls">
      <button class="ctrl-btn" id="playBtn" title="Play/Pause">▶</button>
      <button class="ctrl-btn" id="muteBtn" title="Mute">🔊</button>
      <div class="progress-track" id="progressTrack">
        <div class="progress-fill" id="progressFill" style="width:0%"></div>
      </div>
      <span class="time-label" id="timeLabel">0:00 / 0:00</span>
    </div>
    ` : `
    <div class="content-card">
      <p class="content-card-empty">Content unavailable.</p>
    </div>
    `}

    ${contentKind !== 'assignment' ? `
    <div class="wm-strip">
      Licensed to ${studentName} · ID: ${shortId} · AcademyKit · Sharing violates your license
    </div>
    ` : ''}

    ${contentKind === 'assignment' ? `
    <!-- Assignment section -->
    <div class="assignment-section">
      <p class="assignment-title">📝 Assignment${lesson.assignment_required ? ' (Required)' : ' (Optional)'}</p>
      ${!lesson.assignment_prompt && !lesson.assignment_file_url ? `
        <p class="assignment-empty">This assignment hasn't been added yet. Check back soon.</p>
      ` : `
        ${lesson.assignment_prompt ? `<p class="assignment-prompt">${lesson.assignment_prompt}</p>` : ''}
        ${lesson.assignment_file_url ? (
          isImageFile(lesson.assignment_file_name || lesson.assignment_file_url)
            ? `<a href="${lesson.assignment_file_url}" target="_blank"><img class="assignment-image" src="${lesson.assignment_file_url}" alt="Assignment attachment" /></a>`
            : `<a href="${lesson.assignment_file_url}" target="_blank" class="assignment-file-link">📎 ${lesson.assignment_file_name || 'Download Assignment File'}</a>`
        ) : ''}
      `}
    </div>
    ` : ''}

    <!-- Lesson Resources -->
    ${(summaryUrl || notesUrl || quizUrl) ? `
    <div class="resources-section">
      <h2 class="resources-title">Lesson Resources</h2>
      <div class="resources-grid">
        ${summaryUrl ? `<a href="${summaryUrl}" target="_blank" class="resource-link">📄 Summary</a>` : ''}
        ${notesUrl ? `<a href="${notesUrl}" target="_blank" class="resource-link">📝 Notes</a>` : ''}
        ${quizUrl ? `
          <a href="${quizUrl}" target="_blank" class="resource-link ${quizResult ? 'quiz-complete-badge' : ''}">
            🧠 ${quizResult ? `Quiz: ${quizResult.score}/${quizResult.total}` : 'Take Quiz'}
          </a>
        ` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Mark done -->
    <div class="done-section">
      <button class="done-btn" id="doneBtn" onclick="markDone()" ${isCompleted ? 'disabled' : ''}>
        ${isCompleted ? '✅ Lesson Completed' : '✅ Mark Lesson Complete'}
      </button>

      <div class="platform-cta-container" id="platformCtaWrap" style="${isCompleted && ctaUrl ? 'display: block;' : 'display: none;'}">
        ${ctaUrl ? `
        <a href="${ctaUrl}" target="_blank" class="platform-cta-btn" style="background:${ctaColor}; box-shadow: 0 4px 12px ${ctaColor}33;">
          💬 ${ctaLabel}
        </a>
        ` : ''}
      </div>

      <p class="done-msg" id="doneMsg" style="${isCompleted ? 'display: block;' : 'display: none;'}">
        Lesson marked complete! ${ctaUrl ? 'Click above to continue.' : ''}
      </p>
    </div>

  </div>

  <script>
    document.addEventListener('contextmenu', e => e.preventDefault())
    document.addEventListener('keydown', e => {
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i','I','j','J','c','C','u','U'].includes(e.key)) ||
        (e.ctrlKey && ['s','S','u','U'].includes(e.key))
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }, true)

    document.addEventListener('visibilitychange', () => {
      const v = document.getElementById('vid')
      if (v && document.hidden) v.pause()
    })

    ${contentKind === 'video' && contentUrl ? `
    // ── Video player logic ────────────────────────────────────────
    const vid = document.getElementById('vid')
    const playBtn = document.getElementById('playBtn')
    const muteBtn = document.getElementById('muteBtn')
    const progressFill = document.getElementById('progressFill')
    const progressTrack = document.getElementById('progressTrack')
    const timeLabel = document.getElementById('timeLabel')
    const canvas = document.getElementById('wmCanvas')
    const ctx = canvas.getContext('2d')

    const STUDENT = ${JSON.stringify(studentName)}
    const SHORT_ID = ${JSON.stringify(shortId)}
    const WM_TEXT = STUDENT + ' · ' + SHORT_ID + ' · AcademyKit'

    function syncCanvasSize() {
      const wrap = document.getElementById('playerWrap')
      canvas.width = wrap.offsetWidth
      canvas.height = wrap.offsetHeight
    }
    new ResizeObserver(syncCanvasSize).observe(document.getElementById('playerWrap'))
    syncCanvasSize()

    let wmX = 0.15, wmY = 0.12
    function driftWatermark() {
      wmX = 0.05 + Math.random() * 0.7
      wmY = 0.05 + Math.random() * 0.8
    }
    setInterval(driftWatermark, 8000)

    function drawWatermark() {
      const W = canvas.width, H = canvas.height
      if (!W || !H) { requestAnimationFrame(drawWatermark); return }
      ctx.clearRect(0, 0, W, H)

      const fs = Math.max(12, Math.min(W * 0.022, 20))
      ctx.font = fs + 'px monospace'
      const x = wmX * W
      const y = wmY * H
      const metrics = ctx.measureText(WM_TEXT)
      ctx.globalAlpha = 0.72
      ctx.fillStyle = 'rgba(0,0,0,0.58)'
      ctx.fillRect(x - 8, y - fs - 8, metrics.width + 16, fs + 16)
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'
      ctx.lineWidth = 1
      ctx.strokeRect(x - 8, y - fs - 8, metrics.width + 16, fs + 16)
      ctx.globalAlpha = 0.92
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 8
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 3
      ctx.strokeText(WM_TEXT, x, y)
      ctx.fillText(WM_TEXT, x, y)

      ctx.globalAlpha = 0.11
      ctx.font = Math.max(9, fs * 0.7) + 'px monospace'
      ctx.shadowBlur = 0
      const step = 200
      for (let tx = -step; tx < W + step; tx += step) {
        for (let ty = -step; ty < H + step; ty += step) {
          ctx.save()
          ctx.translate(tx, ty)
          ctx.rotate(-Math.PI / 6)
          ctx.fillText(WM_TEXT, 0, 0)
          ctx.restore()
        }
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      requestAnimationFrame(drawWatermark)
    }
    requestAnimationFrame(drawWatermark)

    function fmtTime(s) {
      if (!s || isNaN(s)) return '0:00'
      return Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2,'0')
    }

    vid.addEventListener('timeupdate', () => {
      if (!vid.duration) return
      progressFill.style.width = (vid.currentTime / vid.duration * 100) + '%'
      timeLabel.textContent = fmtTime(vid.currentTime) + ' / ' + fmtTime(vid.duration)
    })

    vid.addEventListener('play', () => { playBtn.textContent = '⏸' })
    vid.addEventListener('pause', () => { playBtn.textContent = '▶' })
    vid.addEventListener('ended', () => { playBtn.textContent = '▶' })
    vid.addEventListener('error', () => {
      const retryKey = 'ak_video_retry_' + ${JSON.stringify(lesson.id)}
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1')
        window.location.reload()
        return
      }
      document.getElementById('playerWrap').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#71717a;font-size:14px;flex-direction:column;gap:12px;">' +
        '<span style="font-size:32px">⚠️</span>' +
        '<span>This video could not be loaded. Please reopen the lesson link from ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}.</span>' +
        '</div>'
    })
    playBtn.onclick = () => { vid.paused ? vid.play() : vid.pause() }
    muteBtn.onclick = () => { vid.muted = !vid.muted; muteBtn.textContent = vid.muted ? '🔇' : '🔊' }

    let seeking = false
    function seekFromEvent(e) {
      if (!vid.duration || !isFinite(vid.duration)) return
      const r = progressTrack.getBoundingClientRect()
      const clientX = e.clientX ?? e.touches?.[0]?.clientX
      if (typeof clientX !== 'number' || r.width <= 0) return
      const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
      vid.currentTime = pct * vid.duration
      progressFill.style.width = (pct * 100) + '%'
      timeLabel.textContent = fmtTime(vid.currentTime) + ' / ' + fmtTime(vid.duration)
    }
    progressTrack.addEventListener('pointerdown', (e) => {
      seeking = true
      progressTrack.setPointerCapture?.(e.pointerId)
      seekFromEvent(e)
      e.preventDefault()
    })
    progressTrack.addEventListener('pointermove', (e) => {
      if (!seeking) return
      seekFromEvent(e)
      e.preventDefault()
    })
    progressTrack.addEventListener('pointerup', (e) => {
      if (!seeking) return
      seeking = false
      seekFromEvent(e)
      e.preventDefault()
    })
    progressTrack.addEventListener('click', seekFromEvent)
    ` : ''}

    // ── Mark lesson done ──────────────────────────────────────────
    async function markDone() {
      const btn = document.getElementById('doneBtn')
      const msg = document.getElementById('doneMsg')
      const ctaWrap = document.getElementById('platformCtaWrap')
      btn.disabled = true
      btn.textContent = 'Saving...'

      try {
        const res = await fetch('/api/lesson/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: ${JSON.stringify(identity)},
            lessonNum: ${lesson.order_num},
            courseId: ${JSON.stringify(lesson.course_id)},
            source: ${JSON.stringify(platform)},
          }),
        })
        if (res.ok) {
          btn.textContent = '✅ Lesson Completed'
          if (ctaWrap) ctaWrap.style.display = 'block'
          msg.style.display = 'block'
        } else {
          btn.disabled = false
          btn.textContent = '✅ Mark Lesson Complete'
        }
      } catch {
        btn.disabled = false
        btn.textContent = '✅ Mark Lesson Complete'
      }
    }
  </script>
</body>
</html>`
}
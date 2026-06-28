/**
 * app/api/lesson/view/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Entry point for Telegram lesson links.
 * Telegram bot sends:  https://yourapp.com/api/lesson/view?...signed params
 *
 * This route:
 *  1. Verifies the signed URL
/**
 * app/api/lesson/view/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Entry point for Telegram lesson links.
 * Telegram bot sends:  https://yourapp.com/api/lesson/view?...signed params
 *
 * This route:
 *  1. Verifies the signed URL
 *  2. Verifies enrollment in Supabase
 *  3. Logs access (piracy detection)
 *  4. Returns HTML page with the lesson content — watermarked
 *     (video uses /api/video/stream, PDF uses /api/pdf/view)
 *
 * This is the single URL students open from Telegram.
 * They never see storage URLs. All content flows through proxies.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLessonPageUrl, signVideoUrl, signPdfUrl, encodeFingerprint, signLessonResourceUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function logAccess(lessonId: string, courseId: string, identity: string) {
  try {
    await supabase.from('lesson_access_logs').insert({
      chat_id: identity,
      lesson_id: lessonId,
      course_id: courseId,
      accessed_at: new Date().toISOString(),
    })
  } catch {
    // non-critical
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  // ── Pre-checks so we never show "expired" for a problem that isn't
  //    actually about time running out (missing params / bad signature) ──
  const expParam = params.get('exp')
  const hasAllParams = !!(
    params.get('courseId') && params.get('lessonId') &&
    params.get('lesson') && params.get('identity') &&
    expParam && params.get('sig')
  )

  if (!hasAllParams) {
    return new NextResponse(invalidLinkHtml(), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (Date.now() > parseInt(expParam, 10)) {
    return new NextResponse(expiredHtml(), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 1. Verify signed URL
  const { valid, courseId, lessonId, lessonNum, identity } = verifyLessonPageUrl(params)

  if (!valid) {
    return new NextResponse(invalidLinkHtml(), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 2. Fetch lesson
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, content_type, order_num, duration, is_published, course_id, summary_url, notes_url, quiz_questions')
    .eq('id', lessonId)
    .single()

  if (!lesson || !lesson.is_published) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 3. Fetch course
  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name, creator_id')
    .eq('id', courseId)
    .single()

  // 4. Fetch enrollment for student name
  let studentName = `User ${identity.slice(-6)}`
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('phone, payment_status, completed_lessons, quiz_results')
    .eq('telegram_chat_id', identity)
    .eq('course_uuid', courseId)
    .limit(1)
    .single()

  if (enrollment?.phone) studentName = enrollment.phone

  // 5. Log access (fire and forget)
  logAccess(lessonId, courseId, identity)

  // 6. Generate signed content URL (video or PDF proxy)
  const contentUrl = lesson.content_type === 'video'
    ? signVideoUrl(lessonId, identity)
    : signPdfUrl(lessonId, identity)

  // 7. Build invisible fingerprint
  const fingerprint = encodeFingerprint(identity)

  // 8. Generate signed resource URLs
  const summaryUrl = lesson.summary_url
    ? signLessonResourceUrl(lesson.id, 'summary', identity)
    : null

  const notesUrl = lesson.notes_url
    ? signLessonResourceUrl(lesson.id, 'notes', identity)
    : null

  const quizUrl = (Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0)
    ? signLessonResourceUrl(lesson.id, 'quiz', identity)
    : null

  const quizResult = Array.isArray(enrollment?.quiz_results)
    ? enrollment.quiz_results.find((r: any) => r.lessonId === lesson.id)
    : null

  const isCompleted = Array.isArray(enrollment?.completed_lessons) && enrollment.completed_lessons.includes(lesson.order_num)

  // 9. Fetch creator profile for bot username
  let telegramBotUsername = ''
  if (course?.creator_id) {
    const { data: creator } = await supabase
      .from('creators')
      .select('telegram_bot_username')
      .eq('id', course.creator_id)
      .single()
    if (creator?.telegram_bot_username) {
      telegramBotUsername = creator.telegram_bot_username.replace('@', '')
    }
  }

  // 10. Return HTML lesson viewer page
  const html = lessonHtml({
    lesson,
    course,
    studentName,
    identity,
    contentUrl,
    fingerprint,
    isPdf: lesson.content_type === 'pdf',
    summaryUrl,
    notesUrl,
    quizUrl,
    quizResult,
    telegramBotUsername,
    isCompleted,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, private',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// ── HTML templates ─────────────────────────────────────────────────

interface LessonHtmlParams {
  lesson: any
  course: any
  studentName: string
  identity: string
  contentUrl: string
  fingerprint: string
  isPdf: boolean
  summaryUrl: string | null
  notesUrl: string | null
  quizUrl: string | null
  quizResult: any
  telegramBotUsername: string
  isCompleted: boolean
}

function lessonHtml({
  lesson,
  course,
  studentName,
  identity,
  contentUrl,
  fingerprint,
  isPdf,
  summaryUrl,
  notesUrl,
  quizUrl,
  quizResult,
  telegramBotUsername,
  isCompleted,
}: LessonHtmlParams) {
  const title = lesson.title || 'Lesson'
  const courseName = course?.name || 'Course'
  const shortId = identity.slice(-6)

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
      /* Prevent screenshot via CSS (limited but adds friction) */
      -webkit-user-select: none;
      user-select: none;
    }

    /* ── Nav ── */
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

    /* ── Main ── */
    .main { max-width: 800px; margin: 0 auto; padding: 0 0 40px; }

    /* ── Lesson header ── */
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

    /* ── Video player ── */
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
    /* Canvas overlay for watermark — sits on top of video */
    .watermark-canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 20;
    }

    /* ── PDF viewer ── */
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

    /* ── Controls ── */
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

    /* ── Watermark footer strip ── */
    .wm-strip {
      text-align: center; padding: 8px 16px;
      font-size: 10px; color: rgba(255,255,255,0.18);
      background: rgba(0,0,0,0.4); letter-spacing: 0.04em;
      user-select: none; -webkit-user-select: none;
    }

    /* ── Done button ── */
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

    /* ── Resources Section ── */
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

    /* ── Telegram CTA ── */
    .telegram-cta-container {
      margin-top: 4px;
    }
    .telegram-cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px;
      background: #229ED9;
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(34,158,217,0.2);
    }
    .telegram-cta-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>

  <!-- Nav -->
  <nav class="nav">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">🛡</div>
      <span class="nav-logo-text">AcademyKit</span>
    </a>
    <span class="nav-badge">🔒 Protected</span>
  </nav>

  <div class="main">

    <!-- Lesson header -->
    <div class="lesson-header">
      <p class="lesson-meta">${courseName} · Lesson ${lesson.order_num}${lesson.duration ? ` · ${lesson.duration}` : ''}</p>
      <h1 class="lesson-title">${title}</h1>
      <p class="lesson-sub">Licensed to: <strong style="color:#e4e4e7">${studentName}</strong>${fingerprint}</p>
    </div>

    ${isPdf ? `
    <!-- PDF viewer -->
    <div class="pdf-container">
      <iframe
        src="${contentUrl}"
        class="pdf-wrap"
        title="${title}"
      ></iframe>
      <div class="screen-watermark">
        <div class="wm-grid">${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit · ${studentName} · ${shortId} · AcademyKit</div>
        <div class="wm-floating">Licensed to ${studentName} · ID ${shortId}</div>
      </div>
    </div>
    ` : `
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

    <!-- Custom controls -->
    <div class="controls">
      <button class="ctrl-btn" id="playBtn" title="Play/Pause">▶</button>
      <button class="ctrl-btn" id="muteBtn" title="Mute">🔊</button>
      <div class="progress-track" id="progressTrack">
        <div class="progress-fill" id="progressFill" style="width:0%"></div>
      </div>
      <span class="time-label" id="timeLabel">0:00 / 0:00</span>
    </div>
    `}

    <!-- Watermark strip -->
    <div class="wm-strip">
      Licensed to ${studentName} · ID: ${shortId} · AcademyKit · Sharing violates your license
    </div>

    <!-- Lesson Resources -->
    ${(summaryUrl || notesUrl || quizUrl) ? `
    <div class="resources-section">
      <h2 class="resources-title">Lesson Resources</h2>
      <div class="resources-grid">
        ${summaryUrl ? `
          <a href="${summaryUrl}" target="_blank" class="resource-link">
            📄 Summary
          </a>
        ` : ''}
        ${notesUrl ? `
          <a href="${notesUrl}" target="_blank" class="resource-link">
            📝 Notes
          </a>
        ` : ''}
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

      <!-- Telegram CTA, hidden by default unless lesson is completed and bot username is available -->
      <div class="telegram-cta-container" id="telegramCtaWrap" style="${isCompleted && telegramBotUsername ? 'display: block;' : 'display: none;'}">
        <a href="https://t.me/${telegramBotUsername}?start=done_${lesson.order_num}" target="_blank" class="telegram-cta-btn">
          💬 Continue on Telegram
        </a>
      </div>

      <p class="done-msg" id="doneMsg" style="${isCompleted ? 'display: block;' : 'display: none;'}">
        Lesson marked complete! Click above to return to Telegram.
      </p>
    </div>

  </div>

  <script>
    // ── Prevent right-click + devtools shortcuts ──────────────────
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

    // Pause on tab switch
    document.addEventListener('visibilitychange', () => {
      const v = document.getElementById('vid')
      if (v && document.hidden) v.pause()
    })

    ${!isPdf ? `
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

    // Sync canvas size to video element
    function syncCanvasSize() {
      const wrap = document.getElementById('playerWrap')
      canvas.width = wrap.offsetWidth
      canvas.height = wrap.offsetHeight
    }
    new ResizeObserver(syncCanvasSize).observe(document.getElementById('playerWrap'))
    syncCanvasSize()

    // Watermark positions — drift every 8s
    let wmX = 0.15, wmY = 0.12
    function driftWatermark() {
      wmX = 0.05 + Math.random() * 0.7
      wmY = 0.05 + Math.random() * 0.8
    }
    setInterval(driftWatermark, 8000)

    // Draw watermark on every animation frame
    function drawWatermark() {
      const W = canvas.width, H = canvas.height
      if (!W || !H) { requestAnimationFrame(drawWatermark); return }
      ctx.clearRect(0, 0, W, H)

      // Primary floating text: high contrast so it survives bright/dark video frames.
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

      // Diagonal tiling: visible enough to make clean cropping painful.
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

    // Controls
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
      // The outer page link (exp/sig in the URL) is valid for up to 2 hours —
      // only the inner video stream URL died. Reload once to get a freshly
      // signed video URL from the server instead of dead-ending the student.
      const retryKey = 'ak_video_retry_' + ${JSON.stringify(lesson.id)}
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1')
        window.location.reload()
        return
      }
      document.getElementById('playerWrap').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#71717a;font-size:14px;flex-direction:column;gap:12px;">' +
        '<span style="font-size:32px">⚠️</span>' +
        '<span>This video could not be loaded. Please reopen the lesson link from Telegram.</span>' +
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
      const tgCta = document.getElementById('telegramCtaWrap')
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
          }),
        })
        if (res.ok) {
          btn.textContent = '✅ Lesson Completed'
          if (tgCta) tgCta.style.display = 'block'
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

function expiredHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">⏱</div><h2 style="margin-bottom:12px">Link Expired</h2>
  <p style="color:#71717a;margin-bottom:24px">This lesson link has expired. Go back to Telegram and tap the lesson button to get a fresh link.</p>
  </div></body></html>`
}

// Distinct from expiredHtml(): this is for links that are missing params or
// fail signature verification — i.e. NOT a simple "time ran out" case.
// Re-opening from Telegram usually fixes it, but if a student keeps landing
// here it's worth checking WHATSAPP_LINK_SECRET / LESSON_LINK_SECRET /
// TELEGRAM_LINK_SECRET are set consistently — that's a config bug, not expiry.
function invalidLinkHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Not Valid</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="margin-bottom:12px">Link Not Valid</h2>
  <p style="color:#71717a;margin-bottom:24px">This lesson link could not be verified. Go back to Telegram and tap the lesson button to get a fresh link. If this keeps happening, please let your instructor know — there may be a configuration issue.</p>
  </div></body></html>`
}

function notFoundHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">🔍</div><h2 style="margin-bottom:12px">Lesson Not Found</h2>
  <p style="color:#71717a">This lesson may not be published yet. Contact your instructor.</p>
  </div></body></html>`
}

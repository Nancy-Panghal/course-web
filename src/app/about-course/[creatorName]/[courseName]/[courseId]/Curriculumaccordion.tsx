'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, BookOpen, ChevronDown, FileText, Mic, Calendar, Clock, Video } from 'lucide-react'

interface Lesson {
  id: string
  title: string
  content_type: string
  order_num: number
  duration?: string
}

interface LiveSession {
  id: string
  title: string
  description?: string | null
  scheduled_at: string
  duration_minutes: number
  join_url: string
  recording_url?: string | null
}

interface Module {
  name: string
  lessons: Lesson[]
}

/** Minimal subset of LandingThemeColors used by this component. */
export interface CurriculumThemeColors {
  bg: string
  border: string
  borderSoft: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textFaint: string
  accent: string
  accentSoft: string
  accentBorder: string
  accentBorderStrong: string
  accentText: string
  cardBg: string
  pillBg: string
  curriculumPanelBg: string
}

export interface CurriculumThemeFonts {
  heading: string
  body: string
}

function contentIcon(type: string, accentText: string) {
  if (type === 'video') return <Play className="w-3.5 h-3.5" style={{ color: accentText }} />
  if (type === 'pdf') return <FileText className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
  if (type === 'audio') return <Mic className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
  return <BookOpen className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
}

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

/** Decide whether text on top of the curriculumPanelBg needs to be
 *  white (dark bg) or dark (light bg). Simple luminance check. */
function isDarkBg(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // perceived luminance (BT.601)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export default function CurriculumAccordion({
  modules,
  totalLessons,
  liveSessions = [],
  themeColors,
  themeFonts,
}: {
  modules: Module[]
  totalLessons: number
  liveSessions?: LiveSession[]
  themeColors?: CurriculumThemeColors
  themeFonts?: CurriculumThemeFonts
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [closingIndex, setClosingIndex] = useState<number | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any in-progress close timer when the component unmounts
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // ── Theme defaults (backwards-compatible: if no theme passed, use original dark style) ──
  // Use the main page bg for the curriculum panel — this is the key change that makes
  // light themes (Cherry Blossom, Ocean Breeze, Sunrise Editorial) look correct.
  // For dark themes (Midnight Violet, Emerald Noir, Carbon Black) the bg is already dark.
  const panelBg = themeColors?.bg ?? '#080808'
  const dark = isDarkBg(panelBg)
  const textPrimary = dark ? '#ffffff' : (themeColors?.textPrimary ?? '#ffffff')
  const textSecondary = dark ? '#a1a1aa' : (themeColors?.textSecondary ?? '#a1a1aa')
  const textMuted = dark ? '#71717a' : (themeColors?.textMuted ?? '#71717a')
  const textFaint = dark ? '#3f3f46' : (themeColors?.textFaint ?? '#3f3f46')
  const accentText = themeColors?.accentText ?? '#a78bfa'
  const accentSoft = themeColors?.accentSoft ?? 'rgba(124,58,237,0.1)'
  const accentBorder = themeColors?.accentBorder ?? 'rgba(124,58,237,0.25)'
  const accentBorderStrong = themeColors?.accentBorderStrong ?? 'rgba(124,58,237,0.35)'

  // Borders on the dark panel
  const panelBorder = dark
    ? 'rgba(255,255,255,0.07)'
    : themeColors?.borderSoft ?? 'rgba(0,0,0,0.1)'
  const panelBorderOpen = accentBorderStrong
  const modBg = dark ? 'rgba(255,255,255,0.02)' : (themeColors?.cardBg ?? 'rgba(255,255,255,0.5)')
  const modBgOpen = accentSoft
  const lessonSep = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
  const lessonTopBorder = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'

  const headingFont = themeFonts?.heading ?? "'Playfair Display', serif"
  const bodyFont = themeFonts?.body ?? 'inherit'

  function toggle(i: number) {
    setOpenIndex(prev => {
      if (prev === i) {
        setClosingIndex(i)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        closeTimerRef.current = setTimeout(() => {
          setClosingIndex(null)
        }, 260)
        return null
      }

      if (prev !== null) {
        setClosingIndex(prev)
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        closeTimerRef.current = setTimeout(() => {
          setClosingIndex(null)
        }, 260)
      }

      return i
    })
  }

  return (
    <section className="py-20 px-6" style={{ fontFamily: bodyFont }}>
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-center mb-2"
          style={{
            fontFamily: headingFont,
            fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
            fontWeight: 800,
            color: textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          Course Curriculum
        </h2>
        <p className="text-center mb-10" style={{ color: textMuted, fontSize: '0.95rem' }}>
          {totalLessons} lessons · {modules.length}{' '}
          {modules.length === 1 ? 'section' : 'sections'} · Telegram + Web
          {liveSessions.length > 0 && ` · ${liveSessions.length} live session${liveSessions.length !== 1 ? 's' : ''}`}
        </p>

        <div className="flex flex-col gap-2">
          {modules.map((mod, i) => {
            const isOpen = openIndex === i
            const isClosing = closingIndex === i
            return (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{
                  border: isOpen
                    ? `1px solid ${panelBorderOpen}`
                    : `1px solid ${panelBorder}`,
                  background: isOpen ? modBgOpen : modBg,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {/* Module header */}
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                >
                  {/* Number badge */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: isOpen ? accentSoft : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'),
                      color: isOpen ? accentText : textFaint,
                      transition: 'all 0.2s',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  {/* Module name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: isOpen ? textPrimary : textSecondary }}
                    >
                      {mod.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                      {mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Chevron */}
                  <div
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                      color: isOpen ? accentText : textFaint,
                      flexShrink: 0,
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Lessons list */}
                {(isOpen || closingIndex === i) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isOpen ? '1fr' : '0fr',
                      overflow: 'hidden',
                      transition: 'grid-template-rows 0.25s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    <div
                      style={{
                        minHeight: 0,
                        overflow: 'hidden',
                        borderTop: `1px solid ${lessonTopBorder}`,
                        padding: '4px 0',
                      }}
                    >
                      {mod.lessons.map((lesson, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 px-5 py-3"
                          style={{
                            borderBottom:
                              j < mod.lessons.length - 1
                                ? `1px solid ${lessonSep}`
                                : 'none',
                          }}
                        >
                          {/* Lesson number */}
                          <span
                            className="text-xs font-bold w-5 flex-shrink-0 text-right"
                            style={{ color: textFaint }}
                          >
                            {j + 1}
                          </span>

                          {/* Content type icon */}
                          <div className="flex-shrink-0">{contentIcon(lesson.content_type, accentText)}</div>

                          {/* Title */}
                          <span
                            className="text-sm flex-1 min-w-0 truncate"
                            style={{ color: textSecondary }}
                          >
                            {lesson.title}
                          </span>

                          {/* Duration */}
                          {lesson.duration && (
                            <span
                              className="text-xs flex-shrink-0"
                              style={{ color: textFaint }}
                            >
                              {lesson.duration}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Live Sessions ── */}
        {liveSessions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3 px-1">
              <Calendar className="w-4 h-4" style={{ color: '#38bdf8' }} />
              <span className="text-sm font-semibold" style={{ color: textPrimary }}>
                Live Sessions ({liveSessions.length})
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {liveSessions.map((s) => {
                const isPast = new Date(s.scheduled_at) < new Date()
                return (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                    style={{
                      background: isPast ? modBg : (dark ? 'rgba(56,189,248,0.05)' : 'rgba(2,132,199,0.04)'),
                      border: isPast
                        ? `1px solid ${panelBorder}`
                        : '1px solid rgba(56,189,248,0.18)',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: isPast ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'rgba(56,189,248,0.1)',
                      }}
                    >
                      {s.recording_url ? (
                        <Video className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
                      ) : (
                        <Calendar className="w-3.5 h-3.5" style={{ color: isPast ? textFaint : '#38bdf8' }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: textPrimary }}>{s.title}</p>
                      {s.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
                          {s.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs" style={{ color: textMuted }}>
                          <Calendar className="w-3 h-3" />
                          {formatSessionDate(s.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: textMuted }}>
                          <Clock className="w-3 h-3" />
                          {s.duration_minutes} min
                        </span>
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="flex-shrink-0">
                      {s.recording_url ? (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          Recording
                        </span>
                      ) : isPast ? (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textFaint }}>
                          Past
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
                          Upcoming
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

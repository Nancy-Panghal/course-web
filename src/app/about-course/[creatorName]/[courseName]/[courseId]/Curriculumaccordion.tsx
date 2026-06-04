'use client'

import { useState } from 'react'
import { Play, BookOpen, ChevronDown, FileText, Mic } from 'lucide-react'

interface Lesson {
  id: string
  title: string
  content_type: string
  order_num: number
  duration?: string
}

interface Module {
  name: string
  lessons: Lesson[]
}

function contentIcon(type: string) {
  if (type === 'video') return <Play className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
  if (type === 'pdf') return <FileText className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
  if (type === 'audio') return <Mic className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
  return <BookOpen className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
}

export default function CurriculumAccordion({
  modules,
  totalLessons,
}: {
  modules: Module[]
  totalLessons: number
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(i: number) {
    setOpenIndex(prev => (prev === i ? null : i))
  }

  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-center mb-2"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          Course Curriculum
        </h2>
        <p className="text-center mb-10" style={{ color: '#71717a', fontSize: '0.95rem' }}>
          {totalLessons} lessons · {modules.length}{' '}
          {modules.length === 1 ? 'section' : 'sections'} · Telegram + Web
        </p>

        <div className="flex flex-col gap-2">
          {modules.map((mod, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{
                  border: isOpen
                    ? '1px solid rgba(124,58,237,0.35)'
                    : '1px solid rgba(255,255,255,0.07)',
                  background: isOpen ? 'rgba(124,58,237,0.04)' : 'rgba(255,255,255,0.02)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {/* Module header — click to toggle */}
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                >
                  {/* Number badge */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: isOpen ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                      color: isOpen ? '#a78bfa' : '#52525b',
                      transition: 'all 0.2s',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  {/* Module name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: isOpen ? '#ffffff' : '#d4d4d8' }}
                    >
                      {mod.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                      {mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Chevron */}
                  <div
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                      color: isOpen ? '#a78bfa' : '#3f3f46',
                      flexShrink: 0,
                    }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Lessons list — animated open/close */}
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
                      borderTop: '1px solid rgba(255,255,255,0.05)',
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
                              ? '1px solid rgba(255,255,255,0.03)'
                              : 'none',
                        }}
                      >
                        {/* Lesson number */}
                        <span
                          className="text-xs font-bold w-5 flex-shrink-0 text-right"
                          style={{ color: '#3f3f46' }}
                        >
                          {j + 1}
                        </span>

                        {/* Content type icon */}
                        <div className="flex-shrink-0">{contentIcon(lesson.content_type)}</div>

                        {/* Title */}
                        <span
                          className="text-sm flex-1 min-w-0 truncate"
                          style={{ color: '#a1a1aa' }}
                        >
                          {lesson.title}
                        </span>

                        {/* Duration */}
                        {lesson.duration && (
                          <span
                            className="text-xs flex-shrink-0"
                            style={{ color: '#3f3f46' }}
                          >
                            {lesson.duration}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

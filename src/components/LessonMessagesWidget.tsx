'use client'
/**
 * src/components/LessonMessagesWidget.tsx
 * ─────────────────────────────────────────────────────────────────
 * Broadcast-page widget for per-lesson student messages:
 *   - "Note for published lesson"           → shown ABOVE an already-
 *     available lesson when the student opens it.
 *   - "Lesson availability information"     → shown INSTEAD of the
 *     lesson when it isn't published / missing content yet, or for
 *     a genuine future "Next Lesson" slot.
 *
 * Both dropdowns are custom (Kurso-styled), not native <select> —
 * per spec, no browser popups.
 *
 * Data comes from GET /api/lesson-messages?courseId=... (already
 * filters out stale 'availability' messages once a lesson becomes
 * available), and lessons are read directly via the Supabase client,
 * same as the course editor page.
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, Pencil, Trash2, Info, CheckCircle2, XCircle, Send } from 'lucide-react'

interface LessonRow {
  id: string
  order_num: number
  title: string
  is_published: boolean
  content_type: string
  quiz_questions: unknown[] | null
  assignment_prompt: string | null
  assignment_file_url: string | null
}

interface LessonMessage {
  id: string
  course_id: string
  lesson_id: string | null
  pending_lesson_number: number | null
  message_type: 'note' | 'availability'
  message_text: string
  lesson_title: string | null
  lesson_number: number
  created_at: string
  updated_at: string
}

const MAX_WORDS = 150

function lessonNeedsContent(l: LessonRow): boolean {
  if (l.content_type === 'quiz') return !Array.isArray(l.quiz_questions) || l.quiz_questions.length === 0
  if (l.content_type === 'assignment') return !l.assignment_prompt?.trim() && !l.assignment_file_url?.trim()
  return false
}

function lessonStatusLabel(l: LessonRow): { text: string; color: string } {
  if (!l.is_published) return { text: 'Unpublished', color: '#71717a' }
  if (lessonNeedsContent(l)) return { text: 'Content missing', color: '#f59e0b' }
  return { text: 'Published · Content added', color: '#4ade80' }
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── Generic Kurso-styled dropdown (no native <select>) ─────────────
function KursoDropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | null
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; disabled?: boolean; disabledReason?: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-left transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: selected ? '#fff' : '#71717a' }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 w-full rounded-xl overflow-hidden max-h-64 overflow-y-auto"
          style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              title={opt.disabled ? opt.disabledReason : undefined}
              onClick={() => {
                if (opt.disabled) return
                onChange(opt.value)
                setOpen(false)
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left transition-colors"
              style={{
                color: opt.disabled ? '#52525b' : '#fff',
                background: value === opt.value ? 'rgba(var(--kurso-primary-rgb), 0.12)' : 'transparent',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!opt.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = value === opt.value ? 'rgba(var(--kurso-primary-rgb), 0.12)' : 'transparent' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LessonMessagesWidget({ courseId, token }: { courseId: string; token: string }) {
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [messages, setMessages] = useState<LessonMessage[]>([])
  const [loading, setLoading] = useState(true)

  // 'existing:<lessonId>' or 'next'
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'note' | 'availability' | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const loadLessons = useCallback(async () => {
    const { data } = await supabase
      .from('lessons')
      .select('id, order_num, title, is_published, content_type, quiz_questions, assignment_prompt, assignment_file_url')
      .eq('course_id', courseId)
      .order('order_num', { ascending: true })
    setLessons((data as LessonRow[]) || [])
  }, [courseId])

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/lesson-messages?courseId=${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    setMessages(json.messages || [])
  }, [courseId, token])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadLessons(), loadMessages()]).finally(() => setLoading(false))
    // Reset the composer when switching courses.
    setSelectedTarget(null)
    setMessageType(null)
    setText('')
    setError('')
  }, [courseId, loadLessons, loadMessages])

  const lastLesson = lessons.length ? lessons[lessons.length - 1] : null
  const nextNumber = lessons.length + 1
  const nextBlockedReason = lastLesson
    ? (!lastLesson.is_published
        ? `Make Lesson ${lastLesson.order_num} available first (not published).`
        : lessonNeedsContent(lastLesson)
          ? `Make Lesson ${lastLesson.order_num} available first (content missing).`
          : null)
    : null // no lessons yet at all — nothing blocks slot 1

  const lessonOptions = [
    ...lessons.map(l => {
      const status = lessonStatusLabel(l)
      return {
        value: `existing:${l.id}`,
        label: (
          <span className="flex items-center justify-between gap-3 w-full">
            <span className="truncate">Lesson {l.order_num} · {l.title}</span>
            <span className="text-xs flex-shrink-0" style={{ color: status.color }}>{status.text}</span>
          </span>
        ),
      }
    }),
    {
      value: 'next',
      label: (
        <span className="flex items-center justify-between gap-3 w-full">
          <span>Next Lesson (Lesson {nextNumber})</span>
          {nextBlockedReason && <span className="text-xs flex-shrink-0" style={{ color: '#f59e0b' }}>Locked</span>}
        </span>
      ),
      disabled: !!nextBlockedReason,
      disabledReason: nextBlockedReason || undefined,
    },
  ]

  const typeOptions: { value: 'note' | 'availability'; label: React.ReactNode }[] = [
    { value: 'note', label: 'Note for published lesson' },
    { value: 'availability', label: 'Lesson availability information' },
  ]

  const words = wordCount(text)
  const overLimit = words > MAX_WORDS
  const canSend = !!selectedTarget && !!messageType && text.trim().length > 0 && !overLimit && !sending

  async function handleSend() {
    if (!selectedTarget || !messageType) return
    setSending(true)
    setError('')
    try {
      const target = selectedTarget === 'next'
        ? { pendingLessonNumber: nextNumber }
        : { lessonId: selectedTarget.replace('existing:', '') }

      const res = await fetch('/api/lesson-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId, target, messageType, messageText: text.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')

      setText('')
      setSelectedTarget(null)
      setMessageType(null)
      await loadMessages()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return
    const res = await fetch('/api/lesson-messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, messageText: editText.trim() }),
    })
    if (res.ok) {
      setEditingId(null)
      await loadMessages()
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/lesson-messages?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) await loadMessages()
  }

  if (loading) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4" style={{ color: 'var(--kurso-primary)' }} />
        <h3 className="text-sm font-semibold text-white">Lesson messages</h3>
      </div>
      <p className="text-xs" style={{ color: 'var(--kurso-hint)' }}>
        Send a note students see above an available lesson, or set the availability message shown instead of a lesson that isn&apos;t ready yet.
      </p>

      {/* Composer */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KursoDropdown
            value={selectedTarget}
            onChange={setSelectedTarget}
            options={lessonOptions}
            placeholder="Select lesson"
          />
          <KursoDropdown
            value={messageType}
            onChange={setMessageType}
            options={typeOptions}
            placeholder="Select message type"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Type the message students will see…"
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${overLimit ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}
          />
          <p className="text-xs" style={{ color: overLimit ? '#ef4444' : 'var(--kurso-hint)' }}>
            {words}/{MAX_WORDS} words
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed self-start px-6"
          style={{ background: canSend ? 'var(--kurso-primary)' : 'rgba(var(--kurso-primary-rgb), 0.3)', color: '#fff' }}
        >
          {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          Save message
        </button>
      </div>

      {/* Existing messages */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {messages.map(m => (
            <div key={m.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white">
                  Lesson {m.lesson_number}{m.lesson_title ? ` · ${m.lesson_title}` : ' · not created yet'}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: m.message_type === 'note' ? '#4ade80' : '#f59e0b' }}>
                  {m.message_type === 'note' ? 'Note' : 'Availability info'}
                </span>
              </div>

              {editingId === m.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(m.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--kurso-primary)', color: '#fff' }}>Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm" style={{ color: '#d4d4d8' }}>{m.message_text}</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditingId(m.id); setEditText(m.message_text) }} className="flex items-center gap-1 text-xs" style={{ color: '#a1a1aa' }}>
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 text-xs" style={{ color: '#ef4444' }}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                    {m.message_type === 'availability' && (
                      <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: 'var(--kurso-hint)' }}>
                        <CheckCircle2 className="w-3 h-3" /> Auto-removed once available
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
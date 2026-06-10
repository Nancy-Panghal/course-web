'use client'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  Send, Clock, Users, CheckCircle2, XCircle,
  ChevronDown, Megaphone, AlertCircle, BookOpen,
} from 'lucide-react'

interface Course {
  id: string
  name: string
}

interface Broadcast {
  id: string
  course_id: string | null
  message: string
  sent_at: string
  student_count: number
  delivered_count: number
  failed_count: number
  status: string
}

interface Preview {
  total: number
  withTelegram: number
  noTelegram: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function BroadcastPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('') // '' = all courses
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; delivered: number; failed: number; noTelegram: number } | null>(null)
  const [sendError, setSendError] = useState('')
  const [history, setHistory] = useState<Broadcast[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [token, setToken] = useState('')

  // ── Load session token + courses ──────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('courses')
        .select('id, name')
        .eq('creator_id', user.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      setCourses(data || [])
    }
    init()
  }, [])

  // ── Fetch broadcast history ───────────────────────────────────
  const fetchHistory = useCallback(async (sessionToken: string) => {
    if (!sessionToken) return
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/broadcast', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      const json = await res.json()
      setHistory(json.broadcasts || [])
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) fetchHistory(token)
  }, [token, fetchHistory])

  // ── Fetch preview count whenever course changes ───────────────
  useEffect(() => {
    if (!token) return
    setPreview(null)
    setPreviewLoading(true)
    const params = selectedCourse ? `?courseId=${selectedCourse}` : ''
    fetch(`/api/broadcast/preview${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => setPreview(json))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [selectedCourse, token])

  // ── Send broadcast ────────────────────────────────────────────
  async function handleSend() {
    if (!message.trim() || sending) return
    setSending(true)
    setSendResult(null)
    setSendError('')

    try {
      const body: any = { message: message.trim() }
      if (selectedCourse) body.courseId = selectedCourse

      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) {
        setSendError(json.error || 'Failed to send broadcast')
        return
      }

      setSendResult({
        ok: true,
        delivered: json.delivered,
        failed: json.failed,
        noTelegram: json.noTelegram,
      })
      setMessage('')
      // Refresh history
      await fetchHistory(token)
    } catch (err: any) {
      setSendError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const charCount = message.length
  const overLimit = charCount > 500
  const canSend = message.trim().length > 0 && !overLimit && !sending && !!token

  const selectedCourseName = selectedCourse
    ? courses.find(c => c.id === selectedCourse)?.name || 'Selected course'
    : 'All courses'

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Broadcast</h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            Send a message to your enrolled students via Telegram.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── Compose panel ─────────────────────────────────── */}
          <div className="xl:col-span-3 flex flex-col gap-5">

            {/* Course selector */}
            <div className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <label className="block text-sm font-medium text-white mb-3">Send to</label>
              <div className="relative">
                <select
                  value={selectedCourse}
                  onChange={e => {
                    setSelectedCourse(e.target.value)
                    setSendResult(null)
                    setSendError('')
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl text-sm text-white outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                >
                  <option value="" style={{ background: '#0a0a0a' }}>All enrolled students</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#0a0a0a' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#52525b' }} />
              </div>

              {/* Preview counts */}
              <div className="mt-3 flex flex-wrap gap-3">
                {previewLoading ? (
                  <span className="text-xs" style={{ color: '#52525b' }}>Loading student count…</span>
                ) : preview ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                      <Users className="w-3 h-3" />
                      {preview.total} total students
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                      <Send className="w-3 h-3" />
                      {preview.withTelegram} will receive
                    </span>
                    {preview.noTelegram > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                        <AlertCircle className="w-3 h-3" />
                        {preview.noTelegram} no Telegram
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {/* Message composer */}
            <div className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-white">Message</label>
                <span className="text-xs" style={{ color: overLimit ? '#ef4444' : '#52525b' }}>
                  {charCount}/500
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => {
                  setMessage(e.target.value)
                  setSendResult(null)
                  setSendError('')
                }}
                placeholder={`E.g. New lesson added — check Telegram now!\n\nOr: Live class tomorrow at 7 PM. Join: [link]`}
                rows={6}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${overLimit ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                  lineHeight: '1.6',
                }}
                onFocus={e => {
                  if (!overLimit) e.target.style.borderColor = '#7c3aed'
                }}
                onBlur={e => {
                  if (!overLimit) e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              />
              {overLimit && (
                <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
                  Message is too long. Please keep it under 500 characters.
                </p>
              )}
            </div>

            {/* Send result / error */}
            {sendResult && (
              <div className="rounded-2xl p-4 flex items-start gap-3"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                <div>
                  <p className="text-sm font-semibold text-white">Broadcast sent!</p>
                  <p className="text-xs mt-1" style={{ color: '#86efac' }}>
                    {sendResult.delivered} delivered
                    {sendResult.failed > 0 && ` · ${sendResult.failed} failed (student blocked bot)`}
                    {sendResult.noTelegram > 0 && ` · ${sendResult.noTelegram} skipped (no Telegram)`}
                  </p>
                </div>
              </div>
            )}

            {sendError && (
              <div className="rounded-2xl p-4 flex items-start gap-3"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-sm" style={{ color: '#fca5a5' }}>{sendError}</p>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: canSend ? '#7c3aed' : 'rgba(124,58,237,0.3)', color: '#fff' }}
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {selectedCourseName}
                </>
              )}
            </button>

            {preview && preview.withTelegram === 0 && !previewLoading && (
              <p className="text-xs text-center" style={{ color: '#52525b' }}>
                No students have connected Telegram yet. They will receive messages once they join via the bot.
              </p>
            )}
          </div>

          {/* ── Info + Tips panel ──────────────────────────────── */}
          <div className="xl:col-span-2 flex flex-col gap-5">

            <div className="rounded-2xl p-5" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                <span className="text-sm font-semibold" style={{ color: '#8b5cf6' }}>How it works</span>
              </div>
              <ul className="flex flex-col gap-2.5 text-xs" style={{ color: '#a1a1aa' }}>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}>1</span>
                  Select a course or send to all enrolled students.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}>2</span>
                  Write your message (max 500 characters).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}>3</span>
                  Students receive it directly in Telegram. They cannot forward it.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4" style={{ color: '#52525b' }} />
                <span className="text-sm font-medium text-white">Message ideas</span>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  'New lesson added — check Telegram now!',
                  'Live class tomorrow at 7 PM. Join here: [link]',
                  'Module 2 is now fully uploaded. Happy learning!',
                  'Quick reminder — your course is waiting for you.',
                ].map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setMessage(idea)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#a1a1aa' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(124,58,237,0.1)'
                      e.currentTarget.style.color = '#8b5cf6'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = '#a1a1aa'
                    }}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Broadcast history ──────────────────────────────────── */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Broadcast history</h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl p-12 text-center glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Send className="w-6 h-6" style={{ color: '#8b5cf6' }} />
              </div>
              <p className="text-sm text-white font-medium mb-1">No broadcasts yet</p>
              <p className="text-xs" style={{ color: '#52525b' }}>Your sent messages will appear here.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Header */}
              <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ background: 'rgba(255,255,255,0.03)', color: '#52525b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="col-span-5">Message</div>
                <div className="col-span-2">Course</div>
                <div className="col-span-2">Reached</div>
                <div className="col-span-3">Sent at</div>
              </div>

              {history.map((b, i) => {
                const courseName = b.course_id
                  ? (courses.find(c => c.id === b.course_id)?.name || 'Course')
                  : 'All courses'

                return (
                  <div key={b.id}
                    className="grid grid-cols-12 gap-3 px-5 py-4 items-center"
                    style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    {/* Message preview */}
                    <div className="col-span-5">
                      <p className="text-sm text-white line-clamp-2 leading-relaxed">{b.message}</p>
                    </div>

                    {/* Course */}
                    <div className="col-span-2">
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                        {courseName}
                      </span>
                    </div>

                    {/* Delivered/failed counts */}
                    <div className="col-span-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" style={{ color: '#22c55e' }} />
                        <span className="text-xs text-white">{b.delivered_count}</span>
                      </div>
                      {b.failed_count > 0 && (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-3 h-3" style={{ color: '#ef4444' }} />
                          <span className="text-xs" style={{ color: '#ef4444' }}>{b.failed_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Sent at */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" style={{ color: '#52525b' }} />
                        <span className="text-xs" style={{ color: '#a1a1aa' }}>
                          {formatDate(b.sent_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

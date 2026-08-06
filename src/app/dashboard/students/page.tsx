'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { Users, Search, Phone, BookOpen, Calendar, TrendingUp, RotateCcw } from 'lucide-react'

interface Student {
  id: string
  phone: string
  current_lesson: number
  enrolled_at: string
  course_id: string | null
  payment_status?: string
}

interface Lesson {
  order_num: number
  title: string
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [refundMessage, setRefundMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const [refundModalStudent, setRefundModalStudent] = useState<Student | null>(null)
  const [refundDetails, setRefundDetails] = useState<{ provider: string; netAmount: number; alreadyRefunded: number; refundable: number } | null>(null)
  const [refundDetailsLoading, setRefundDetailsLoading] = useState(false)
  const [refundDetailsError, setRefundDetailsError] = useState('')
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full')
  const [refundAmountInput, setRefundAmountInput] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundSubmitError, setRefundSubmitError] = useState('')

  async function openRefundModal(student: Student) {
    setRefundModalStudent(student)
    setRefundMode('full')
    setRefundAmountInput('')
    setRefundReason('')
    setRefundSubmitError('')
    setRefundDetails(null)
    setRefundDetailsError('')
    setRefundDetailsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setRefundDetailsError('Not signed in.'); return }
      const res = await fetch(`/api/creator/refund?enrollmentId=${student.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      if (!res.ok) { setRefundDetailsError(d.error || 'Could not load refund details.'); return }
      setRefundDetails(d)
    } catch {
      setRefundDetailsError('Network error. Please try again.')
    } finally {
      setRefundDetailsLoading(false)
    }
  }

  function closeRefundModal() {
    setRefundModalStudent(null)
  }

  async function submitRefund() {
    if (!refundModalStudent || !refundDetails) return
    const amount = refundMode === 'full' ? refundDetails.refundable : Number(refundAmountInput)

    if (refundMode === 'partial') {
      if (!Number.isFinite(amount) || amount <= 0) { setRefundSubmitError('Enter a valid amount.'); return }
      if (amount > refundDetails.refundable) { setRefundSubmitError(`Cannot exceed ₹${refundDetails.refundable.toLocaleString('en-IN')}.`); return }
    }

    setRefundSubmitting(true)
    setRefundSubmitError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setRefundSubmitError('Not signed in.'); return }
      const res = await fetch('/api/creator/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          enrollmentId: refundModalStudent.id,
          amount: refundMode === 'full' ? 'full' : amount,
          reason: refundReason || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setRefundSubmitError(d.error || 'Could not process refund.'); return }

      if (d.revokedAccess) {
        setStudents(prev => prev.map(s => s.id === refundModalStudent.id ? { ...s, payment_status: 'refunded' } : s))
      }
      setRefundMessage({ id: refundModalStudent.id, text: d.message, ok: true })
      closeRefundModal()
    } catch {
      setRefundSubmitError('Network error. Please try again.')
    } finally {
      setRefundSubmitting(false)
    }
  }

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: s }, { data: l }] = await Promise.all([
        supabase
          .from('enrollments')
          .select('*')
          .eq('creator_id', user.id)
          .order('enrolled_at', { ascending: false }),
        supabase.from('lessons').select('order_num, title').order('order_num'),
      ])
      setStudents(s || [])
      setLessons(l || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalLessons = lessons.length
  const filtered = students.filter(s => s.phone.includes(search))

  function getProgress(currentLesson: number) {
    if (totalLessons === 0) return 0
    return Math.min(Math.round(((currentLesson - 1) / totalLessons) * 100), 100)
  }

  function getCurrentLessonTitle(currentLesson: number) {
    const lesson = lessons.find(l => l.order_num === currentLesson)
    return lesson ? lesson.title : currentLesson > totalLessons ? 'Completed ✓' : 'Not started'
  }

  function getStatusColor(currentLesson: number) {
    if (currentLesson > totalLessons) return { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', label: 'Completed' }
    if (currentLesson === 1) return { bg: 'rgba(250,204,21,0.1)', color: '#facc15', label: 'Just started' }
    return { bg: 'rgba(139,92,246,0.1)', color: 'var(--kurso-primary-light)', label: 'In progress' }
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Students</h1>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              {students.length} enrolled student{students.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by phone..."
              className="pl-10 pr-4 py-2.5 rounded-xl text-sm text-white outline-none w-64"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
              onFocus={e => e.target.style.borderColor = 'var(--kurso-primary)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: students.length, icon: Users, color: 'var(--kurso-primary-light)' },
            { label: 'Completed', value: students.filter(s => s.current_lesson > totalLessons).length, icon: TrendingUp, color: '#4ade80' },
            { label: 'In Progress', value: students.filter(s => s.current_lesson <= totalLessons && s.current_lesson > 1).length, icon: BookOpen, color: '#3b82f6' },
            { label: 'Just Started', value: students.filter(s => s.current_lesson === 1).length, icon: Calendar, color: '#facc15' },
          ].map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="rounded-2xl p-4 glass"
                style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{color: s.color}} />
                  <span className="text-xs" style={{color:'#a1a1aa'}}>{s.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
              </div>
            )
          })}
        </div>

        {/* Students table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl p-16 text-center glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'rgba(var(--kurso-primary-rgb), 0.1)', border:'1px solid rgba(var(--kurso-primary-rgb), 0.2)'}}>
              <Users className="w-8 h-8" style={{color:'var(--kurso-primary-light)'}} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No students yet</h3>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              Students appear here after they enroll and pay for your course.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{background:'rgba(255,255,255,0.03)', color:'#52525b', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="col-span-3">Phone</div>
              <div className="col-span-2">Current Lesson</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Enrolled</div>
              <div className="col-span-2">Refund</div>
            </div>

            {/* Table rows */}
            {filtered.map((student, i) => {
              const progress = getProgress(student.current_lesson)
              const status = getStatusColor(student.current_lesson)
              return (
                <div key={student.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-all"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Phone */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{background:'rgba(var(--kurso-primary-rgb), 0.1)'}}>
                      <Phone className="w-3.5 h-3.5" style={{color:'var(--kurso-primary-light)'}} />
                    </div>
                    <span className="text-sm text-white font-mono">+{student.phone}</span>
                  </div>

                  {/* Current lesson */}
                  <div className="col-span-2">
                    <p className="text-sm text-white truncate">{getCurrentLessonTitle(student.current_lesson)}</p>
                    <p className="text-xs mt-0.5" style={{color:'#52525b'}}>Lesson {student.current_lesson} of {totalLessons}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                        <div className="h-1.5 rounded-full transition-all"
                          style={{width:`${progress}%`, background:'var(--kurso-primary-light)'}} />
                      </div>
                      <span className="text-xs flex-shrink-0" style={{color:'#a1a1aa'}}>{progress}%</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{background: status.bg, color: status.color}}>
                      {status.label}
                    </span>
                  </div>

                  {/* Enrolled date */}
                  <div className="col-span-1">
                    <span className="text-xs" style={{color:'#52525b'}}>
                      {new Date(student.enrolled_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* Refund */}
                  <div className="col-span-2">
                    {student.payment_status === 'refunded' ? (
                      <span className="text-xs" style={{ color: '#52525b' }}>Refunded</span>
                    ) : (
                      <>
                        <button
                          onClick={() => openRefundModal(student)}
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                          style={{
                            background: 'rgba(248,113,113,0.08)',
                            color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.2)',
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Refund
                        </button>
                        {refundMessage?.id === student.id && (
                          <p className="text-[10px] mt-1" style={{ color: refundMessage.ok ? '#4ade80' : '#fca5a5' }}>
                            {refundMessage.text}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {refundModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#0a0a0a', border: '1px solid rgba(248,113,113,0.25)' }}>
            <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h3 className="font-semibold text-white">Refund student</h3>
              <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>Phone: {refundModalStudent.phone}</p>
            </div>

            <div className="p-5">
              {refundDetailsLoading ? (
                <p className="text-sm text-center py-6" style={{ color: '#52525b' }}>Loading payment details...</p>
              ) : refundDetailsError ? (
                <p className="text-sm" style={{ color: '#f87171' }}>{refundDetailsError}</p>
              ) : refundDetails ? (
                <>
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: '#71717a' }}>Paid via</span>
                      <span className="text-white capitalize">{refundDetails.provider}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: '#71717a' }}>Total paid</span>
                      <span className="text-white">₹{refundDetails.netAmount.toLocaleString('en-IN')}</span>
                    </div>
                    {refundDetails.alreadyRefunded > 0 && (
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#71717a' }}>Already refunded</span>
                        <span style={{ color: '#f87171' }}>₹{refundDetails.alreadyRefunded.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-semibold pt-1 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#a1a1aa' }}>Available to refund</span>
                      <span className="text-white">₹{refundDetails.refundable.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {refundDetails.refundable <= 0 ? (
                    <p className="text-sm text-center py-2" style={{ color: '#52525b' }}>Nothing left to refund on this payment.</p>
                  ) : (
                    <>
                      <div className="flex rounded-xl p-1 mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {(['full', 'partial'] as const).map(m => (
                          <button key={m} onClick={() => setRefundMode(m)}
                            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: refundMode === m ? 'rgba(248,113,113,0.18)' : 'transparent',
                              color: refundMode === m ? '#fff' : '#a1a1aa',
                            }}>
                            {m === 'full' ? `Full — ₹${refundDetails.refundable.toLocaleString('en-IN')}` : 'Partial amount'}
                          </button>
                        ))}
                      </div>

                      {refundMode === 'partial' && (
                        <div className="mb-4">
                          <label className="text-xs mb-1.5 block" style={{ color: '#a1a1aa' }}>
                            Amount to refund — e.g. if the student watched some lessons and you don't want to refund in full
                          </label>
                          <input type="number" min={1} max={refundDetails.refundable} value={refundAmountInput}
                            onChange={e => setRefundAmountInput(e.target.value)}
                            placeholder={`Up to ₹${refundDetails.refundable.toLocaleString('en-IN')}`}
                            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                      )}

                      <div className="mb-4">
                        <label className="text-xs mb-1.5 block" style={{ color: '#a1a1aa' }}>Reason (optional, kept for your records)</label>
                        <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={2}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      </div>

                      <div className="mb-4 p-3 rounded-xl flex items-start gap-2"
                        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                        <RotateCcw className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                        <p className="text-xs" style={{ color: '#a1a1aa' }}>
                          Any refund — full or partial — ends this student's access to the course. A partial refund
                          just means you're giving back less than the full amount, e.g. because they'd already
                          watched some lessons.
                        </p>
                      </div>

                      {refundSubmitError && (
                        <p className="text-xs mb-3" style={{ color: '#f87171' }}>{refundSubmitError}</p>
                      )}

                      <div className="flex gap-2">
                        <button onClick={closeRefundModal}
                          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                          Cancel
                        </button>
                        <button onClick={submitRefund} disabled={refundSubmitting}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                          style={{ background: '#dc2626' }}>
                          {refundSubmitting ? 'Processing...' : 'Issue refund'}
                        </button>
                      </div>
                      <p className="text-[10px] text-center mt-3" style={{ color: '#3f3f46' }}>
                        This calls your {refundDetails.provider} account directly — the money moves immediately and cannot be undone from here.
                      </p>
                    </>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Clock, BookOpen, AlertCircle, Send } from 'lucide-react'

interface Assignment {
  id: string
  lesson_id: string
  course_id: string
  student_id: string | null
  enrollment_id: string
  submission_text: string | null
  submission_url: string | null
  submitted_at: string
  creator_feedback: string | null
  score: number | null
  reviewed_at: string | null
  status: 'pending' | 'reviewed'
  lessons: { title: string; order_num: number } | null
  enrollments: { phone: string } | null
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [score, setScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)
      await fetchAssignments(session.access_token, 'pending')
    }
    load()
  }, [])

  async function fetchAssignments(tok: string, status: string) {
    setLoading(true)
    try {
      const url = status === 'all'
        ? '/api/assignments'
        : `/api/assignments?status=${status}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const json = await res.json()
      setAssignments(json.assignments || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }

  async function changeFilter(f: 'all' | 'pending' | 'reviewed') {
    setFilter(f)
    await fetchAssignments(token, f)
  }

  async function submitReview(assignmentId: string) {
    if (!feedback.trim()) { setError('Feedback is required'); return }
    const scoreNum = score ? parseInt(score) : undefined
    if (scoreNum !== undefined && (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10)) {
      setError('Score must be between 1 and 10')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ feedback: feedback.trim(), score: scoreNum }),
      })
      if (res.ok) {
        setReviewingId(null)
        setFeedback('')
        setScore('')
        await fetchAssignments(token, filter)
      } else {
        const json = await res.json()
        setError(json.error || 'Failed to submit review')
      }
    } catch { setError('Network error') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Assignments</h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            Review student submissions and provide feedback.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['pending', 'reviewed', 'all'] as const).map(f => (
            <button key={f} onClick={() => changeFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={{
                background: filter === f ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: filter === f ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filter === f ? '#8b5cf6' : '#a1a1aa',
              }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl p-16 text-center glass"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#3f3f46' }} />
            <p className="text-sm font-medium text-white mb-1">No assignments here</p>
            <p className="text-xs" style={{ color: '#52525b' }}>
              {filter === 'pending' ? 'No pending submissions.' : 'Nothing to show.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {assignments.map(a => (
              <div key={a.id} className="rounded-2xl p-5 glass"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={a.status === 'pending'
                          ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
                          : { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                        {a.status === 'pending' ? '⏳ Pending' : '✅ Reviewed'}
                      </span>
                      <span className="text-xs" style={{ color: '#52525b' }}>
                        Lesson {a.lessons?.order_num}: {a.lessons?.title}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      +{a.enrollments?.phone || 'Student'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#71717a' }}>
                      Submitted {new Date(a.submitted_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {a.status === 'pending' && reviewingId !== a.id && (
                    <button
                      onClick={() => { setReviewingId(a.id); setFeedback(''); setScore(''); setError('') }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90">
                      <Send className="w-3.5 h-3.5" /> Review
                    </button>
                  )}
                </div>

                {/* Submission content */}
                {a.submission_text && (
                  <div style={{
                    padding: 12, borderRadius: 10, marginBottom: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#71717a' }}>Student submission:</p>
                    <p className="text-sm" style={{ color: '#e4e4e7', lineHeight: 1.6 }}>{a.submission_text}</p>
                  </div>
                )}

                {/* Existing review */}
                {a.status === 'reviewed' && a.creator_feedback && (
                  <div style={{
                    padding: 12, borderRadius: 10,
                    background: 'rgba(124,58,237,0.06)',
                    border: '1px solid rgba(124,58,237,0.2)',
                  }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#a78bfa' }}>Your feedback:</p>
                    <p className="text-sm" style={{ color: '#e4e4e7' }}>{a.creator_feedback}</p>
                    {a.score !== null && a.score !== undefined && (
                      <p className="text-xs font-bold mt-2" style={{ color: '#a78bfa' }}>Score: {a.score}/10</p>
                    )}
                  </div>
                )}

                {/* Review form */}
                {reviewingId === a.id && (
                  <div style={{
                    marginTop: 12, padding: 14, borderRadius: 12,
                    background: 'rgba(124,58,237,0.06)',
                    border: '1px solid rgba(124,58,237,0.2)',
                  }}>
                    <p className="text-sm font-semibold text-white mb-3">Write feedback</p>
                    <textarea
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      placeholder="Provide detailed feedback to the student…"
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none mb-3"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <input
                          type="number" min="1" max="10"
                          value={score}
                          onChange={e => setScore(e.target.value)}
                          placeholder="Score (1-10, optional)"
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                    </div>
                    {error && (
                      <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{error}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setReviewingId(null); setError('') }}
                        className="px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => submitReview(a.id)}
                        disabled={submitting || !feedback.trim()}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
                        {submitting ? 'Submitting…' : 'Submit Review'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
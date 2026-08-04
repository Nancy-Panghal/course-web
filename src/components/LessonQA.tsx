'use client'
import { useEffect, useState } from 'react'
import { MessageCircle, ThumbsUp, Flag, CornerDownRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCommentTime } from '@/lib/formatCommentTime'

const MAX_WORDS = 300

interface QaComment {
  id: string
  body: string
  isCreatorReply: boolean
  status: string
  createdAt: string
  likeCount: number
  likedByMe: boolean
  mine: boolean
  replies: QaComment[]
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function LessonQA({
  lessonId,
  enrollmentId,
}: {
  lessonId: string
  enrollmentId?: string | null
}) {
  const [token, setToken] = useState<string | null>(null)
  const [qaEnabled, setQaEnabled] = useState(true)
  const [comments, setComments] = useState<QaComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null)
    })
  }, [])

  async function fetchComments() {
    setLoading(true)
    const params = new URLSearchParams({ lessonId })
    if (enrollmentId) params.set('enrollmentId', enrollmentId)
    const res = await fetch(`/api/qa/comments?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const json = await res.json()
      setQaEnabled(json.qaEnabled !== false)
      setComments(json.comments || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    // Wait for the token lookup (even if it resolves to null) before the
    // first fetch, so a logged-in viewer isn't briefly treated as anonymous.
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, enrollmentId, token])

  async function submit(body: string, parentCommentId?: string) {
    if (!body.trim()) return
    if (wordCount(body) > MAX_WORDS) {
      setError(`Comments are limited to ${MAX_WORDS} words.`)
      return
    }
    setPosting(true)
    setError('')
    try {
      const res = await fetch('/api/qa/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lessonId, body: body.trim(), parentCommentId, enrollmentId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not post your comment.')
        return
      }
      setNewBody('')
      setReplyBody('')
      setReplyingTo(null)
      await fetchComments()
    } finally {
      setPosting(false)
    }
  }

  async function toggleLike(id: string) {
    const res = await fetch(`/api/qa/comments/${id}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ enrollmentId }),
    })
    if (res.ok) await fetchComments()
  }

  async function report(id: string) {
    if (!confirm('Report this comment to the creator for review?')) return
    const res = await fetch(`/api/qa/comments/${id}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ enrollmentId }),
    })
    if (res.ok) await fetchComments()
  }

  function CommentCard({ c, isReply }: { c: QaComment; isReply: boolean }) {
    const pending = c.status === 'pending_review' && c.mine
    return (
      <div className={isReply ? 'ml-8 mt-3' : ''}>
        <div className="rounded-xl p-4" style={{
          background: c.isCreatorReply ? 'rgba(var(--kurso-primary-rgb), 0.08)' : 'rgba(255,255,255,0.03)',
          border: c.isCreatorReply ? '1px solid rgba(var(--kurso-primary-rgb), 0.25)' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {c.isCreatorReply && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: 'var(--kurso-primary)', color: '#fff' }}>
                Creator
              </span>
            )}
            <span className="text-xs" style={{ color: '#71717a' }}>{formatCommentTime(c.createdAt)}</span>
            {pending && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                Awaiting review
              </span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap" style={{ color: '#e4e4e7' }}>{c.body}</p>
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => toggleLike(c.id)}
              className="inline-flex items-center gap-1.5 text-xs"
              style={{ color: c.likedByMe ? 'var(--kurso-primary-light)' : '#71717a' }}>
              <ThumbsUp className="w-3.5 h-3.5" fill={c.likedByMe ? 'currentColor' : 'none'} />
              {c.likeCount > 0 ? c.likeCount : ''}
            </button>
            {!isReply && (
              <button onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
                <CornerDownRight className="w-3.5 h-3.5" /> Reply
              </button>
            )}
            {!c.mine && (
              <button onClick={() => report(c.id)}
                className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
                <Flag className="w-3.5 h-3.5" /> Report
              </button>
            )}
          </div>
        </div>

        {replyingTo === c.id && (
          <div className="ml-8 mt-2 flex flex-col gap-2">
            <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
              rows={2} placeholder="Write a reply…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
            <div className="flex items-center gap-2">
              <button onClick={() => submit(replyBody, c.id)} disabled={posting || !replyBody.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))' }}>
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post reply'}
              </button>
              <button onClick={() => { setReplyingTo(null); setReplyBody('') }}
                className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#71717a' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {c.replies?.map(r => <CommentCard key={r.id} c={r} isReply />)}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#52525b' }} />
      </div>
    )
  }

  if (!qaEnabled) {
    return (
      <div className="p-6 rounded-xl border border-white/10 bg-white/[0.03] text-center text-sm" style={{ color: '#71717a' }}>
        Q&amp;A is closed for this lesson.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)' }} />
        <h2 className="text-sm font-semibold text-white">Questions &amp; Discussion</h2>
      </div>

      <div className="flex flex-col gap-2">
        <textarea value={newBody} onChange={e => setNewBody(e.target.value)}
          rows={3} placeholder="Ask a question about this lesson…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: wordCount(newBody) > MAX_WORDS ? '#ef4444' : '#52525b' }}>
            {wordCount(newBody)}/{MAX_WORDS} words
          </span>
          <button onClick={() => submit(newBody)} disabled={posting || !newBody.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))' }}>
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        </div>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: '#52525b' }}>
          No questions yet — be the first to ask.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map(c => <CommentCard key={c.id} c={c} isReply={false} />)}
        </div>
      )}
    </div>
  )
}
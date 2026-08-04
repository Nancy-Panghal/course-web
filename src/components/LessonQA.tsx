'use client'
import { useEffect, useState } from 'react'
import { MessageCircle, ThumbsUp, Flag, CornerDownRight, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCommentTime } from '@/lib/formatCommentTime'

const MAX_WORDS = 300
const PANEL_WIDTH = 400 // px, desktop — see .kurso-qa-panel media query for mobile

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

// Moved OUT of LessonQA on purpose — defining this inside the parent
// component meant it was recreated as a brand-new function on every
// render, so React tore down and rebuilt the whole comment tree (incl.
// the reply <textarea>, losing focus) on every keystroke. Keeping it as
// its own top-level component fixes that.
function CommentCard({
  c,
  isReply,
  replyingTo,
  replyBody,
  posting,
  onSetReplyBody,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onToggleLike,
  onReport,
}: {
  c: QaComment
  isReply: boolean
  replyingTo: string | null
  replyBody: string
  posting: boolean
  onSetReplyBody: (v: string) => void
  onStartReply: (id: string | null) => void
  onCancelReply: () => void
  onSubmitReply: (parentId: string) => void
  onToggleLike: (id: string) => void
  onReport: (id: string) => void
}) {
  const pending = c.status === 'pending_review' && c.mine

  return (
    <div className={isReply ? 'ml-6 mt-3' : ''}>
      <div className="rounded-xl p-3.5" style={{
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
        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: '#e4e4e7' }}>{c.body}</p>
        <div className="flex items-center gap-4 mt-2">
          <button onClick={() => onToggleLike(c.id)}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: c.likedByMe ? 'var(--kurso-primary-light)' : '#71717a' }}>
            <ThumbsUp className="w-3.5 h-3.5" fill={c.likedByMe ? 'currentColor' : 'none'} />
            {c.likeCount > 0 ? c.likeCount : ''}
          </button>
          {!isReply && (
            <button onClick={() => onStartReply(replyingTo === c.id ? null : c.id)}
              className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
              <CornerDownRight className="w-3.5 h-3.5" /> Reply
            </button>
          )}
          {!c.mine && (
            <button onClick={() => onReport(c.id)}
              className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
              <Flag className="w-3.5 h-3.5" /> Report
            </button>
          )}
        </div>
      </div>

      {replyingTo === c.id && (
        <div className="ml-6 mt-2 flex flex-col gap-2">
          <textarea value={replyBody} onChange={e => onSetReplyBody(e.target.value)}
            rows={2} placeholder="Write a reply…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
          <div className="flex items-center gap-2">
            <button onClick={() => onSubmitReply(c.id)} disabled={posting || !replyBody.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))' }}>
              {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post reply'}
            </button>
            <button onClick={onCancelReply}
              className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#71717a' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {c.replies?.map(r => (
        <CommentCard
          key={r.id}
          c={r}
          isReply
          replyingTo={replyingTo}
          replyBody={replyBody}
          posting={posting}
          onSetReplyBody={onSetReplyBody}
          onStartReply={onStartReply}
          onCancelReply={onCancelReply}
          onSubmitReply={onSubmitReply}
          onToggleLike={onToggleLike}
          onReport={onReport}
        />
      ))}
    </div>
  )
}

export default function LessonQA({
  lessonId,
  enrollmentId,
  defaultOpen = false,
}: {
  lessonId: string
  enrollmentId?: string | null
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
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
    // Only fetch once the panel has actually been opened, so a page with
    // many lessons isn't firing a Q&A fetch for every lesson on load.
    if (open) fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, enrollmentId, token, open])

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

  return (
    <>
      <style>{`
        .kurso-qa-tab {
          position: fixed;
          top: 96px;
          bottom: 24px;
          width: 40px;
          right: 0;
          z-index: 41;
          border-radius: 12px 0 0 12px;
          background: linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary));
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          transition: right 0.3s ease;
          box-shadow: -2px 0 12px rgba(0,0,0,0.35);
        }
        .kurso-qa-tab.open { right: ${PANEL_WIDTH}px; }
        .kurso-qa-tab span {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .kurso-qa-panel {
          position: fixed;
          top: 0;
          bottom: 0;
          right: 0;
          width: ${PANEL_WIDTH}px;
          max-width: 100vw;
          background: #0a0a0a;
          border-left: 1px solid rgba(255,255,255,0.08);
          z-index: 42;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .kurso-qa-panel.open { transform: translateX(0); }
        .kurso-qa-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 40;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .kurso-qa-backdrop.open { opacity: 1; pointer-events: auto; }
        @media (max-width: 640px) {
          .kurso-qa-panel { width: 92vw; }
          .kurso-qa-tab.open { right: 92vw; }
          .kurso-qa-tab { top: 72px; bottom: 16px; width: 34px; }
        }
      `}</style>

      <button
        className={`kurso-qa-tab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close Q&A' : 'Open Q&A'}
      >
        <span>💬 Q&amp;A</span>
      </button>

      <div className={`kurso-qa-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className={`kurso-qa-panel ${open ? 'open' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)' }} />
            <h2 className="text-sm font-semibold text-white">Questions &amp; Discussion</h2>
          </div>
          <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {!qaEnabled ? (
          <div className="p-6 text-center text-sm" style={{ color: '#71717a' }}>
            Q&amp;A is closed for this lesson.
          </div>
        ) : (
          <>
            <div className="px-4 pt-3 pb-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <textarea value={newBody} onChange={e => setNewBody(e.target.value)}
                rows={3} placeholder="Ask a question about this lesson…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: wordCount(newBody) > MAX_WORDS ? '#ef4444' : '#52525b' }}>
                  {wordCount(newBody)}/{MAX_WORDS} words
                </span>
                <button onClick={() => submit(newBody)} disabled={posting || !newBody.trim()}
                  className="px-4 py-1.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))' }}>
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
                </button>
              </div>
              {error && <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#52525b' }} />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#52525b' }}>
                  No questions yet — be the first to ask.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comments.map(c => (
                    <CommentCard
                      key={c.id}
                      c={c}
                      isReply={false}
                      replyingTo={replyingTo}
                      replyBody={replyBody}
                      posting={posting}
                      onSetReplyBody={setReplyBody}
                      onStartReply={setReplyingTo}
                      onCancelReply={() => { setReplyingTo(null); setReplyBody('') }}
                      onSubmitReply={(parentId) => submit(replyBody, parentId)}
                      onToggleLike={toggleLike}
                      onReport={report}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
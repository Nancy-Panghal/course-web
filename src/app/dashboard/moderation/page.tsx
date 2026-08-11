'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { formatCommentTime } from '@/lib/formatCommentTime'

interface PendingComment {
  id: string
  body: string
  flagReason: string | null
  createdAt: string
  isReply: boolean
  lessonTitle: string
  courseName: string
}

export default function ModerationPage() {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState<PendingComment[]>([])
  const [loading, setLoading] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); return }
      setToken(session.access_token)
      const res = await fetch('/api/creator/qa/pending', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const d = await res.json()
        setPending(d.pending || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function decide(id: string, action: 'approve' | 'reject') {
    setDecidingId(id)
    try {
      const res = await fetch(`/api/creator/qa/${id}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setPending(prev => prev.filter(c => c.id !== id))
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'Could not update this comment.')
      }
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#050505' }}>
      <Sidebar />
      <main className="flex-1 p-8 pt-20 md:pt-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-1">Q&amp;A Moderation</h1>
        <p className="text-sm mb-8" style={{ color: '#a1a1aa' }}>
          Comments held here were flagged by the automated check or reported by a student. Approve to publish them, or reject to keep them hidden — nothing is deleted, so you can always look back.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-2xl p-12 text-center glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium text-white mb-1">Nothing to review</p>
            <p className="text-xs" style={{ color: '#52525b' }}>Flagged or reported comments will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(c => (
              <div key={c.id} className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-medium" style={{ color: '#a1a1aa' }}>
                    {c.courseName} · {c.lessonTitle} {c.isReply ? '· reply' : ''}
                  </span>
                  <span className="text-xs" style={{ color: '#52525b' }}>{formatCommentTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-white mb-2 whitespace-pre-wrap">{c.body}</p>
                {c.flagReason && (
                  <p className="text-xs mb-3" style={{ color: '#f59e0b' }}>⚠ {c.flagReason}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(c.id, 'approve')}
                    disabled={decidingId === c.id}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                    Approve
                  </button>
                  <button
                    onClick={() => decide(c.id, 'reject')}
                    disabled={decidingId === c.id}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
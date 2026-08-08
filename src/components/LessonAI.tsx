'use client'
import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MAX_WORDS = 500
const PANEL_WIDTH = 400
const TOTAL_QUESTIONS = 10
const TRUNCATE_AT = 280 // characters — beyond this, show a "Show more" toggle inline

interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  text: string
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function storageKey(lessonId: string) {
  return `kurso-ai-chat-${lessonId}`
}

function AnswerBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > TRUNCATE_AT
  const shown = expanded || !isLong ? text : text.slice(0, TRUNCATE_AT) + '…'
  return (
    <div>
      <span>{shown}</span>
      {isLong && (
        <button onClick={() => setExpanded(e => !e)}
          className="block mt-1 text-xs font-semibold underline"
          style={{ color: 'var(--kurso-primary-light)' }}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function LessonAI({
  lessonId,
  enrollmentId,
}: {
  lessonId: string
  enrollmentId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null)
    })
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Chat history lives only in this browser tab's sessionStorage — never
  // sent to or stored in our DB. sessionStorage clears itself the moment
  // the tab/browser closes, so there's nothing to clean up on our end.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey(lessonId))
      setMessages(saved ? JSON.parse(saved) : [])
    } catch {
      setMessages([])
    }
    setRemaining(null)
  }, [lessonId])

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(lessonId), JSON.stringify(messages))
    } catch {
      // sessionStorage unavailable (private browsing edge cases) — chat still works, just won't persist across a reload.
    }
  }, [messages, lessonId])

  async function ask() {
    const question = input.trim()
    if (!question) return
    if (wordCount(question) > MAX_WORDS) {
      setMessages(m => [...m, { role: 'error', text: `Keep questions under ${MAX_WORDS} words.` }])
      return
    }
    if (remaining !== null && remaining <= 0) return

    setMessages(m => [...m, { role: 'user', text: question }])
    setInput('')
    setAsking(true)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lessonId, question, enrollmentId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessages(m => [...m, { role: 'error', text: json.error || 'Could not get an answer.' }])
        if (res.status === 429) setRemaining(0)
        return
      }
      setMessages(m => [...m, { role: 'assistant', text: json.answer }])
      if (typeof json.remaining === 'number') setRemaining(json.remaining)
    } catch {
      setMessages(m => [...m, { role: 'error', text: 'Network error — try again.' }])
    } finally {
      setAsking(false)
    }
  }

  const quotaReached = remaining !== null && remaining <= 0

  return (
    <>
      <style>{`
        .kurso-ai-tab {
          position: fixed;
          top: 96px;
          bottom: 24px;
          width: 40px;
          left: 0;
          z-index: 41;
          border-radius: 0 12px 12px 0;
          background: linear-gradient(135deg,var(--kurso-secondary),var(--kurso-primary));
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          transition: left 0.3s ease;
          box-shadow: 2px 0 12px rgba(0,0,0,0.35);
        }
        .kurso-ai-tab.open { left: ${PANEL_WIDTH}px; }
        .kurso-ai-tab span {
          writing-mode: vertical-rl;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .kurso-ai-panel {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          width: ${PANEL_WIDTH}px;
          max-width: 100vw;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.08);
          z-index: 42;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .kurso-ai-panel.open { transform: translateX(0); }
        .kurso-ai-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 40;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .kurso-ai-backdrop.open { opacity: 1; pointer-events: auto; }
        @media (max-width: 640px) {
          .kurso-ai-panel { width: 92vw; }
          .kurso-ai-tab.open { left: 92vw; }
          .kurso-ai-tab { top: 72px; bottom: 16px; width: 34px; }
        }
      `}</style>

      <button
        className={`kurso-ai-tab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close AI Doubt Assistant' : 'Ask AI'}
      >
        <span>✨ Ask AI</span>
      </button>

      <div className={`kurso-ai-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className={`kurso-ai-panel ${open ? 'open' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)' }} />
            <h2 className="text-sm font-semibold text-white">AI Doubt Assistant</h2>
          </div>
          <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#52525b' }}>
              Ask a quick doubt — you get {TOTAL_QUESTIONS} questions per lesson.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'ml-8' : 'mr-8'}>
                  <div className="rounded-xl p-3 text-sm" style={{
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))'
                      : m.role === 'error'
                        ? 'rgba(239,68,68,0.08)'
                        : 'rgba(255,255,255,0.05)',
                    color: m.role === 'user' ? '#fff' : m.role === 'error' ? '#ef4444' : '#e4e4e7',
                    border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  }}>
                    {m.role === 'assistant' ? <AnswerBubble text={m.text} /> : m.text}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="mr-8">
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#71717a' }} />
                    <span className="text-xs" style={{ color: '#71717a' }}>Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-3 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {quotaReached ? (
            <p className="text-xs text-center" style={{ color: '#71717a' }}>
              You've reached the {TOTAL_QUESTIONS}-question limit for this lesson. Ask in Q&amp;A instead.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
                  rows={2} placeholder="Ask a quick doubt — a term, a concept, anything you're stuck on…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
                <button onClick={ask} disabled={asking || !input.trim()}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))' }}>
                  {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {remaining !== null && (
                <p className="text-xs mt-1.5" style={{ color: '#52525b' }}>{remaining} question{remaining === 1 ? '' : 's'} left for this lesson</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
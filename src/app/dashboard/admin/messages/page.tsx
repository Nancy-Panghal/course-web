'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  source: 'contact' | 'feedback'
  name: string | null
  email: string
  label: string
  message: string
  createdAt: string
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'contact' | 'feedback'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); setAuthorized(false); return }

      const res = await fetch('/api/admin/messages', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 401) { setAuthorized(false); setLoading(false); return }
      const d = await res.json()
      if (!res.ok) {
        setError(d.error || 'Could not load messages.')
      } else {
        setMessages(d.messages || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter((m) => {
      if (filter !== 'all' && m.source !== filter) return false
      if (!q) return true
      return (
        m.message.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q)
      )
    })
  }, [messages, filter, search])

  const contactCount = messages.filter((m) => m.source === 'contact').length
  const feedbackCount = messages.filter((m) => m.source === 'feedback').length

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--kurso-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a1a1aa' }}>Not authorized.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: 32 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Messages</h1>
        <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 20 }}>
          Every message sent through the /contact and /feedback forms, newest first — read directly from the database.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all', label: `All (${messages.length})` },
            { key: 'contact', label: `Contact (${contactCount})` },
            { key: 'feedback', label: `Feedback (${feedbackCount})` },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === tab.key ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: filter === tab.key ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filter === tab.key ? '#c4b5fd' : '#a1a1aa',
              }}>
              {tab.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or message..."
            style={{
              flex: 1, minWidth: 200, padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#fff',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none',
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: '#71717a', fontSize: 13 }}>No messages match.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((m) => (
              <div key={`${m.source}-${m.id}`}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                      padding: '3px 8px', borderRadius: 999,
                      background: m.source === 'contact' ? 'rgba(139,92,246,0.15)' : 'rgba(74,222,128,0.12)',
                      color: m.source === 'contact' ? '#c4b5fd' : '#4ade80',
                    }}>
                      {m.source}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap' }}>
                    {new Date(m.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
                  </span>
                </div>

                <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
                  {m.name ? <span style={{ color: '#e4e4e7' }}>{m.name}</span> : null}
                  {m.name ? ' · ' : ''}
                  <a href={`mailto:${m.email}`} style={{ color: 'var(--kurso-primary-light)' }}>{m.email}</a>
                </p>

                <p style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {m.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
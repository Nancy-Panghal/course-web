'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminSubscriptionExtensionsPage() {
  const [token, setToken] = useState('')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); setAuthorized(false); return }
      setToken(session.access_token)
      const res = await fetch('/api/admin/subscription-extension-requests', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 401) { setAuthorized(false); setLoading(false); return }
      if (res.ok) {
        const d = await res.json()
        setRequests(d.requests || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function decide(requestId: string, decision: 'approved' | 'rejected') {
    setDecidingId(requestId)
    try {
      const res = await fetch('/api/admin/subscription-extension-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, decision, note: notes[requestId] || '' }),
      })
      const json = await res.json()
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r))
      } else {
        alert(json.error || 'Could not update this request.')
      }
    } finally {
      setDecidingId(null)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--kurso-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  }

  if (!authorized) {
    return <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#a1a1aa' }}>Not authorized.</p>
    </div>
  }

  const pending = requests.filter(r => r.status === 'pending')
  const past = requests.filter(r => r.status !== 'pending')

  const dayLabel = (d: number) => d === 30 ? '1 month' : d === 15 ? '15 days' : d === 7 ? '1 week' : `${d} days`

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: 32 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Subscription Extension Requests</h1>
        <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 28 }}>
          Approving extends the creator's current_period_end by the requested duration and keeps their course live. Nothing is charged.
        </p>

        {pending.length === 0 ? (
          <p style={{ color: '#52525b', fontSize: 13 }}>No pending requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {pending.map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {r.creators?.name || r.creators?.email || 'Creator'} — requesting {dayLabel(r.requested_days)}
                </p>
                {r.reason && <p style={{ color: '#71717a', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>&quot;{r.reason}&quot;</p>}
                <input
                  placeholder="Optional note"
                  value={notes[r.id] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => decide(r.id, 'approved')} disabled={decidingId === r.id}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                    Approve
                  </button>
                  <button onClick={() => decide(r.id, 'rejected')} disabled={decidingId === r.id}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 style={{ color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {past.map(r => (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#a1a1aa', fontSize: 12 }}>
                    {r.creators?.name || r.creators?.email || 'Creator'} — {dayLabel(r.requested_days)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.status === 'approved' ? '#4ade80' : '#f87171' }}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

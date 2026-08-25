'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminSubscriptionRefundsPage() {
  const [token, setToken] = useState('')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); setAuthorized(false); return }
      setToken(session.access_token)
      const res = await fetch('/api/admin/subscription-refund-requests', {
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

  async function decide(requestId: string, decision: 'approved' | 'denied') {
    setDecidingId(requestId)
    setErrors(prev => ({ ...prev, [requestId]: '' }))
    try {
      const amountEntered = amounts[requestId]
      const res = await fetch('/api/admin/subscription-refund-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requestId, decision, note: notes[requestId] || '',
          amount: decision === 'approved' && amountEntered ? Number(amountEntered) : undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision === 'approved' ? 'completed' : 'denied' } : r))
      } else {
        // Cashfree errors — e.g. insufficient settled balance in Kurso's
        // account — need to be visible right here, not lost in an alert.
        setErrors(prev => ({ ...prev, [requestId]: json.error || 'Could not process this refund.' }))
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

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: 32 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Subscription Refund Requests</h1>
        <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 28 }}>
          Approving sends the refund through Kurso's Cashfree account automatically — no manual transfer needed. Leave the amount blank for a full refund, or enter a smaller amount (e.g. for a creator who's used the platform heavily and a full refund would be a loss).
        </p>

        {pending.length === 0 ? (
          <p style={{ color: '#52525b', fontSize: 13 }}>No pending requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {pending.map(r => (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.creators?.name || r.creators?.email || 'Creator'}</p>
                {r.reason && <p style={{ color: '#71717a', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>&quot;{r.reason}&quot;</p>}
                {!r.canAutoRefund && (
                  <p style={{ color: '#facc15', fontSize: 11, marginBottom: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
                    This payment predates automatic refund tracking — approving will fail. Refund manually from the Cashfree dashboard instead, then deny this request once done.
                  </p>
                )}
                <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>
                  Refund amount (₹){r.refundableAmount != null ? ` — leave blank for the full ₹${Number(r.refundableAmount).toLocaleString('en-IN')}` : ''}
                </label>
                <input
                  type="number"
                  placeholder={r.refundableAmount != null ? `Full amount: ${Number(r.refundableAmount).toLocaleString('en-IN')}` : 'Amount'}
                  value={amounts[r.id] || ''}
                  onChange={e => setAmounts(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <input
                  placeholder="Optional note"
                  value={notes[r.id] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {errors[r.id] && (
                  <p style={{ color: '#f87171', fontSize: 11, marginBottom: 10, padding: '6px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    {errors[r.id]}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => decide(r.id, 'approved')} disabled={decidingId === r.id}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                    {decidingId === r.id ? 'Processing…' : 'Approve & Refund'}
                  </button>
                  <button onClick={() => decide(r.id, 'denied')} disabled={decidingId === r.id}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Past requests</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {past.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 8, fontSize: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#a1a1aa' }}>{r.creators?.name || r.creators?.email}</span>
                  <span style={{ color: r.status === 'completed' ? '#4ade80' : '#ef4444' }}>{r.status === 'completed' ? 'Refunded' : 'Denied'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminRevenueSharePage() {
  const [token, setToken] = useState('')
  const [agreements, setAgreements] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [waiverRequests, setWaiverRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); setAuthorized(false); return }
      setToken(session.access_token)

      const [overviewRes, waiversRes] = await Promise.all([
        fetch('/api/admin/revenue-share', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/admin/revenue-share/waiver-requests', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ])
      if (overviewRes.status === 401 || waiversRes.status === 401) { setAuthorized(false); setLoading(false); return }
      if (overviewRes.ok) {
        const d = await overviewRes.json()
        setAgreements(d.agreements || [])
        setInvoices(d.invoices || [])
      }
      if (waiversRes.ok) {
        const d = await waiversRes.json()
        setWaiverRequests(d.requests || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function decide(requestId: string, decision: 'approved' | 'rejected') {
    setDecidingId(requestId)
    try {
      const res = await fetch('/api/admin/revenue-share/waiver-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, decision, note: notes[requestId] || '' }),
      })
      const json = await res.json()
      if (res.ok) {
        setWaiverRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r))
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

  const pendingWaivers = waiverRequests.filter(r => r.status === 'pending')
  const pastWaivers = waiverRequests.filter(r => r.status !== 'pending')

  const statusColor: Record<string, string> = {
    pending: '#facc15', not_due: '#71717a', paid: '#4ade80', waived: '#60a5fa', overdue: '#f87171',
  }

  // Group invoices by creator for the overview table — most recent month per creator.
  const invoicesByCreator = new Map<string, any[]>()
  for (const inv of invoices) {
    if (!invoicesByCreator.has(inv.creator_id)) invoicesByCreator.set(inv.creator_id, [])
    invoicesByCreator.get(inv.creator_id)!.push(inv)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: 32 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pay As You Earn — Revenue Share</h1>
        <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 28 }}>
          Every creator on the commission plan, their monthly revenue and commission owed, and waiver requests awaiting your review.
        </p>

        {/* ── Waiver requests queue ── */}
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Waiver requests</h2>
        {pendingWaivers.length === 0 ? (
          <p style={{ color: '#52525b', fontSize: 13, marginBottom: 28 }}>No pending requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {pendingWaivers.map(r => {
              const inv = r.revenue_share_invoices
              const monthLabel = inv?.period_start ? new Date(inv.period_start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''
              return (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {r.creators?.name || r.creators?.email || 'Creator'} — {monthLabel}, ₹{Number(inv?.total_amount_due || 0).toLocaleString()} due
                  </p>
                  <p style={{ color: '#71717a', fontSize: 12, marginBottom: 8 }}>
                    Collected ₹{Number(inv?.gross_revenue || 0).toLocaleString()} that month.
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
                      Approve waiver
                    </button>
                    <button onClick={() => decide(r.id, 'rejected')} disabled={decidingId === r.id}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pastWaivers.length > 0 && (
          <>
            <h2 style={{ color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Waiver history</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {pastWaivers.map(r => (
                <div key={r.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#a1a1aa', fontSize: 12 }}>
                    {r.creators?.name || r.creators?.email || 'Creator'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.status === 'approved' ? '#4ade80' : '#f87171' }}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Creator overview ── */}
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Creators on Pay As You Earn</h2>
        {agreements.length === 0 ? (
          <p style={{ color: '#52525b', fontSize: 13 }}>No one has opted in yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agreements.map(a => {
              const creatorInvoices = (invoicesByCreator.get(a.creator_id) || []).slice(0, 6)
              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                      {a.creators?.name || a.creators?.email || 'Creator'}
                    </p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: a.status === 'active' ? '#4ade80' : '#71717a' }}>
                      {a.status}
                    </span>
                  </div>
                  <p style={{ color: '#71717a', fontSize: 11, marginBottom: 10 }}>
                    {a.base_rate_percent}% up to {a.overflow_threshold_students} students, {a.overflow_rate_percent}% beyond — since {new Date(a.started_at).toLocaleDateString('en-IN')}
                  </p>
                  {creatorInvoices.length === 0 ? (
                    <p style={{ color: '#52525b', fontSize: 12 }}>No invoices yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {creatorInvoices.map(inv => (
                        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#a1a1aa' }}>
                            {new Date(inv.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} — collected ₹{Number(inv.gross_revenue).toLocaleString()}
                          </span>
                          <span style={{ fontWeight: 600, color: statusColor[inv.status] || '#a1a1aa' }}>
                            ₹{Number(inv.total_amount_due).toLocaleString()} · {inv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

type Creator = { id: string; name: string; payout_account_status: string; payout_account_holder: string }
type CreatorDetail = {
  id: string
  name: string
  accountHolder: string
  bankAccountNumber: string
  ifsc: string
  upiId: string
  status: string
}
type PayoutRow = {
  id: string
  amount: number
  net_amount: number
  payout_date: string
  status: string
  method: string
  reference_note: string | null
}

export default function AdminPayoutsPage() {
  const [token, setToken] = useState('')
  const [creators, setCreators] = useState<Creator[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<CreatorDetail | null>(null)
  const [history, setHistory] = useState<PayoutRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showAccountNumber, setShowAccountNumber] = useState(false)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'manual_bank_transfer' | 'manual_upi'>('manual_bank_transfer')
  const [referenceNote, setReferenceNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not signed in.')
        setLoadingList(false)
        return
      }
      setToken(session.access_token)

      const res = await fetch('/api/admin/creators', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 401) {
        setError('This page is admin-only.')
      } else if (res.ok) {
        const d = await res.json()
        setCreators(d.creators || [])
      }
      setLoadingList(false)
    }
    init()
  }, [])

  async function loadCreator(id: string) {
    setSelectedId(id)
    setDetail(null)
    setHistory([])
    setShowAccountNumber(false)
    setMessage('')
    setError('')
    if (!id || !token) return

    setLoadingDetail(true)
    const res = await fetch(`/api/admin/payouts?creatorId=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const d = await res.json()
      setDetail(d.creator)
      setHistory(d.history || [])
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not load creator payout details.')
    }
    setLoadingDetail(false)
  }

  async function handleLogPayout() {
    setError('')
    setMessage('')
    if (!selectedId) return

    setSaving(true)
    const res = await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creatorId: selectedId, amount: Number(amount), method, referenceNote }),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(d.error || 'Could not log this payout.')
      return
    }

    setMessage('Payout logged. The creator will see this in their dashboard now.')
    setAmount('')
    setReferenceNote('')
    loadCreator(selectedId) // refresh history
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0a0a0b' }}>
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="text-xl font-semibold text-white mb-1">Log a Creator Payout</h1>
        <p className="text-xs mb-6" style={{ color: '#71717a' }}>
          Admin only. This writes directly to the same table creators see in their own Payout History.
        </p>

        {error && !detail && (
          <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {loadingList ? (
          <p className="text-sm" style={{ color: '#71717a' }}>Loading creators…</p>
        ) : (
          <>
            <label className="text-sm font-medium text-white mb-2 block">Select creator</label>
            <select
              value={selectedId}
              onChange={(e) => loadCreator(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white mb-6 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">— Choose a creator —</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id} style={{ background: '#18181b' }}>
                  {c.name || c.id} ({c.payout_account_status || 'not_set'})
                </option>
              ))}
            </select>

            {loadingDetail && <p className="text-sm" style={{ color: '#71717a' }}>Loading details…</p>}

            {detail && (
              <>
                <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-semibold text-white mb-3">Where to send the money</p>
                  {detail.upiId && (
                    <p className="text-sm mb-2" style={{ color: '#a1a1aa' }}>
                      UPI: <span className="text-white font-mono">{detail.upiId}</span>
                    </p>
                  )}
                  {detail.bankAccountNumber ? (
                    <>
                      <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>Account holder: <span className="text-white">{detail.accountHolder}</span></p>
                      <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>
                        Account number:{' '}
                        <span className="text-white font-mono">
                          {showAccountNumber ? detail.bankAccountNumber : '•'.repeat(Math.max(detail.bankAccountNumber.length, 6))}
                        </span>{' '}
                        <button onClick={() => setShowAccountNumber((s) => !s)} className="text-xs underline" style={{ color: '#8b5cf6' }}>
                          {showAccountNumber ? 'hide' : 'show'}
                        </button>
                      </p>
                      <p className="text-sm" style={{ color: '#a1a1aa' }}>IFSC: <span className="text-white font-mono">{detail.ifsc}</span></p>
                    </>
                  ) : !detail.upiId ? (
                    <p className="text-sm" style={{ color: '#f59e0b' }}>No payout details saved for this creator yet.</p>
                  ) : null}
                </div>

                <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-semibold text-white mb-3">Log a payout you've already sent</p>

                  <label className="text-xs mb-1 block" style={{ color: '#71717a' }}>Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 4500"
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white mb-3 outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />

                  <label className="text-xs mb-1 block" style={{ color: '#71717a' }}>Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white mb-3 outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="manual_bank_transfer" style={{ background: '#18181b' }}>Bank transfer (NEFT/IMPS)</option>
                    <option value="manual_upi" style={{ background: '#18181b' }}>UPI</option>
                  </select>

                  <label className="text-xs mb-1 block" style={{ color: '#71717a' }}>Reference / note (optional)</label>
                  <input
                    type="text"
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="e.g. UTR12345, or 'July payout'"
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-white mb-4 outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />

                  {error && <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>{error}</p>}
                  {message && <p className="text-xs mb-3" style={{ color: '#86efac' }}>{message}</p>}

                  <button
                    onClick={handleLogPayout}
                    disabled={saving || !amount}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                    style={{ background: '#7c3aed', opacity: saving || !amount ? 0.6 : 1 }}
                  >
                    {saving ? 'Logging…' : 'Log payout'}
                  </button>
                </div>

                <p className="text-sm font-semibold text-white mb-2">Payout history</p>
                {history.length === 0 ? (
                  <p className="text-xs" style={{ color: '#52525b' }}>No payouts logged yet for this creator.</p>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    {history.map((p, i) => (
                      <div
                        key={p.id}
                        className="px-4 py-3 text-xs flex justify-between items-center"
                        style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', color: '#a1a1aa' }}
                      >
                        <span>{new Date(p.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        <span className="text-white font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                        <span>{p.method?.replace('manual_', '') || '—'}</span>
                        <span>{p.reference_note || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
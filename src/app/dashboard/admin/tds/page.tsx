'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

type Row = { creatorId: string; name: string; totalSalesThisFY: number; status: string }

export default function AdminTdsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not signed in.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/admin/tds-tracker', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 401) {
        setError('This page is admin-only.')
      } else if (res.ok) {
        const d = await res.json()
        setRows(d.rows || [])
      } else {
        setError('Could not load TDS tracker.')
      }
      setLoading(false)
    }
    load()
  }, [])

  function statusLabel(status: string) {
    if (status === 'over_threshold') return { text: 'Over ₹5L — start deducting TDS', color: '#f87171', bg: 'rgba(248,113,113,0.1)' }
    if (status === 'approaching') return { text: 'Approaching ₹5L', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    return { text: 'OK', color: '#71717a', bg: 'rgba(255,255,255,0.04)' }
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0a0a0b' }}>
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="text-xl font-semibold text-white mb-1">TDS Tracker (Section 194-O)</h1>
        <p className="text-xs mb-6" style={{ color: '#71717a' }}>
          Running total of each creator's sales through Kurso this financial year (Apr–Mar). Nothing to do until a creator crosses ₹5,00,000.
        </p>

        {error && (
          <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: '#71717a' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: '#71717a' }}>No paid sales yet this financial year.</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {rows.map((r, i) => {
              const s = statusLabel(r.status)
              return (
                <div key={r.creatorId} className="px-4 py-3 flex justify-between items-center"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span className="text-sm text-white">{r.name}</span>
                  <span className="text-sm font-mono" style={{ color: '#a1a1aa' }}>
                    ₹{r.totalSalesThisFY.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
                    {s.text}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
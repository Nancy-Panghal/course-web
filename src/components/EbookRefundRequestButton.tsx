'use client'
import { useEffect, useState } from 'react'

export default function EbookRefundRequestButton({ purchaseId }: { purchaseId: string }) {
  const [eligible, setEligible] = useState(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/student/ebook-refund-request?purchaseId=${purchaseId}`)
      .then(res => res.ok ? res.json() : { eligible: false })
      .then(data => { if (!cancelled) setEligible(!!data.eligible) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [purchaseId])

  if (!eligible && !open) return null

  async function submit() {
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/student/ebook-refund-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, reason }),
      })
      const data = await res.json()
      if (!res.ok) { setResult(data.error || 'Could not submit your request.'); return }
      setResult('Your refund request has been sent to the creator.')
      setEligible(false)
    } catch {
      setResult('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ fontSize: 11, marginTop: 16, textAlign: 'center' }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', textDecoration: 'underline' }}>
          Request a refund
        </button>
      ) : result ? (
        <span style={{ color: result.includes('sent') ? '#4ade80' : '#fca5a5' }}>{result}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you requesting a refund? (optional)" rows={2}
            style={{ width: 240, fontSize: 11, padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
          <button onClick={submit} disabled={submitting}
            style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
            {submitting ? 'Sending...' : 'Submit request'}
          </button>
        </div>
      )}
    </div>
  )
}
'use client'
import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

type UpiIntent = { bhim_link: string; phonepe_link: string; paytm_link: string; gpay_link: string }

interface Props {
  qrCode: string
  upiIntent: UpiIntent
  expiresAt: string
  clientTxnId: string
  amount: number
  onSuccess: (enrollmentId: string | null) => void
  onExpired: () => void
}

export default function VyaparPayWidget({ qrCode, upiIntent, expiresAt, clientTxnId, amount, onSuccess, onExpired }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )
  const terminalRef = useRef(false)

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const poll = setInterval(async () => {
      if (terminalRef.current) return
      try {
        const res = await fetch(`/api/vyapar/order-status?clientTxnId=${clientTxnId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'success') {
          terminalRef.current = true
          clearInterval(poll)
          onSuccess(data.enrollmentId || null)
        } else if (data.status === 'failed' || data.status === 'expired') {
          terminalRef.current = true
          clearInterval(poll)
          onExpired()
        }
      } catch {
        // transient network hiccup — keep polling silently
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [clientTxnId, onSuccess, onExpired])

  useEffect(() => {
    if (secondsLeft === 0 && !terminalRef.current) {
      terminalRef.current = true
      onExpired()
    }
  }, [secondsLeft, onExpired])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center p-6">
      <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>Scan with any UPI app to pay</p>
      <p className="text-2xl font-bold text-white mb-4">₹{amount.toLocaleString('en-IN')}</p>

      <div className="rounded-2xl p-3 mb-4" style={{ background: '#fff' }}>
        <img src={qrCode} alt="UPI QR code" width={200} height={200} />
      </div>

      <div className="flex items-center gap-2 mb-5">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--kurso-primary-light)' }} />
        <p className="text-xs" style={{ color: '#71717a' }}>Waiting for payment · expires in {mm}:{ss}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <a href={upiIntent.gpay_link} className="py-3 rounded-xl text-center text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>Google Pay</a>
        <a href={upiIntent.phonepe_link} className="py-3 rounded-xl text-center text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>PhonePe</a>
        <a href={upiIntent.paytm_link} className="py-3 rounded-xl text-center text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>Paytm</a>
        <a href={upiIntent.bhim_link} className="py-3 rounded-xl text-center text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>BHIM</a>
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: '#3f3f46' }}>
        On mobile, tap your app above. On desktop, scan the QR with your phone's UPI app.
      </p>
    </div>
  )
}
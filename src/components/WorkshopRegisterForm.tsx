// src/components/WorkshopRegisterForm.tsx
'use client'
import { useState } from 'react'

interface Props {
  workshopId: string
  price: number
  isFull: boolean
  upiId: string | null
  upiDisplayName: string
}

type Step = 'form' | 'pay' | 'success' | 'pending'

export default function WorkshopRegisterForm({ workshopId, price, isFull, upiId, upiDisplayName }: Props) {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [utr, setUtr] = useState('')
  const [registrationId, setRegistrationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFree = price <= 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cleanedPhone = phone.trim().replace(/\D/g, '')
    if (cleanedPhone.length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/workshops/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId,
          name,
          email: email || null,
          phone: '91' + cleanedPhone,
          paymentMode: isFree ? 'free' : 'upi_manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      setRegistrationId(data.registrationId)
      setStep(data.paymentStatus === 'confirmed' ? 'success' : 'pay')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUtrSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!utr.trim()) { setError('Please enter your UPI transaction reference (UTR)'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/workshops/register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, utrReference: utr.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your reference')
      setStep('pending')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isFull) {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
        This workshop is fully booked.
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
        You're registered! We've sent the Zoom link to your WhatsApp.
      </div>
    )
  }

  if (step === 'pending') {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
        Got it — we'll confirm your spot on WhatsApp once your payment is verified.
      </div>
    )
  }

  if (step === 'pay') {
    const upiLink = upiId
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiDisplayName)}&am=${price}&cu=INR`
      : ''
    return (
      <form onSubmit={handleUtrSubmit} className="space-y-4">
        <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(var(--kurso-primary-rgb), 0.08)', border: '1px solid rgba(var(--kurso-primary-rgb), 0.15)' }}>
          <p className="text-white font-semibold mb-1">Pay ₹{price.toLocaleString()} via UPI</p>
          {upiId ? (
            <>
              <p className="text-xs mb-3" style={{ color: '#a1a1aa' }}>
                UPI ID: <span className="text-white">{upiId}</span> ({upiDisplayName})
              </p>
              <a href={upiLink} className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90">
                Pay with UPI app
              </a>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              This creator hasn't set up UPI payments yet. Please contact them directly.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>
            After paying, enter your UPI transaction reference (UTR)
          </label>
          <input
            value={utr}
            onChange={e => setUtr(e.target.value)}
            placeholder="12-digit UTR / reference number"
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
          {loading ? 'Saving…' : 'Submit reference'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        value={name} onChange={e => setName(e.target.value)} required
        placeholder="Full name"
        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <input
        value={email} onChange={e => setEmail(e.target.value)} type="email"
        placeholder="Email (optional)"
        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="flex items-center px-3 text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>+91</span>
        <input
          value={phone} onChange={e => setPhone(e.target.value)} required
          placeholder="WhatsApp number" inputMode="numeric" maxLength={10}
          className="flex-1 px-4 py-3 text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      </div>
      {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3.5 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
        {loading ? 'Registering…' : isFree ? 'Register for free' : `Continue to pay ₹${price.toLocaleString()}`}
      </button>
    </form>
  )
}
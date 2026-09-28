// src/components/WorkshopRegisterForm.tsx
'use client'
import { useEffect, useState } from 'react'
import { loadCashfreeSdk, loadRazorpaySdk, pollOrderStatus } from '@/lib/checkout-client'

interface Props {
  workshopId: string
  workshopTitle: string
  price: number
  isFull: boolean
  upiId: string | null
  upiDisplayName: string
  gatewayEnabled: boolean
  telegramBotUsername: string | null
}

type Step = 'form' | 'pay' | 'checking' | 'success' | 'pending'
type PayMethod = 'gateway' | 'upi_manual'

const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }

export default function WorkshopRegisterForm({
  workshopId, workshopTitle, price, isFull, upiId, upiDisplayName, gatewayEnabled, telegramBotUsername,
}: Props) {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [utr, setUtr] = useState('')
  const [method, setMethod] = useState<PayMethod>(gatewayEnabled ? 'gateway' : 'upi_manual')
  const [registrationId, setRegistrationId] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFree = price <= 0
  const hasUpi = !!upiId
  const noPaymentAvailable = !isFree && !gatewayEnabled && !hasUpi

  // Handles the redirect-back from Cashfree / Stripe hosted checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tg = params.get('tg')
    if (tg) setTelegramToken(tg)
    if (params.get('status') === 'cancelled') {
      setError('Payment was cancelled. You can try again below.')
      return
    }
    const orderId = params.get('order_id')
    if (!orderId) return
    setStep('checking')
    pollOrderStatus(orderId).then((result) => {
      if (result === 'success') {
        setStep('success')
      } else {
        setStep('form')
        setError('We could not confirm your payment yet. If money was deducted, your spot is confirmed automatically within a few minutes and you will get a WhatsApp message.')
      }
    })
  }, [])

  async function registerDirect(paymentMode: 'free' | 'upi_manual', fullPhone: string) {
    const res = await fetch('/api/workshops/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, name, email: email || null, phone: fullPhone, paymentMode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')

    setRegistrationId(data.registrationId)
    if (data.telegramToken) setTelegramToken(data.telegramToken)
    setStep(data.paymentStatus === 'confirmed' ? 'success' : 'pay')
  }

  async function startGatewayPayment(fullPhone: string) {
    const res = await fetch('/api/workshops/checkout/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, name, email, phone: fullPhone }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Could not start the payment')

    if (data.telegramToken) setTelegramToken(data.telegramToken)
    if (data.alreadyRegistered) { setStep('success'); return }

    const { clientTxnId, order } = data

    if (order.provider === 'cashfree') {
      const cashfree = await loadCashfreeSdk(order.mode)
      // Redirects away; confirmation happens in the redirect-back effect above.
      await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: '_self' })
      return
    }

    if (order.provider === 'razorpay') {
      await loadRazorpaySdk()
      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        order_id: order.orderId,
        name: workshopTitle,
        prefill: { name, email, contact: fullPhone },
        handler: async () => {
          setStep('checking')
          const status = await pollOrderStatus(clientTxnId)
          setStep(status === 'success' ? 'success' : 'pending')
        },
        modal: { ondismiss: () => setLoading(false) },
      })
      rzp.open()
      return
    }

    if (order.provider === 'stripe') {
      window.location.href = order.checkoutUrl
      return
    }

    throw new Error('Unsupported payment method.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cleanedPhone = phone.trim().replace(/\D/g, '')
    if (cleanedPhone.length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp number')
      return
    }
    const mode: 'free' | 'upi_manual' | 'gateway' = isFree ? 'free' : method
    if (mode === 'gateway' && !email.trim()) {
      setError('Email is required for online payment')
      return
    }
    setLoading(true)
    try {
      const fullPhone = '91' + cleanedPhone
      if (mode === 'gateway') await startGatewayPayment(fullPhone)
      else await registerDirect(mode, fullPhone)
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

  const telegramCta = telegramBotUsername && telegramToken ? (
    <a
      href={`https://t.me/${telegramBotUsername.replace('@', '')}?start=ws_${telegramToken}`}
      target="_blank" rel="noopener noreferrer"
      className="block w-full text-center mt-3 py-3 rounded-xl text-sm font-semibold"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      Get updates on Telegram too
    </a>
  ) : null

  if (isFull && step === 'form') {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
        This workshop is fully booked.
      </div>
    )
  }

  if (noPaymentAvailable && step === 'form') {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
        The creator hasn't set up payments for this workshop yet. Please contact them directly.
      </div>
    )
  }

  if (step === 'checking') {
    return (
      <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
        Confirming your payment…
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div>
        <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
          You're registered! We've sent the Zoom link to your WhatsApp.
        </div>
        {telegramCta}
      </div>
    )
  }

  if (step === 'pending') {
    return (
      <div>
        <div className="p-4 rounded-xl text-sm text-center" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
          Got it — we'll confirm your spot on WhatsApp once your payment is verified.
        </div>
        {telegramCta}
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
            value={utr} onChange={e => setUtr(e.target.value)}
            placeholder="12-digit UTR / reference number"
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={inputStyle}
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
        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none" style={inputStyle}
      />
      <input
        value={email} onChange={e => setEmail(e.target.value)} type="email"
        placeholder={!isFree && method === 'gateway' ? 'Email (required for online payment)' : 'Email (optional)'}
        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none" style={inputStyle}
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

      {!isFree && gatewayEnabled && hasUpi && (
        <div className="grid grid-cols-2 gap-2">
          {([
            ['gateway', 'Pay online', 'UPI, cards, netbanking'],
            ['upi_manual', 'Pay via UPI', 'Enter UTR after paying'],
          ] as const).map(([value, label, hint]) => (
            <button
              key={value} type="button" onClick={() => setMethod(value)}
              className="p-3 rounded-xl text-left"
              style={{
                background: method === value ? 'rgba(var(--kurso-primary-rgb), 0.12)' : 'rgba(255,255,255,0.04)',
                border: method === value ? '1px solid rgba(var(--kurso-primary-rgb), 0.4)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs" style={{ color: '#a1a1aa' }}>{hint}</p>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3.5 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
        {loading
          ? 'Please wait…'
          : isFree
            ? 'Register for free'
            : `Continue to pay ₹${price.toLocaleString()}`}
      </button>
    </form>
  )
}
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BookOpen } from 'lucide-react'

export default function EbookPageClient({ ebookId }: { ebookId: string }) {
  const [ebook, setEbook] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [purchased, setPurchased] = useState(false)

  useEffect(() => {
    supabase.from('ebooks').select('id, title, description, price, cover_image_url, is_published').eq('id', ebookId).maybeSingle()
      .then(({ data }) => { setEbook(data); setLoading(false) })
  }, [ebookId])

  // Handles the redirect-back case — the buyer lands back on this page after
  // paying on Cashfree's or Stripe's hosted checkout. Cashfree's redirect
  // only appends ?order_id= (no status flag), so we poll whenever an
  // order_id shows up — not only when status=success is also present.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order_id')
    if (!orderId) return
    setCheckingStatus(true)
    pollOrderStatus(orderId).then((result) => {
      setCheckingStatus(false)
      if (result === 'success') setPurchased(true)
      else setError('We could not confirm this payment yet. If money was deducted, it will reflect within a few minutes — refresh this page, or contact the creator if it does not.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadCashfreeSdk(): Promise<any> {
    if ((window as any).__cashfreeInstance) return (window as any).__cashfreeInstance
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById('cashfree-sdk-script')) return resolve()
      const script = document.createElement('script')
      script.id = 'cashfree-sdk-script'
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load the payment SDK. Check your connection and try again.'))
      document.body.appendChild(script)
    })
    const instance = (window as any).Cashfree({ mode: 'production' })
    ;(window as any).__cashfreeInstance = instance
    return instance
  }

  async function loadRazorpaySdk(): Promise<void> {
    if ((window as any).Razorpay) return
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById('razorpay-sdk-script')) return resolve()
      const script = document.createElement('script')
      script.id = 'razorpay-sdk-script'
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load the payment SDK. Check your connection and try again.'))
      document.body.appendChild(script)
    })
  }

  async function pollOrderStatus(clientTxnId: string, attemptsLeft = 8): Promise<string | null> {
    if (attemptsLeft <= 0) return null
    const res = await fetch(`/api/order-status?clientTxnId=${clientTxnId}`)
    const data = await res.json().catch(() => null)
    if (data?.status === 'success') return data.status
    await new Promise((r) => setTimeout(r, 2000))
    return pollOrderStatus(clientTxnId, attemptsLeft - 1)
  }

  async function handleBuy() {
    if (!name.trim() || !email.trim()) { setError('Please enter your name and email.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/checkout/create-ebook-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebookId, buyerName: name, buyerEmail: email, buyerPhone: phone }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const { clientTxnId, order } = data

      if (order.provider === 'cashfree') {
        const cashfree = await loadCashfreeSdk()
        // Redirect mode — the browser navigates to Cashfree's hosted page and
        // back to our return_url (with ?order_id= guaranteed by the server).
        // Nothing after this line runs; confirmation happens in the
        // redirect-return effect above when the buyer lands back here.
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
          name: ebook.title,
          prefill: { name, email, contact: phone },
          handler: async () => {
            setCheckingStatus(true)
            const status = await pollOrderStatus(clientTxnId)
            setCheckingStatus(false)
            if (status === 'success') setPurchased(true)
            else setError('Payment received but not yet confirmed — refresh this page in a moment.')
          },
          modal: { ondismiss: () => setSubmitting(false) },
        })
        rzp.open()
        return
      }

      if (order.provider === 'stripe') {
        window.location.href = order.checkoutUrl
        return
      }

      throw new Error('Unsupported payment method.')
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#050505' }} />
  if (!ebook || !ebook.is_published) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
      This ebook isn't available.
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: '48px 20px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        {ebook.cover_image_url ? (
          <img src={ebook.cover_image_url} alt={ebook.title} style={{ width: '100%', borderRadius: 16, marginBottom: 20 }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 16, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <BookOpen className="w-10 h-10" style={{ color: '#3f3f46' }} />
          </div>
        )}
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{ebook.title}</h1>
        {ebook.description && <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>{ebook.description}</p>}
        <p style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>₹{Number(ebook.price).toLocaleString('en-IN')}</p>

        {purchased ? (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontSize: 13, textAlign: 'center' }}>
            Payment received! Check your email ({email || 'your inbox'}) for your download link.
          </div>
        ) : checkingStatus ? (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa', fontSize: 13, textAlign: 'center' }}>
            Confirming your payment...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
              style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13 }} />
            <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13 }} />
            <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)}
              style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13 }} />
            {error && <p style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
            <button onClick={handleBuy} disabled={submitting}
              className="violet-gradient"
              style={{ padding: '14px 0', borderRadius: 12, fontWeight: 700, fontSize: 14, color: '#fff', border: 'none', cursor: 'pointer' }}>
              {submitting ? 'Starting payment...' : `Buy for ₹${Number(ebook.price).toLocaleString('en-IN')}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
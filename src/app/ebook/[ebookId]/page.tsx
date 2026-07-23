'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import VyaparPayWidget from '@/components/VyaparPayWidget'
import { BookOpen } from 'lucide-react'

export default function EbookStorefrontPage({ params }: { params: Promise<{ ebookId: string }> }) {
  const { ebookId } = use(params)
  const [ebook, setEbook] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [purchased, setPurchased] = useState(false)

  useEffect(() => {
    supabase.from('ebooks').select('id, title, description, price, cover_image_url, is_published').eq('id', ebookId).maybeSingle()
      .then(({ data }) => { setEbook(data); setLoading(false) })
  }, [ebookId])

  async function handleBuy() {
    if (!name.trim() || !email.trim()) { setError('Please enter your name and email.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/vyapar/create-ebook-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebookId, buyerName: name, buyerEmail: email, buyerPhone: phone }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOrder(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
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

        {order ? (
          <VyaparPayWidget
            qrCode={order.qrCode}
            upiIntent={order.upiIntent}
            expiresAt={order.expiresAt}
            clientTxnId={order.clientTxnId}
            amount={ebook.price}
            onSuccess={() => setPurchased(true)}
            onExpired={() => { setOrder(null); setError('Payment window expired. Please try again.') }}
          />
        ) : purchased ? (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontSize: 13, textAlign: 'center' }}>
            Payment received! Check your email ({email}) for your download link.
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
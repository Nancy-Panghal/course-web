'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, Check, ArrowLeft, Zap, AlertTriangle, Award, FileText, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCreatorProfile, getTrialStatus } from '@/lib/creator'
import VyaparPayWidget from '@/components/VyaparPayWidget'



const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 1999,
    period: '/month',
    desc: 'For creators just getting started',
    features: [
      'Up to 200 enrolled students',
      'Unlimited lessons',
      'WhatsApp delivery bot',
      'Basic piracy scanning (daily)',
      'Auto certificates',
      'Email support',
    ],
    highlighted: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 4999,
    period: '/month',
    desc: 'For serious creators with active launches',
    features: [
      'Up to 1,000 students',
      'Automated 3-hour takedowns',
      'Live piracy dashboard',
      'Razorpay integration',
      'Hindi/regional WA templates',
      'Web + WhatsApp delivery',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 12999,
    period: '/month',
    desc: 'For agencies managing multiple creators',
    features: [
      'Unlimited students',
      'Multi-creator management',
      'ISP-level escalation',
      'White-label portal',
      'Custom domain per creator',
      'Dedicated account manager',
    ],
    highlighted: false,
  },
]



export default function UpgradePage() {
  const [creator, setCreator] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [trialStatus, setTrialStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [payingPlan, setPayingPlan] = useState<string | null>(null)
  const [vyaparOrder, setVyaparOrder] = useState<any>(null)
  const [fetchingInvoiceFor, setFetchingInvoiceFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login?role=creator'
        return
      }
      const profile = await getCreatorProfile()
      setCreator(profile)
      if (profile?.id) {
        const { data: paymentRows } = await supabase
          .from('kurso_subscription_payments')
          .select('id, plan_name, amount, paid_at')
          .eq('creator_id', profile.id)
          .order('paid_at', { ascending: false })
          .limit(10)
        setPayments(paymentRows || [])
      }
      setTrialStatus(getTrialStatus(profile))
      setLoading(false)
    }
    load()
  }, [])

  async function handleUpgrade(plan: typeof plans[0]) {
    if (payingPlan) return
    setPayingPlan(plan.id)
    setError('')
    setSuccess('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please log in before upgrading.')

      const orderRes = await fetch('/api/vyapar/create-subscription-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId: plan.id }),
      })
      const data = await orderRes.json()
      if (data.error) throw new Error(data.error)
      setVyaparOrder(data)
    } catch (err: any) {
      setError(err.message)
      setPayingPlan(null)
    }
  }

  async function handleVyaparSubActivated() {
    const profile = await getCreatorProfile()
    setCreator(profile)
    setTrialStatus(getTrialStatus(profile))
    setSuccess(`Successfully upgraded! Your academy is now fully active.`)

    if (profile?.id) {
      const { data: paymentRows } = await supabase
        .from('kurso_subscription_payments')
        .select('id, plan_name, amount, paid_at')
        .eq('creator_id', profile.id)
        .order('paid_at', { ascending: false })
        .limit(10)
      setPayments(paymentRows || [])
    }
    setVyaparOrder(null)
    setPayingPlan(null)
  }

  function handleVyaparSubExpired() {
    setVyaparOrder(null)
    setPayingPlan(null)
    setError('This payment window expired or failed. Please try again.')
  }

  // One call does everything: finds-or-creates the invoice row server-side
  // (same invoice number every time for this payment) and returns a fresh
  // PDF. `mode: 'view'` opens it inline in a new tab; `mode: 'download'`
  // saves it to disk. Either way, this always shows the actual PDF —
  // there's no separate "generate first" step anymore.
  async function handleInvoice(paymentId: string, mode: 'view' | 'download') {
    setFetchingInvoiceFor(paymentId + mode)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch(`/api/creator/kurso-invoice?paymentId=${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Could not fetch invoice')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (mode === 'view') {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${paymentId}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      // Give the new tab / download a moment to pick up the blob before revoking
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err: any) {
      setError(err.message || 'Failed to open invoice')
    } finally {
      setFetchingInvoiceFor(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black grid-bg">

      {/* Nav */}
      <div className="border-b px-6 py-4 flex items-center justify-between"
        style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(20px)'}}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white">Kurso</span>
        </Link>
        <Link href="/dashboard"
          className="flex items-center gap-2 text-sm transition-colors"
          style={{color:'#a1a1aa'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Trial status banner */}
        {trialStatus && trialStatus.plan === 'trial' && (
          <div className="mb-10 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              background: trialStatus.expired
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(245,158,11,0.08)',
              border: `1px solid ${trialStatus.expired
                ? 'rgba(239,68,68,0.2)'
                : 'rgba(245,158,11,0.2)'}`
            }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5"
                style={{color: trialStatus.expired ? '#ef4444' : 'var(--kurso-accent)'}} />
              <div>
                <p className="font-semibold text-white">
                  {trialStatus.expired
                    ? 'Your free trial has ended'
                    : `${trialStatus.daysLeft} day${trialStatus.daysLeft !== 1 ? 's' : ''} left in your free trial`
                  }
                </p>
                <p className="text-sm mt-0.5" style={{color:'#a1a1aa'}}>
                  {trialStatus.expired
                    ? 'Your academy is paused. Upgrade to restore access for your students.'
                    : 'Upgrade now to keep your academy running after the trial ends.'
                  }
                </p>
              </div>
            </div>
            {!trialStatus.expired && (
              <span className="text-xs px-3 py-1.5 rounded-full flex-shrink-0 font-medium"
                style={{background:'rgba(245,158,11,0.15)', color:'var(--kurso-accent)', border:'1px solid rgba(245,158,11,0.2)'}}>
                Trial active
              </span>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-medium"
            style={{background:'rgba(var(--kurso-primary-rgb), 0.1)', color:'var(--kurso-primary-light)', border:'1px solid rgba(var(--kurso-primary-rgb), 0.2)'}}>
            <Zap className="w-3 h-3" />
            Choose your plan
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Upgrade Kurso
          </h1>
          <p style={{color:'#a1a1aa'}}>
            Cancel anytime. No hidden fees. Switch plans whenever you need.
          </p>
        </div>

        {/* Success/Error messages */}
        {success && (
          <div className="mb-8 flex items-start gap-3 p-4 rounded-xl"
            style={{background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.2)'}}>
            <Award className="w-5 h-5 flex-shrink-0 mt-0.5" style={{color:'#4ade80'}} />
            <p className="text-sm" style={{color:'#4ade80'}}>{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-8 p-4 rounded-xl text-sm"
            style={{background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map(plan => {
            const isCurrent = creator?.plan === plan.id
            return (
              <div key={plan.id}
                className="rounded-2xl p-8 flex flex-col transition-all"
                style={{
                  background: plan.highlighted ? 'linear-gradient(135deg, var(--kurso-primary), var(--kurso-primary-light))' : '#0a0a0a',
                  border: isCurrent
                    ? '2px solid #4ade80'
                    : plan.highlighted
                    ? '1px solid var(--kurso-primary-light)'
                    : '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                }}>

                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-violet-600 text-xs font-bold px-4 py-1 rounded-full"
                    style={{color:'var(--kurso-primary)'}}>
                    MOST POPULAR
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full"
                    style={{background:'rgba(74,222,128,0.9)', color:'#000'}}>
                    CURRENT PLAN
                  </div>
                )}

                <div className="mb-6">
                  <div className="text-sm font-medium mb-1"
                    style={{color: plan.highlighted ? 'rgba(255,255,255,0.7)' : '#a1a1aa'}}>
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold text-white">₹{plan.price.toLocaleString()}</span>
                    <span className="text-sm" style={{color: plan.highlighted ? 'rgba(255,255,255,0.6)' : '#52525b'}}>
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-sm" style={{color: plan.highlighted ? 'rgba(255,255,255,0.7)' : '#a1a1aa'}}>
                    {plan.desc}
                  </p>
                </div>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((f,i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-white' : 'text-violet-light'}`}
                        style={{color: plan.highlighted ? '#fff' : 'var(--kurso-primary-light)'}} />
                      <span style={{color: plan.highlighted ? 'rgba(255,255,255,0.9)' : '#a1a1aa'}}>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-sm font-medium text-center"
                    style={{background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.2)'}}>
                    ✓ Active Plan
                  </div>
                ) : payingPlan === plan.id && vyaparOrder ? (
                  <VyaparPayWidget
                    qrCode={vyaparOrder.qrCode}
                    upiIntent={vyaparOrder.upiIntent}
                    expiresAt={vyaparOrder.expiresAt}
                    clientTxnId={vyaparOrder.clientTxnId}
                    amount={plan.price}
                    onSuccess={handleVyaparSubActivated}
                    onExpired={handleVyaparSubExpired}
                  />
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={payingPlan !== null}
                    className="w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                    style={{
                      background: plan.highlighted ? '#fff' : 'linear-gradient(135deg, var(--kurso-primary), var(--kurso-primary-light))',
                      color: plan.highlighted ? 'var(--kurso-primary)' : '#fff',
                    }}>
                    {payingPlan === plan.id ? 'Opening payment...' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Subscription payments & invoices — directly below the plan cards */}
        {payments.length > 0 && (
          <div className="rounded-2xl p-6 glass mb-12" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" style={{color:'var(--kurso-primary-light)'}} />
              <div className="text-sm font-semibold text-white">Billing history</div>
            </div>
            <div className="flex flex-col gap-3">
              {payments.map(p => {
                const busy = fetchingInvoiceFor === p.id + 'view' || fetchingInvoiceFor === p.id + 'download'
                return (
                  <div key={p.id} className="flex items-center justify-between flex-wrap gap-3 py-2"
                    style={{borderBottom: '1px solid rgba(255,255,255,0.04)'}}>
                    <div>
                      <div className="text-sm" style={{color:'#fff'}}>{p.plan_name} plan · ₹{Number(p.amount).toLocaleString()}</div>
                      <div className="text-xs mt-0.5" style={{color:'#a1a1aa'}}>
                        {new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInvoice(p.id, 'view')}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                        style={{background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.08)'}}>
                        <FileText className="w-3.5 h-3.5" />
                        {fetchingInvoiceFor === p.id + 'view' ? 'Opening...' : 'View Invoice'}
                      </button>
                      <button
                        onClick={() => handleInvoice(p.id, 'download')}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                        style={{background:'linear-gradient(135deg, var(--kurso-primary), var(--kurso-primary-light))', color:'#fff'}}>
                        <Download className="w-3.5 h-3.5" />
                        {fetchingInvoiceFor === p.id + 'download' ? 'Downloading...' : 'Download'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="rounded-2xl p-8 glass"
          style={{border:'1px solid rgba(255,255,255,0.06)'}}>
          <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel from your dashboard settings at any time. You keep access until the end of your billing period.'
              },
              {
                q: 'What happens after my trial ends?',
                a: 'Your academy is paused — students cannot access content. Upgrade to restore access immediately.'
              },
              {
                q: 'Can I switch plans?',
                a: 'Yes, upgrade or downgrade anytime. Upgrades take effect immediately, downgrades at next billing cycle.'
              },
              {
                q: 'Is there a refund policy?',
                a: 'Yes — if you face a technical issue on our end lasting more than 48 hours, contact us for a refund.'
              },
            ].map((item,i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-white mb-1">{item.q}</p>
                <p className="text-sm" style={{color:'#a1a1aa'}}>{item.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t flex items-center justify-between flex-wrap gap-3"
            style={{borderColor:'rgba(255,255,255,0.06)'}}>
            <p className="text-sm" style={{color:'#a1a1aa'}}>
              Have questions about billing or need a custom plan?
            </p>
            <Link href="/contact"
              className="text-sm font-medium transition-colors"
              style={{color:'var(--kurso-primary-light)'}}>
              Contact us →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t px-6 py-8 mt-8"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Kurso</span>
          </Link>
          <div className="flex gap-6 text-xs" style={{color:'#52525b'}}>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
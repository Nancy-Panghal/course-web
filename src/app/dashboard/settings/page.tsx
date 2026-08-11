'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { User, Bell, Shield, AlertTriangle, Check, X, Trash2, Clock, MessageCircle, IndianRupee, CheckCircle2, AlertCircle, Link2, Copy } from 'lucide-react'
import { PROVIDER_FIELDS } from '@/lib/payment-gateways'

// ── OUTSIDE the page component — fixes input focus loss ──
function InputField({ label, value, onChange, placeholder, type = 'text', disabled = false, rightElement }: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder: string
  type?: string
  disabled?: boolean
  rightElement?: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-white mb-2 block">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
          style={{
            background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: disabled ? 'not-allowed' : 'text',
            color: disabled ? '#52525b' : '#fff',
          }}
          onFocus={e => { if (!disabled) e.target.style.borderColor = 'var(--kurso-primary)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
        />
        {rightElement}
      </div>
    </div>
  )
}

function Toggle({ label, desc, value, onChange }: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
        style={{ background: value ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.1)' }}>
        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? '24px' : '4px' }} />
      </button>
    </div>
  )
}

function PublicProfileSection() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slug, setSlug] = useState('')
  const [savedSlug, setSavedSlug] = useState('')
  const [bio, setBio] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setLoading(false); return }
      setToken(session.access_token)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('creators').select('creator_slug, creator_bio, creator_business_address, creator_gstin').eq('id', user.id).maybeSingle()
        if (data?.creator_slug) { setSlug(data.creator_slug); setSavedSlug(data.creator_slug) }
        if (data?.creator_bio) setBio(data.creator_bio)
        if (data?.creator_business_address) setBusinessAddress(data.creator_business_address)
        if (data?.creator_gstin) setGstin(data.creator_gstin)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const res = await fetch('/api/creator/public-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug, bio, businessAddress, gstin }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Could not save.'); return }
      setSavedSlug(d.slug)
      setSlug(d.slug)
      setMessage('Saved.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <SectionCard title="Public Profile" icon={Link2}>
      <p className="text-xs mb-4" style={{ color: '#71717a' }}>
        A shareable page listing all your published courses. Set your handle once — students who buy one course can find your others here.
      </p>
      <div className="mb-3">
        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Handle</label>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: '#52525b' }}>kurso.in/creator/</span>
          <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="your-name"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Bio</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          placeholder="Tell students a bit about yourself..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 resize-none" />
      </div>
      <div className="mb-4">
        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Business Address (shown on invoices)</label>
        <input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Optional"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
      </div>
      <div className="mb-4">
        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">GSTIN (only if you're GST-registered)</label>
        <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} placeholder="Leave blank if not registered"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 font-mono" />
        <p className="text-[10px] mt-1" style={{ color: '#52525b' }}>
          If filled in, your invoices will show this GSTIN. Kurso does not calculate or add GST tax breakdowns — for full GST compliance, check with your CA.
        </p>
      </div>
      {error && <p className="text-xs mb-3" style={{ color: '#fca5a5' }}>{error}</p>}
      {message && <p className="text-xs mb-3" style={{ color: '#4ade80' }}>{message}</p>}
      <button onClick={handleSave} disabled={saving || !slug.trim()}
        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save profile'}
      </button>
      {savedSlug && (
        <p className="text-xs mt-3" style={{ color: '#52525b' }}>
          Live at: <a href={`/creator/${savedSlug}`} target="_blank" style={{ color: 'var(--kurso-primary-light)' }}>kurso.in/creator/{savedSlug}</a>
        </p>
      )}
    </SectionCard>
  )
}

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-6 glass mb-4"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(var(--kurso-primary-rgb), 0.1)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)' }} />
        </div>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── PAGE COMPONENT ──
export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')



  const [emailNotifications, setEmailNotifications] = useState({
    newLogin: true,
    paidSale: true,
    newEnrollment: true,
    courseCompletion: false,
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'scheduled' | 'cancelled'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<Date | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteApiError, setDeleteApiError] = useState('')

  // ── Vyapar Gateway connection state ────────────────────────────────
  // Each creator connects their OWN Vyapar Gateway account so student
  // payments settle directly to them — Kurso never touches the money.
  const [gwToken, setGwToken] = useState('')
  const [gwLoading, setGwLoading] = useState(true)
  const [gwList, setGwList] = useState<any[]>([]) // rows from GET, one per connected provider
  const [gwActiveTab, setGwActiveTab] = useState<'cashfree' | 'razorpay' | 'stripe'>('cashfree')
  const [gwUrlCopied, setGwUrlCopied] = useState(false)
  const [gwEnvironment, setGwEnvironment] = useState<'production' | 'sandbox'>('production')
  const [gwCredentials, setGwCredentials] = useState<Record<string, string>>({})
  const [gwWebhookSecret, setGwWebhookSecret] = useState('')
  const [gwSaving, setGwSaving] = useState(false)
  const [gwError, setGwError] = useState('')
  const hasChanges =
    name !== originalName



  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      const n = u?.user_metadata?.full_name || u?.user_metadata?.username || ''
      setName(n); setOriginalName(n)

      if (u) {
        const { data: creator } = await supabase
          .from('creators')
          .select('whatsapp_number, telegram_bot_username, telegram_bot_token, scheduled_deletion_at')
          .eq('id', u.id)
          .limit(1)



        // Restore scheduled deletion state if already scheduled
        if (creator?.[0]?.scheduled_deletion_at) {
          const scheduledDate = new Date(creator[0].scheduled_deletion_at)
          if (scheduledDate > new Date()) {
            setDeleteScheduledAt(scheduledDate)
            setDeleteStep('scheduled')
          }
        }
      }



      if (u?.user_metadata?.email_notifications) {
        setEmailNotifications(current => ({ ...current, ...u.user_metadata.email_notifications }))
      }
    })
  }, [])

  // ── Load Vyapar Gateway connection status ──────────────────────
  useEffect(() => {
    async function loadGateways() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setGwLoading(false); return }
      setGwToken(session.access_token)

      const res = await fetch('/api/creator/payment-gateway', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setGwList(d.gateways || [])
      setGwLoading(false)
    }
    loadGateways()
  }, [])


  async function handleSave() {
    setSaving(true)


    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: name,
        username: name,
      }
    })

    const { error: creatorError } = await supabase
      .from('creators')
      .upsert({
        id: user.id,
        email: user.email,
        name,
        username: user.email?.split('@')[0],


      })

    if (!error && !creatorError) {
      setOriginalName(name)


      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }



  async function updateEmailNotificationSetting(key: string, value: boolean) {
    const nextNotifications = { ...emailNotifications, [key]: value }
    setEmailNotifications(nextNotifications)

    await supabase.auth.updateUser({
      data: {
        email_notifications: nextNotifications
      }
    })
  }


  async function handleCopyWebhookUrl() {
    const url = `${window.location.origin}/api/webhooks/${gwActiveTab}`
    try {
      await navigator.clipboard.writeText(url)
      setGwUrlCopied(true)
      setTimeout(() => setGwUrlCopied(false), 5000)
    } catch {
      setGwError('Could not copy automatically — please select and copy the URL manually.')
    }
  }

  async function handleSaveGateway() {
    setGwError('')
    setGwSaving(true)
    try {
      const res = await fetch('/api/creator/payment-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gwToken}` },
        body: JSON.stringify({
          provider: gwActiveTab,
          environment: gwEnvironment,
          credentials: gwCredentials,
          webhookSecret: gwWebhookSecret,
          setDefault: gwList.length === 0, // first connected gateway becomes default
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setGwError(json.error || 'Could not verify these credentials.')
        return
      }
      const listRes = await fetch('/api/creator/payment-gateway', {
        headers: { Authorization: `Bearer ${gwToken}` },
      })
      setGwList((await listRes.json()).gateways || [])
      setGwCredentials({})
      setGwWebhookSecret('')
    } catch {
      setGwError('Network error. Please try again.')
    } finally {
      setGwSaving(false)
    }
  }
  async function handleScheduleDelete() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setDeleteApiError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No active session. Please log in again.')

      const res = await fetch('/api/creator/schedule-deletion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule deletion')

      const d = new Date(data.deletionDate)
      setDeleteScheduledAt(d)
      setDeleteStep('scheduled')
    } catch (err: any) {
      setDeleteApiError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleCancelDelete() {
    setDeleting(true)
    setDeleteApiError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No active session.')

      const res = await fetch('/api/creator/cancel-deletion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel deletion')

      setDeleteStep('cancelled')
      setDeleteScheduledAt(null)
      setDeleteInput('')
      setTimeout(() => setDeleteStep('idle'), 3000)
    } catch (err: any) {
      setDeleteApiError(err.message || 'Failed to cancel. Please contact support.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8 pt-20 md:pt-8 max-w-3xl">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Manage your account and preferences</p>
        </div>

        {/* Profile */}
        <SectionCard title="Profile" icon={User}>
          <InputField
            label="Display Name"
            value={name}
            onChange={setName}
            placeholder="Your name"
            rightElement={
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap"
                style={{
                  background: hasChanges ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.05)',
                  color: hasChanges ? '#fff' : '#52525b',
                  border: '1px solid ' + (hasChanges ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.1)'),
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                }}
              >
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Name'}
              </button>
            }
          />
          <InputField
            label="Email Address"
            value={user?.email || ''}
            placeholder=""
            disabled
          />
        </SectionCard>

        <PublicProfileSection />

        <SectionCard title="Telegram Delivery" icon={MessageCircle}>
          <div className="p-4 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-sm font-medium text-white mb-1">Telegram delivery is managed centrally.</p>
            <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
              Your students can access lessons on Telegram after enrollment. No setup needed — the shared Kurso bot handles delivery automatically.
            </p>
          </div>
        </SectionCard>


        <SectionCard title="Email Notifications" icon={Bell}>
          <Toggle
            label="New login"
            desc="Email me when my creator account signs in"
            value={emailNotifications.newLogin}
            onChange={v => updateEmailNotificationSetting('newLogin', v)}
          />
          <Toggle
            label="Paid sale"
            desc="Email me when a student pays for a course"
            value={emailNotifications.paidSale}
            onChange={v => updateEmailNotificationSetting('paidSale', v)}
          />
          <Toggle
            label="New enrollment"
            desc="Email me when a student gets enrolled"
            value={emailNotifications.newEnrollment}
            onChange={v => updateEmailNotificationSetting('newEnrollment', v)}
          />
          <Toggle
            label="Course completion"
            desc="Email me when a student completes a course"
            value={emailNotifications.courseCompletion}
            onChange={v => updateEmailNotificationSetting('courseCompletion', v)}
          />
        </SectionCard>

        <div className="mb-12" />

        {/* ── Get Paid — Payment Gateway (BYOK) ── */}
        <SectionCard title="Get Paid — Payment Gateway" icon={IndianRupee}>
          {gwLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-xs mb-4" style={{ color: '#a1a1aa' }}>
                Connect your own payment account. Student payments settle directly to you —
                Kurso never holds your money. Pick whichever provider you already have, or the
                easiest to set up: Cashfree for domestic UPI/cards, Stripe or Razorpay for
                international students.
              </p>

              {gwList.length > 0 && (
                <div className="mb-5 space-y-2">
                  {gwList.map((g) => (
                    <div key={g.provider} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: g.status === 'verified' ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                        border: g.status === 'verified' ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(239,68,68,0.2)',
                      }}>
                      {g.status === 'verified'
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} />
                        : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
                      }
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white capitalize">
                          {g.provider} {g.is_default && <span className="text-xs" style={{ color: '#a1a1aa' }}>(default)</span>}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
                          {g.status === 'verified' ? `Connected · ${g.environment}` : g.last_verification_error || 'Verification failed'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-4">
                {(['cashfree', 'razorpay', 'stripe'] as const).map((p) => (
                  <button key={p} onClick={() => { setGwActiveTab(p); setGwCredentials({}); setGwError('') }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize"
                    style={{
                      background: gwActiveTab === p ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                      border: gwActiveTab === p ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: gwActiveTab === p ? '#c4b5fd' : '#a1a1aa',
                    }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Webhook URL to paste into the provider's own dashboard */}
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs mb-2" style={{ color: '#a1a1aa' }}>
                  Add this as a webhook endpoint in your {gwActiveTab} dashboard, then paste the signing secret it gives you below:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#c4b5fd', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/${gwActiveTab}` : `/api/webhooks/${gwActiveTab}`}
                  </code>
                  <button onClick={handleCopyWebhookUrl} type="button"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0"
                    style={{
                      background: gwUrlCopied ? 'rgba(74,222,128,0.15)' : 'rgba(139,92,246,0.15)',
                      color: gwUrlCopied ? '#4ade80' : '#c4b5fd',
                    }}>
                    {gwUrlCopied ? <><CheckCircle2 className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </button>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-xs" style={{ color: '#a1a1aa' }}>Use test/sandbox keys first, switch to live when ready</span>
                <button onClick={() => setGwEnvironment(gwEnvironment === 'production' ? 'sandbox' : 'production')}
                  className="text-xs font-semibold px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                  {gwEnvironment === 'production' ? 'Live' : 'Sandbox'}
                </button>
              </div>

              {PROVIDER_FIELDS[gwActiveTab].map((field) => (
                <InputField key={field.key} label={field.label}
                  value={gwCredentials[field.key] || ''}
                  onChange={(v: string) => setGwCredentials({ ...gwCredentials, [field.key]: v })}
                  placeholder={field.placeholder} type="password" />
              ))}
              <InputField label="Webhook signing secret (required)"
                value={gwWebhookSecret} onChange={setGwWebhookSecret}
                placeholder="Paste from your provider's webhook settings" type="password" />

              <div className="mb-2 mt-1 p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#a1a1aa' }} />
                <p className="text-xs" style={{ color: '#a1a1aa' }}>
                  We verify these against {gwActiveTab}'s live API before saving — if they're wrong,
                  you'll know immediately, not after your first student tries to pay.
                </p>
              </div>

              {gwError && (
                <div className="mb-3 p-3 rounded-xl flex items-start gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-xs" style={{ color: '#fca5a5' }}>{gwError}</p>
                </div>
              )}

              <button onClick={handleSaveGateway}
                disabled={gwSaving || !gwWebhookSecret.trim() || PROVIDER_FIELDS[gwActiveTab].some((f) => !gwCredentials[f.key]?.trim())}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
                {gwSaving ? 'Verifying & saving...' : 'Verify & Connect'}
              </button>
            </>
          )}
        </SectionCard>
        <div className="mb-12" />

        {/* Danger Zone */}
        <div className="rounded-2xl p-6"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
            <h2 className="font-semibold" style={{ color: '#ef4444' }}>Danger Zone</h2>
          </div>
          <p className="text-sm mb-6" style={{ color: '#a1a1aa' }}>
            These actions are irreversible. Please read carefully.
          </p>

          {deleteStep === 'idle' && (
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div>
                <p className="text-sm font-semibold text-white">Delete Account</p>
                <p className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
                  All your data will be permanently deleted after a 7-day grace period.
                </p>
              </div>
              <button
                onClick={() => { setDeleteStep('confirm'); setDeleteApiError('') }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 ml-4 transition-all"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                <Trash2 className="w-4 h-4" />Delete
              </button>
            </div>
          )}

          {deleteStep === 'confirm' && (
            <div className="p-5 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-sm font-semibold text-white mb-1">Are you absolutely sure?</p>
              <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>
                Scheduling deletion will permanently remove after <strong className="text-white">7 days</strong>:
              </p>

              {/* What will be deleted */}
              <div className="mb-4 p-3 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                  Data that will be deleted
                </p>
                {[
                  'Your creator profile and account',
                  'All courses and lesson content',
                  'All student enrollments and progress',
                  'All payments and revenue records',
                  'All coupons and piracy reports',
                  'All email logs and Telegram tokens',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#a1a1aa' }}>{item}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm mb-3" style={{ color: '#a1a1aa' }}>
                Type <span className="font-mono font-bold text-white">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none mb-4 font-mono"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: deleteInput === 'DELETE'
                    ? '1px solid rgba(239,68,68,0.6)'
                    : '1px solid rgba(255,255,255,0.1)',
                }}
              />

              {deleteApiError && (
                <div className="mb-4 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {deleteApiError}
                </div>
              )}

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => { setDeleteStep('idle'); setDeleteInput(''); setDeleteApiError('') }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
                  <X className="w-4 h-4" />Cancel
                </button>
                <button
                  onClick={handleScheduleDelete}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}>
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Scheduling...' : 'Schedule Deletion'}
                </button>
              </div>

              {/* Contact link */}
              <p className="text-xs text-center" style={{ color: '#52525b' }}>
                Having second thoughts?{' '}
                <Link href="/contact" style={{ color: 'var(--kurso-primary-light)' }}>
                  Contact us
                </Link>
                {' '}and we can help.
              </p>
            </div>
          )}

          {deleteStep === 'scheduled' && deleteScheduledAt && (
            <div className="p-5 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="flex items-start gap-3 mb-4">
                <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Deletion Scheduled</p>
                  <p className="text-sm" style={{ color: '#a1a1aa' }}>
                    Your account and all data will be permanently deleted on{' '}
                    <strong className="text-white">
                      {deleteScheduledAt.toLocaleDateString('en-IN', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </strong>.
                  </p>
                </div>
              </div>

              {/* What will be deleted reminder */}
              <div className="mb-4 p-3 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>
                  Scheduled for deletion
                </p>
                {[
                  'Your creator profile and account',
                  'All courses and lesson content',
                  'All student enrollments and progress',
                  'All payments and revenue records',
                  'All coupons and piracy reports',
                  'All email logs and Telegram tokens',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                    <p className="text-xs" style={{ color: '#a1a1aa' }}>{item}</p>
                  </div>
                ))}
              </div>

              {deleteApiError && (
                <div className="mb-4 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {deleteApiError}
                </div>
              )}

              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                <X className="w-4 h-4" />
                {deleting ? 'Cancelling...' : 'Cancel Scheduled Deletion'}
              </button>

              {/* Contact link */}
              <p className="text-xs text-center mt-4" style={{ color: '#52525b' }}>
                If you have any issue you can{' '}
                <Link href="/contact" style={{ color: 'var(--kurso-primary-light)' }}>
                  contact us
                </Link>
                {' '}and we will help you.
              </p>
            </div>
          )}

          {deleteStep === 'cancelled' && (
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <Check className="w-5 h-5" style={{ color: '#4ade80' }} />
              <p className="text-sm" style={{ color: '#4ade80' }}>
                Deletion cancelled. Your account is safe.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

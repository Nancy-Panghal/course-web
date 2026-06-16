'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { User, Bell, Shield, AlertTriangle, Check, X, Trash2, Clock, MessageCircle, IndianRupee, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'

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
          onFocus={e => { if (!disabled) e.target.style.borderColor = '#7c3aed' }}
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
        style={{ background: value ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}>
        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? '24px' : '4px' }} />
      </button>
    </div>
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
          style={{ background: 'rgba(124,58,237,0.1)' }}>
          <Icon className="w-4 h-4" style={{ color: '#8b5cf6' }} />
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
    piracyDetected: true,
    courseCompletion: false,
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'scheduled' | 'cancelled'>('idle')
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteScheduledAt, setDeleteScheduledAt] = useState<Date | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteApiError, setDeleteApiError] = useState('')

  // ── Payout settings state ──────────────────────────────────────
  const [payoutToken, setPayoutToken] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(true)
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [payoutSuccess, setPayoutSuccess] = useState('')
  // Existing saved details (display only — masked)
  const [savedAccountHolder, setSavedAccountHolder] = useState('')
  const [savedBankLast4, setSavedBankLast4] = useState('')
  const [savedIfsc, setSavedIfsc] = useState('')
  const [savedUpiMasked, setSavedUpiMasked] = useState('')
  const [savedPanMasked, setSavedPanMasked] = useState('')
  const [savedPayoutStatus, setSavedPayoutStatus] = useState('not_set')
  // Form inputs
  const [payoutMode, setPayoutMode] = useState<'bank' | 'upi'>('bank')
  const [fAccountHolder, setFAccountHolder] = useState('')
  const [fAccountNumber, setFAccountNumber] = useState('')
  const [fIfsc, setFIfsc] = useState('')
  const [fUpiId, setFUpiId] = useState('')
  const [fPan, setFPan] = useState('')
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [showPan, setShowPan] = useState(false)
  // Payout history
  const [payouts, setPayouts] = useState<any[]>([])
  const [payoutsLoading, setPayoutsLoading] = useState(true)

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

  // ── Load payout settings + history ────────────────────────────
  useEffect(() => {
    async function loadPayout() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setPayoutToken(session.access_token)

      const [settingsRes, payoutsRes] = await Promise.all([
        fetch('/api/creator/payout-settings', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/creator/payouts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])

      if (settingsRes.ok) {
        const d = await settingsRes.json()
        setSavedAccountHolder(d.accountHolder || '')
        setSavedBankLast4(d.bankLast4 || '')
        setSavedIfsc(d.ifsc || '')
        setSavedUpiMasked(d.upiMasked || '')
        setSavedPanMasked(d.panMasked || '')
        setSavedPayoutStatus(d.status || 'not_set')
      }
      setPayoutLoading(false)

      if (payoutsRes.ok) {
        const d = await payoutsRes.json()
        setPayouts(d.payouts || [])
      }
      setPayoutsLoading(false)
    }
    loadPayout()
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

  async function handlePayoutSave() {
    setPayoutError('')
    setPayoutSuccess('')
    setPayoutSaving(true)
    try {
      const body: any = { pan: fPan.trim() || undefined }
      if (payoutMode === 'bank') {
        body.accountHolder = fAccountHolder.trim()
        body.bankAccountNumber = fAccountNumber.trim()
        body.ifsc = fIfsc.trim()
      } else {
        body.upiId = fUpiId.trim()
      }

      const res = await fetch('/api/creator/payout-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payoutToken}`,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) {
        setPayoutError(json.error || 'Failed to save payout details.')
        return
      }

      // Refresh display — clear sensitive form fields
      setSavedPayoutStatus('pending_verification')
      if (json.bankLast4) setSavedBankLast4(json.bankLast4)
      if (json.panMasked) setSavedPanMasked(json.panMasked)
      if (payoutMode === 'bank') {
        setSavedAccountHolder(fAccountHolder.trim())
        setSavedIfsc(fIfsc.trim().toUpperCase())
      }
      if (payoutMode === 'upi') setSavedUpiMasked(fUpiId.trim())

      // Clear sensitive fields from state immediately
      setFAccountNumber('')
      setFPan('')
      setShowAccountNumber(false)
      setShowPan(false)
      setPayoutSuccess('Payout details saved. We will verify and activate within 2 business days.')
    } catch {
      setPayoutError('Network error. Please try again.')
    } finally {
      setPayoutSaving(false)
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
      <main className="md:ml-56 p-6 md:p-8 max-w-3xl">

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
                  background: hasChanges ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                  color: hasChanges ? '#fff' : '#52525b',
                  border: '1px solid ' + (hasChanges ? '#7c3aed' : 'rgba(255,255,255,0.1)'),
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

        

        <SectionCard title="Telegram Delivery" icon={MessageCircle}>
          <div className="p-4 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-sm font-medium text-white mb-1">Telegram delivery is managed centrally.</p>
            <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
              Your students can access lessons on Telegram after enrollment. No setup needed — the shared AcademyKit bot handles delivery automatically.
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
            label="Piracy detected"
            desc="Email me when a piracy threat is detected"
            value={emailNotifications.piracyDetected}
            onChange={v => updateEmailNotificationSetting('piracyDetected', v)}
          />
          <Toggle
            label="Course completion"
            desc="Email me when a student completes a course"
            value={emailNotifications.courseCompletion}
            onChange={v => updateEmailNotificationSetting('courseCompletion', v)}
          />
        </SectionCard>

        <div className="mb-12" />

        {/* ── Payout Settings ── */}
        <SectionCard title="Payout Settings" icon={IndianRupee}>
          {payoutLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Current status banner */}
              {savedPayoutStatus !== 'not_set' && (
                <div className="mb-5 flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: savedPayoutStatus === 'active'
                      ? 'rgba(74,222,128,0.08)' : 'rgba(245,158,11,0.08)',
                    border: savedPayoutStatus === 'active'
                      ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  }}>
                  {savedPayoutStatus === 'active'
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                  }
                  <div>
                    <p className="text-sm font-medium text-white">
                      {savedPayoutStatus === 'active' ? 'Payout account active' : 'Pending verification'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
                      {savedPayoutStatus === 'active'
                        ? `Account ••••${savedBankLast4 || savedUpiMasked} · ${savedIfsc || 'UPI'}`
                        : 'We will verify your details within 2 business days.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Saved summary */}
              {savedPayoutStatus !== 'not_set' && (
                <div className="mb-5 p-4 rounded-xl flex flex-col gap-2"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-semibold text-white mb-1">Saved details</p>
                  {savedAccountHolder && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#71717a' }}>Account holder</span>
                      <span className="text-white">{savedAccountHolder}</span>
                    </div>
                  )}
                  {savedBankLast4 && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#71717a' }}>Account number</span>
                      <span className="text-white font-mono">••••{savedBankLast4}</span>
                    </div>
                  )}
                  {savedIfsc && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#71717a' }}>IFSC</span>
                      <span className="text-white font-mono">{savedIfsc}</span>
                    </div>
                  )}
                  {savedUpiMasked && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#71717a' }}>UPI ID</span>
                      <span className="text-white font-mono">{savedUpiMasked}</span>
                    </div>
                  )}
                  {savedPanMasked && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: '#71717a' }}>PAN</span>
                      <span className="text-white font-mono">{savedPanMasked}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['bank', 'upi'] as const).map(mode => (
                  <button key={mode} type="button"
                    onClick={() => { setPayoutMode(mode); setPayoutError(''); setPayoutSuccess('') }}
                    className="py-2.5 rounded-xl text-sm font-medium transition-all capitalize"
                    style={{
                      background: payoutMode === mode ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                      border: payoutMode === mode ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      color: payoutMode === mode ? '#8b5cf6' : '#a1a1aa',
                    }}>
                    {mode === 'bank' ? '🏦 Bank Account' : '📱 UPI ID'}
                  </button>
                ))}
              </div>

              {/* Bank form */}
              {payoutMode === 'bank' && (
                <div className="flex flex-col gap-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                      Account Holder Name (as on bank account) *
                    </label>
                    <input value={fAccountHolder} onChange={e => setFAccountHolder(e.target.value)}
                      placeholder="Full name exactly as on bank account"
                      autoComplete="off"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                      Bank Account Number *
                    </label>
                    <div className="relative">
                      <input
                        value={fAccountNumber}
                        onChange={e => setFAccountNumber(e.target.value.replace(/\D/g, ''))}
                        type={showAccountNumber ? 'text' : 'password'}
                        placeholder="Enter account number"
                        autoComplete="new-password"
                        maxLength={18}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white outline-none focus:border-violet-500/50 font-mono"
                      />
                      <button type="button"
                        onClick={() => setShowAccountNumber(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: '#52525b' }}>
                        {showAccountNumber
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: '#52525b' }}>
                      Only the last 4 digits are stored. The full number is never saved.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">IFSC Code *</label>
                    <input value={fIfsc} onChange={e => setFIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      maxLength={11}
                      autoComplete="off"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 font-mono uppercase" />
                  </div>
                </div>
              )}

              {/* UPI form */}
              {payoutMode === 'upi' && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-zinc-500 mb-1.5 block">UPI ID *</label>
                  <input value={fUpiId} onChange={e => setFUpiId(e.target.value)}
                    placeholder="yourname@upi or yourname@okicici"
                    autoComplete="off"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 font-mono" />
                </div>
              )}

              {/* PAN (required for KYC — both modes) */}
              <div className="mb-4">
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                  PAN Number (required for KYC)
                  {savedPanMasked && (
                    <span className="ml-2 text-violet-400">— saved as {savedPanMasked}</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    value={fPan}
                    onChange={e => setFPan(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    type={showPan ? 'text' : 'password'}
                    placeholder={savedPanMasked ? 'Enter to update PAN' : 'ABCDE1234F'}
                    maxLength={10}
                    autoComplete="new-password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white outline-none focus:border-violet-500/50 font-mono uppercase"
                  />
                  <button type="button"
                    onClick={() => setShowPan(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#52525b' }}>
                    {showPan
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: '#52525b' }}>
                  Required by Razorpay for payout KYC. Stored masked — the raw PAN is never saved.
                </p>
              </div>

              {/* Security note */}
              <div className="mb-4 p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#38bdf8' }} />
                <p className="text-xs" style={{ color: '#a1a1aa' }}>
                  Your financial details are encrypted in transit (HTTPS). Full account numbers and raw PAN are never stored — only masked references used for display.
                </p>
              </div>

              {payoutError && (
                <div className="mb-3 p-3 rounded-xl flex items-start gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-xs" style={{ color: '#fca5a5' }}>{payoutError}</p>
                </div>
              )}

              {payoutSuccess && (
                <div className="mb-3 p-3 rounded-xl flex items-start gap-2"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                  <p className="text-xs" style={{ color: '#86efac' }}>{payoutSuccess}</p>
                </div>
              )}

              <button onClick={handlePayoutSave} disabled={payoutSaving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
                {payoutSaving ? 'Saving...' : savedPayoutStatus !== 'not_set' ? 'Update Payout Details' : 'Save Payout Details'}
              </button>
            </>
          )}

          {/* Payout history */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-white mb-3">Payout History</p>
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payouts.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: '#52525b' }}>
                No payouts yet. Once Razorpay Route is active, your earnings will appear here.
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#52525b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="col-span-3">Date</div>
                  <div className="col-span-3">Gross</div>
                  <div className="col-span-2">Fee</div>
                  <div className="col-span-2">Net</div>
                  <div className="col-span-2">Status</div>
                </div>
                {payouts.map((p: any, i: number) => (
                  <div key={p.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs"
                    style={{ borderBottom: i < payouts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div className="col-span-3" style={{ color: '#a1a1aa' }}>
                      {new Date(p.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </div>
                    <div className="col-span-3 text-white font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</div>
                    <div className="col-span-2" style={{ color: '#f59e0b' }}>₹{Number(p.platform_fee).toLocaleString('en-IN')}</div>
                    <div className="col-span-2 font-semibold" style={{ color: '#4ade80' }}>
                      ₹{Number(p.net_amount ?? p.amount - p.platform_fee).toLocaleString('en-IN')}
                    </div>
                    <div className="col-span-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={
                          p.status === 'paid'
                            ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }
                            : p.status === 'failed'
                            ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                            : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
                        }>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <Link href="/contact" style={{ color: '#8b5cf6' }}>
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
                <Link href="/contact" style={{ color: '#8b5cf6' }}>
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

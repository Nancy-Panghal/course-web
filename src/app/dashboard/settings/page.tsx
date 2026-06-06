'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { User, Bell, Shield, AlertTriangle, Check, X, Trash2, Clock, MessageCircle } from 'lucide-react'

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
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [originalWhatsappNumber, setOriginalWhatsappNumber] = useState('')
  const [telegramBotUsername, setTelegramBotUsername] = useState('')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [originalTelegramBotUsername, setOriginalTelegramBotUsername] = useState('')
  const [originalTelegramBotToken, setOriginalTelegramBotToken] = useState('')
  const [notifications, setNotifications] = useState({
    piracy: true,
    enrollment: true,
    completion: false,
    payment: true,
    login: true,
  })
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

  const hasChanges =
    name !== originalName ||
    whatsappNumber !== originalWhatsappNumber ||
    telegramBotUsername !== originalTelegramBotUsername ||
    telegramBotToken !== originalTelegramBotToken

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

        const wa = creator?.[0]?.whatsapp_number || ''
        const tgUsername = creator?.[0]?.telegram_bot_username || ''
        const tgToken = creator?.[0]?.telegram_bot_token || ''
        setWhatsappNumber(wa)
        setOriginalWhatsappNumber(wa)
        setTelegramBotUsername(tgUsername)
        setOriginalTelegramBotUsername(tgUsername)
        setTelegramBotToken(tgToken)
        setOriginalTelegramBotToken(tgToken)
        // Restore scheduled deletion state if already scheduled
        if (creator?.[0]?.scheduled_deletion_at) {
          const scheduledDate = new Date(creator[0].scheduled_deletion_at)
          if (scheduledDate > new Date()) {
            setDeleteScheduledAt(scheduledDate)
            setDeleteStep('scheduled')
          }
        }
      }


      // Load notifications from metadata if they exist
      if (u?.user_metadata?.notifications) {
        setNotifications(current => ({ ...current, ...u.user_metadata.notifications }))
      }
      if (u?.user_metadata?.email_notifications) {
        setEmailNotifications(current => ({ ...current, ...u.user_metadata.email_notifications }))
      }
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const cleanWhatsapp = whatsappNumber.trim().replace(/[\s+\-()]/g, '')
    const cleanTelegramUsername = telegramBotUsername.trim().replace(/^@/, '')
    const cleanTelegramToken = telegramBotToken.trim()
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
        whatsapp_number: cleanWhatsapp || null,
        telegram_bot_username: cleanTelegramUsername || null,
        telegram_bot_token: cleanTelegramToken || null,
      })

    if (!error && !creatorError) {
      setOriginalName(name)
      setWhatsappNumber(cleanWhatsapp)
      setOriginalWhatsappNumber(cleanWhatsapp)
      setTelegramBotUsername(cleanTelegramUsername)
      setOriginalTelegramBotUsername(cleanTelegramUsername)
      setTelegramBotToken(cleanTelegramToken)
      setOriginalTelegramBotToken(cleanTelegramToken)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  async function updateNotificationSetting(key: string, value: boolean) {
    const nextNotifications = { ...notifications, [key]: value }
    setNotifications(nextNotifications)

    // Save to database immediately
    await supabase.auth.updateUser({
      data: {
        notifications: nextNotifications
      }
    })
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

        <SectionCard title="WhatsApp Delivery" icon={MessageCircle}>
          <InputField
            label="WhatsApp Cloud API Sender Number"
            value={whatsappNumber}
            onChange={setWhatsappNumber}
            placeholder="Example: 15551234567 or 919876543210"
          />
          <div className="p-4 rounded-xl"
            style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.15)' }}>
            <p className="text-sm font-medium text-white mb-1">Use your Meta test number here while testing.</p>
            <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
              Paste the WhatsApp sender number connected to your Meta Cloud API app, with country code and no plus sign.
              Once saved, course enroll modals can show “Start Free Lessons on WhatsApp” or “Join via WhatsApp”.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient disabled:opacity-40"
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save WhatsApp Settings'}
          </button>
        </SectionCard>

        <SectionCard title="Telegram Delivery" icon={MessageCircle}>
          <InputField
            label="Telegram Bot Username"
            value={telegramBotUsername}
            onChange={setTelegramBotUsername}
            placeholder="Example: AcademyKitDemoBot"
          />
          <InputField
            label="Telegram Bot Token"
            value={telegramBotToken}
            onChange={setTelegramBotToken}
            placeholder="Paste token from BotFather"
            type="password"
          />
          <div className="p-4 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <p className="text-sm font-medium text-white mb-1">Telegram is the MVP chat channel.</p>
            <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
              Create a bot in BotFather, paste its username and token here, then deploy the Telegram bot service with the same token.
              Students will see a “Start on Telegram” button after free signup or successful Razorpay payment.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient disabled:opacity-40"
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Telegram Settings'}
          </button>
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notification Bar" icon={Bell}>
          <Toggle
            label="Payment updates"
            desc="Show short sale alerts in the dashboard notification bar"
            value={notifications.payment}
            onChange={v => updateNotificationSetting('payment', v)}
          />
          <Toggle
            label="Login activity"
            desc="Show recent sign-in activity in the notification bar"
            value={notifications.login}
            onChange={v => updateNotificationSetting('login', v)}
          />
          <Toggle
            label="Piracy detected"
            desc="Show piracy alerts in the notification bar"
            value={notifications.piracy}
            onChange={v => updateNotificationSetting('piracy', v)}
          />
          <Toggle
            label="New enrollment"
            desc="Show student enrollment updates"
            value={notifications.enrollment}
            onChange={v => updateNotificationSetting('enrollment', v)}
          />
          <Toggle
            label="Course completion"
            desc="Show course completion updates"
            value={notifications.completion}
            onChange={v => updateNotificationSetting('completion', v)}
          />
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

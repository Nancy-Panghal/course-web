// src/app/dashboard/workshops/page.tsx
'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { Plus, Calendar, Users, Check, ExternalLink } from 'lucide-react'

interface Workshop {
  id: string
  title: string
  slug: string
  date_time: string
  price: number
  capacity: number | null
  status: string
}

interface Registration {
  id: string
  name: string
  email: string | null
  phone: string
  payment_mode: string
  payment_status: string
  utr_reference: string | null
  amount_paid: number | null
}

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [creatorSlug, setCreatorSlug] = useState('')
  const [token, setToken] = useState('')

  // UPI settings
  const [upiId, setUpiId] = useState('')
  const [upiDisplayName, setUpiDisplayName] = useState('')
  const [upiSaving, setUpiSaving] = useState(false)
  const [upiSaved, setUpiSaved] = useState(false)

  // Payment reminders (WhatsApp nudges to unpaid registrants)
  const [nudgeEnabled, setNudgeEnabled] = useState(false)
  const [nudgeSavedEnabled, setNudgeSavedEnabled] = useState(false)
  const [nudgeNote, setNudgeNote] = useState('')
  const [nudgeSaving, setNudgeSaving] = useState(false)
  const [nudgeSaved, setNudgeSaved] = useState(false)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [price, setPrice] = useState('0')
  const [capacity, setCapacity] = useState('')
  const [zoomLink, setZoomLink] = useState('')

  // Expanded registrations per workshop
  const [expanded, setExpanded] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<Record<string, Registration[]>>({})
  const [confirming, setConfirming] = useState<string | null>(null)

  // Referral stats: confirmed-via-student-link count per workshop, and who referred each registration
  const [referralCounts, setReferralCounts] = useState<Record<string, number>>({})
  const [referredBy, setReferredBy] = useState<Record<string, string>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      setToken(session.access_token)
      loadReferralStats(session.access_token)
    }

    const { data: creator } = await supabase
      .from('creators')
      .select('creator_slug, upi_id, upi_display_name, nudge_enabled, nudge_note')
      .eq('id', user.id)
      .maybeSingle()
    if (creator) {
      setCreatorSlug(creator.creator_slug || '')
      setUpiId(creator.upi_id || '')
      setUpiDisplayName(creator.upi_display_name || '')
      setNudgeEnabled(!!creator.nudge_enabled)
      setNudgeSavedEnabled(!!creator.nudge_enabled)
      setNudgeNote(creator.nudge_note || '')
    }

    const { data } = await supabase
      .from('workshops')
      .select('id, title, slug, date_time, price, capacity, status')
      .eq('creator_id', user.id)
      .order('date_time', { ascending: false })

    setWorkshops(data || [])
    setLoading(false)
  }

  async function loadReferralStats(accessToken: string) {
    try {
      const res = await fetch('/api/workshops/referrals', { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) return
      const data = await res.json()
      setReferralCounts(data.counts || {})
      setReferredBy(data.referredBy || {})
    } catch {
      // Stats are a bonus — the page works without them.
    }
  }

  async function handleSaveUpi() {
    setUpiSaving(true)
    setUpiSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUpiSaving(false); return }
    const { error } = await supabase
      .from('creators')
      .update({ upi_id: upiId.trim() || null, upi_display_name: upiDisplayName.trim() || null })
      .eq('id', user.id)
    setUpiSaving(false)
    if (!error) { setUpiSaved(true); setTimeout(() => setUpiSaved(false), 2000) }
  }

  async function handleSaveNudge() {
    setNudgeSaving(true)
    setNudgeSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNudgeSaving(false); return }
    // Turning reminders ON stamps the moment — only registrations made after it are ever nudged.
    const turningOn = nudgeEnabled && !nudgeSavedEnabled
    const { error } = await supabase
      .from('creators')
      .update({
        nudge_enabled: nudgeEnabled,
        nudge_note: nudgeNote.replace(/\s+/g, ' ').trim() || null,
        ...(turningOn ? { nudge_enabled_at: new Date().toISOString() } : {}),
      })
      .eq('id', user.id)
    setNudgeSaving(false)
    if (!error) {
      setNudgeSavedEnabled(nudgeEnabled)
      setNudgeSaved(true)
      setTimeout(() => setNudgeSaved(false), 2000)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    if (!title.trim() || !dateTime) {
      setCreateError('Title and date/time are required')
      return
    }
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }

    const baseSlug = slugify(title)
    const { data: existingSlug } = await supabase
      .from('workshops')
      .select('id')
      .eq('creator_id', user.id)
      .eq('slug', baseSlug)
      .maybeSingle()
    const finalSlug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug

    const { error } = await supabase.from('workshops').insert({
      creator_id: user.id,
      title: title.trim(),
      slug: finalSlug,
      description: description.trim() || null,
      date_time: new Date(dateTime).toISOString(),
      price: parseInt(price) || 0,
      capacity: capacity ? parseInt(capacity) : null,
      zoom_link: zoomLink.trim() || null,
      status: 'published',
    })

    setCreating(false)
    if (error) { setCreateError(error.message); return }

    setTitle(''); setDescription(''); setDateTime(''); setPrice('0'); setCapacity(''); setZoomLink('')
    setShowCreate(false)
    load()
  }

  async function toggleExpand(workshopId: string) {
    if (expanded === workshopId) { setExpanded(null); return }
    setExpanded(workshopId)
    if (!registrations[workshopId]) {
      const { data } = await supabase
        .from('workshop_registrations')
        .select('id, name, email, phone, payment_mode, payment_status, utr_reference, amount_paid')
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false })
      setRegistrations(prev => ({ ...prev, [workshopId]: data || [] }))
    }
  }

  async function handleMarkPaid(workshopId: string, registrationId: string) {
    if (!token) return
    setConfirming(registrationId)
    try {
      const res = await fetch('/api/workshops/registrations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ registrationId }),
      })
      if (res.ok) {
        setRegistrations(prev => ({
          ...prev,
          [workshopId]: prev[workshopId].map(r => r.id === registrationId ? { ...r, payment_status: 'confirmed' } : r),
        }))
        loadReferralStats(token)
      }
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8 pt-20 md:pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Workshops</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              {workshops.length} workshop{workshops.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <button onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow">
            <Plus className="w-4 h-4" />
            New Workshop
          </button>
        </div>

        {/* UPI settings */}
        <div className="rounded-2xl p-5 mb-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold text-white mb-3">UPI payout details</h3>
          <p className="text-xs mb-3" style={{ color: '#71717a' }}>
            Used to show students where to pay for paid workshops. This isn't a payment gateway — students pay you
            directly and you confirm manually once you see it land.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              value={upiId} onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <input
              value={upiDisplayName} onChange={e => setUpiDisplayName(e.target.value)}
              placeholder="Display name (shown to students)"
              className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <button onClick={handleSaveUpi} disabled={upiSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(var(--kurso-primary-rgb), 0.18)', color: 'var(--kurso-primary-lightest)', border: '1px solid rgba(var(--kurso-primary-rgb), 0.3)' }}>
            {upiSaving ? 'Saving…' : upiSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {/* Payment reminders */}
        <div className="rounded-2xl p-5 mb-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Payment reminders</h3>
              <p className="text-xs mt-1" style={{ color: '#71717a' }}>
                Sends up to 2 WhatsApp reminders (about 2 hours and 24 hours after they register) to people who signed up
                for a paid workshop but haven't paid. Only sent between 9am and 9pm IST, and never to someone who has
                already submitted a UTR. Applies to registrations made after you switch this on.
              </p>
            </div>
            <button type="button" onClick={() => setNudgeEnabled(v => !v)}
              aria-pressed={nudgeEnabled}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={nudgeEnabled
                ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
                : { background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }}>
              {nudgeEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <input
            value={nudgeNote} onChange={e => setNudgeNote(e.target.value)} maxLength={120}
            placeholder="Optional note in the message, e.g. Seats are filling fast"
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none mb-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <p className="text-xs mb-3" style={{ color: '#52525b' }}>
            The rest of the message wording is fixed (WhatsApp requires pre-approved templates). {nudgeNote.length}/120
          </p>
          <button onClick={handleSaveNudge} disabled={nudgeSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(var(--kurso-primary-rgb), 0.18)', color: 'var(--kurso-primary-lightest)', border: '1px solid rgba(var(--kurso-primary-rgb), 0.3)' }}>
            {nudgeSaving ? 'Saving…' : nudgeSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-2xl p-5 mb-6 glass space-y-3" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Workshop title" required
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required
                className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="Price (₹, 0 = free)"
                className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Capacity (optional)"
                className="px-4 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <input value={zoomLink} onChange={e => setZoomLink(e.target.value)} placeholder="Zoom link"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            {createError && <p className="text-xs" style={{ color: '#ef4444' }}>{createError}</p>}
            <button type="submit" disabled={creating}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
              {creating ? 'Creating…' : 'Publish workshop'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : workshops.length === 0 ? (
          <div className="rounded-2xl p-16 text-center glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <Calendar className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--kurso-primary-light)' }} />
            <h3 className="text-lg font-semibold text-white mb-2">No workshops yet</h3>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>Create your first live workshop above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workshops.map(w => {
              const registerUrl = `/w/${creatorSlug}/${w.slug}`
              const pending = (registrations[w.id] || []).filter(r => r.payment_status === 'pending_confirmation')
              return (
                <div key={w.id} className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-white">{w.title}</h3>
                      <p className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
                        {new Date(w.date_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        {' · '}{w.price > 0 ? `₹${w.price}` : 'Free'}
                        {w.capacity != null ? ` · cap ${w.capacity}` : ''}
                        {referralCounts[w.id] ? ` · ${referralCounts[w.id]} referred by students` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={registerUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                        <ExternalLink className="w-3.5 h-3.5" /> View page
                      </a>
                      <button onClick={() => toggleExpand(w.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                        style={{ background: 'rgba(var(--kurso-primary-rgb), 0.15)', color: 'var(--kurso-primary-light)' }}>
                        <Users className="w-3.5 h-3.5" /> {expanded === w.id ? 'Hide' : 'Registrations'}
                      </button>
                    </div>
                  </div>

                  {expanded === w.id && (
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {(registrations[w.id] || []).length === 0 ? (
                        <p className="text-xs" style={{ color: '#52525b' }}>No registrations yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(registrations[w.id] || []).map(r => (
                            <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl flex-wrap"
                              style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <div className="min-w-0">
                                <p className="text-sm text-white truncate">{r.name} · {r.phone}</p>
                                <p className="text-xs" style={{ color: '#71717a' }}>
                                  {r.payment_mode}{r.utr_reference ? ` · UTR ${r.utr_reference}` : ''}{r.amount_paid ? ` · ₹${r.amount_paid} paid online` : ''}{referredBy[r.id] ? ` · referred by ${referredBy[r.id]}` : ''}
                                </p>
                              </div>
                              {r.payment_status === 'confirmed' ? (
                                <span className="text-xs flex items-center gap-1" style={{ color: '#4ade80' }}>
                                  <Check className="w-3.5 h-3.5" /> Confirmed
                                </span>
                              ) : r.payment_status === 'pending_confirmation' ? (
                                <button onClick={() => handleMarkPaid(w.id, r.id)} disabled={confirming === r.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                                  style={{ background: 'rgba(var(--kurso-primary-rgb), 0.18)', color: 'var(--kurso-primary-lightest)' }}>
                                  {confirming === r.id ? 'Confirming…' : 'Mark Paid'}
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
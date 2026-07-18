'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { LANDING_THEMES, DEFAULT_LANDING_THEME_ID, getLandingTheme, type LandingThemeId } from '@/lib/landing-themes'
import CountdownTimer from '@/components/CountdownTimer'
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Image as ImageIcon, X, Eye, EyeOff,
  Layout, Palette, Plus, Trash2, Type, Lock, Gift, AlertTriangle, Timer,
} from 'lucide-react'
import {
  DEFAULT_LANDING_CONFIG, normalizeLandingConfig, LANDING_SECTION_META, LANDING_SECTION_TYPES,
  type LandingConfig, type LandingSectionType,
} from '@/lib/landing-config'

async function uploadToSupabase(file: File, folder: string): Promise<{ publicUrl: string }> {
  const ext = file.name.split('.').pop()
  const safeName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('lessons')
    .upload(safeName, file, { cacheControl: '3600', upsert: false })
  if (uploadError) throw new Error(uploadError.message)
  const { data } = supabase.storage.from('lessons').getPublicUrl(safeName)
  return { publicUrl: data.publicUrl }
}

// Font pairing options (separate from theme — lets creator override heading/body fonts)
const FONT_PAIRS = [
  { id: 'theme-default',  label: 'Theme Default',     desc: 'Uses the font included with your theme' },
  { id: 'playfair-dm',    label: 'Playfair · DM Sans', desc: 'Elegant serif + clean modern sans' },
  { id: 'fraunces-inter', label: 'Fraunces · Inter',   desc: 'Editorial serif + versatile sans' },
  { id: 'space-inter',    label: 'Space Grotesk · Inter', desc: 'Techy geometric headings' },
  { id: 'outfit-inter',   label: 'Outfit · Inter',     desc: 'Friendly rounded headings' },
  { id: 'dm-inter',       label: 'DM Serif · Inter',   desc: 'Compact serif + crisp body' },
] as const

type FontPairId = (typeof FONT_PAIRS)[number]['id']

// Section types that are always shown and pinned to the top/bottom of the page —
// they're excluded from the reorderable middle list, matching exactly how the
// live renderer treats them (see about-course page.tsx: hero + finalCta are
// rendered fixed, only the sections between them respect creator ordering).
const PINNED_TOP: LandingSectionType = 'hero'
const PINNED_BOTTOM: LandingSectionType = 'finalCta'

export default function LandingPageDesigner({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  const [courseName, setCourseName] = useState('')
  const [hostName, setHostName] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<LandingThemeId>(DEFAULT_LANDING_THEME_ID)
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG)
  const [fontPair, setFontPair] = useState<FontPairId>('theme-default')
  const [activeTab, setActiveTab] = useState<'theme' | 'sections' | 'fonts'>('theme')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not signed in.'); setLoading(false); return }

      const { data: course } = await supabase
        .from('courses')
        .select('id, name, host_name, landing_theme, brand_logo_url, landing_sections, landing_config, landing_font_pair')
        .eq('id', courseId)
        .eq('creator_id', user.id)
        .single()

      if (!course) { setError('Could not load this course.'); setLoading(false); return }

      setCourseName(course.name)
      setHostName(course.host_name || '')
      setSelectedTheme((course.landing_theme as LandingThemeId) || DEFAULT_LANDING_THEME_ID)
      setBrandLogoUrl(course.brand_logo_url || '')
      setLandingConfig(normalizeLandingConfig(course.landing_config, course.landing_sections || {}))
      setFontPair((course.landing_font_pair as FontPairId) || 'theme-default')
      setLoading(false)
    }
    load()
  }, [courseId])

  const previewUrl = (themeId: LandingThemeId) =>
    `/about-course/${slugify(hostName || 'instructor')}/${slugify(courseName)}/${courseId}?theme=${themeId}`

  function updateSectionEnabled(type: LandingSectionType, enabled: boolean) {
    setLandingConfig(prev => ({ ...prev, sections: prev.sections.map(s => s.type === type ? { ...s, enabled } : s) }))
  }

  // Moves a section within the reorderable MIDDLE list only (hero/finalCta stay pinned).
  function moveSection(type: LandingSectionType, direction: -1 | 1) {
    setLandingConfig(prev => {
      const middleTypes = prev.sections.map(s => s.type).filter(t => t !== PINNED_TOP && t !== PINNED_BOTTOM)
      const idx = middleTypes.indexOf(type)
      const nextIdx = idx + direction
      if (idx === -1 || nextIdx < 0 || nextIdx >= middleTypes.length) return prev
      ;[middleTypes[idx], middleTypes[nextIdx]] = [middleTypes[nextIdx], middleTypes[idx]]

      const byType = new Map(prev.sections.map(s => [s.type, s]))
      const newOrder: LandingSectionType[] = [PINNED_TOP, ...middleTypes, PINNED_BOTTOM]
      return { ...prev, sections: newOrder.map(t => byType.get(t)!) }
    })
  }

  function updateBonus(index: number, field: 'title' | 'description', value: string) {
    setLandingConfig(prev => ({ ...prev, bonuses: prev.bonuses.map((b, i) => i === index ? { ...b, [field]: value } : b) }))
  }
  function addBonus() {
    setLandingConfig(prev => ({ ...prev, bonuses: [...prev.bonuses, { title: '', description: '' }] }))
  }
  function removeBonus(index: number) {
    setLandingConfig(prev => ({ ...prev, bonuses: prev.bonuses.filter((_, i) => i !== index) }))
  }

  function updateDisclaimer(field: 'title' | 'text', value: string) {
    setLandingConfig(prev => ({ ...prev, disclaimer: { ...prev.disclaimer, [field]: value } }))
  }

  function updateUrgency(field: 'endAt' | 'label' | 'seatsLabel', value: string): void
  function updateUrgency(field: 'seatsAvailable', value: number | null): void
  function updateUrgency(field: any, value: any) {
    setLandingConfig(prev => ({ ...prev, urgency: { ...prev.urgency, [field]: value } }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be 2MB or smaller.'); return }
    setUploadingLogo(true)
    setError('')
    try {
      const { publicUrl } = await uploadToSupabase(file, 'brand-logos')
      setBrandLogoUrl(publicUrl)
    } catch (err: any) {
      setError(err.message || 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    // Basic client-side validation so a creator can't save something that'll
    // silently render wrong — e.g. a bonus with no title, or a disclaimer
    // enabled with no text.
    const cleanedBonuses = landingConfig.bonuses.map(b => ({ title: b.title.trim(), description: b.description.trim() })).filter(b => b.title.length > 0)
    const configToSave: LandingConfig = { ...landingConfig, bonuses: cleanedBonuses }

    // Mirror into the legacy flat column too, purely for backwards
    // compatibility with anything that might still read it directly.
    const legacyMirror: Record<string, boolean> = {}
    for (const s of configToSave.sections) legacyMirror[s.type] = s.enabled

    const { error: updateError } = await supabase
      .from('courses')
      .update({
        landing_theme: selectedTheme,
        brand_logo_url: brandLogoUrl || null,
        landing_sections: legacyMirror,
        landing_config: configToSave,
        landing_font_pair: fontPair === 'theme-default' ? null : fontPair,
      })
      .eq('id', courseId)

    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    setLandingConfig(configToSave)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const middleSections = landingConfig.sections.filter(s => s.type !== PINNED_TOP && s.type !== PINNED_BOTTOM)
  const enabledCount = landingConfig.sections.filter(s => s.enabled).length

  if (loading) {
    return <div className="w-32 h-6 rounded bg-white/5 animate-pulse" />
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header — course name already shown by the parent course page, this is just the live-preview link */}
      <div className="flex items-center justify-end">
        <a href={previewUrl(selectedTheme)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ExternalLink className="w-3.5 h-3.5" /> Preview Live
        </a>
      </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {([
            { id: 'theme',    label: 'Theme & Colors',  icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'sections', label: 'Page Sections',   icon: <Layout   className="w-3.5 h-3.5" /> },
            { id: 'fonts',    label: 'Font Style',      icon: <Type     className="w-3.5 h-3.5" /> },
          ] as const).map(tab => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: activeTab === tab.id ? 'var(--kurso-primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#71717a',
              }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6">

          {/* ── BRAND LOGO (always visible) ── */}
          <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-1">Brand Logo</h2>
            <p className="text-xs mb-4" style={{ color: '#71717a' }}>
              Shown in the landing page nav next to your brand name. When a logo is uploaded, both the logo image
              and your brand/instructor name appear together.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {brandLogoUrl
                  ? <img src={brandLogoUrl} alt="Brand logo" className="w-full h-full object-contain" />
                  : <ImageIcon className="w-5 h-5 text-zinc-600" />}
              </div>
              <div className="flex-1">
                <input type="file" accept="image/png,image/jpeg,image/webp" id="brand-logo"
                  className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                <label htmlFor="brand-logo"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10 transition-all">
                  {uploadingLogo ? 'Uploading...' : brandLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                </label>
                {brandLogoUrl && (
                  <button onClick={() => setBrandLogoUrl('')}
                    className="ml-2 text-xs text-zinc-500 hover:text-red-500 inline-flex items-center gap-1">
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
                <p className="text-[10px] text-zinc-500 mt-1.5">PNG/JPG/WebP · transparent background recommended · max 2 MB</p>
              </div>
            </div>
          </div>

          {/* ── TAB: THEME ── */}
          {activeTab === 'theme' && (
            <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-semibold text-white mb-1">Choose a Theme</h2>
              <p className="text-xs mb-5" style={{ color: '#71717a' }}>
                Themes control the full color palette, background, and heading font. Use "Preview" to see it live
                with your real course data before saving.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {LANDING_THEMES.map(t => {
                  const active = selectedTheme === t.id
                  return (
                    <div key={t.id}
                      className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
                      style={{
                        background: active ? 'rgba(var(--kurso-primary-rgb), 0.1)' : 'rgba(255,255,255,0.03)',
                        border: active ? '2px solid rgba(var(--kurso-primary-rgb), 0.5)' : '1px solid rgba(255,255,255,0.08)',
                      }}>

                      {/* Color swatch */}
                      <div className="w-full h-16 rounded-xl overflow-hidden flex" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {t.swatch.map((hex, i) => (
                          <div key={i} style={{ background: hex, flex: 1 }} />
                        ))}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{t.name}</p>
                          {active && (
                            <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--kurso-primary)' }}>
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{t.tagline}</p>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedTheme(t.id)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: active ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.06)', color: active ? '#fff' : '#a1a1aa' }}>
                          {active ? 'Selected' : 'Select'}
                        </button>
                        <a href={previewUrl(t.id)} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                          <ExternalLink className="w-3 h-3" /> Preview
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TAB: SECTIONS ── */}
          {activeTab === 'sections' && (
            <>
              <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold text-white">Page Sections & Order</h2>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(var(--kurso-primary-rgb), 0.15)', color: 'var(--kurso-primary-lighter)' }}>
                    {enabledCount} / {LANDING_SECTION_TYPES.length} visible
                  </span>
                </div>
                <p className="text-xs mb-5" style={{ color: '#71717a' }}>
                  Use the arrows to reorder sections — the live page renders them top to bottom in this order.
                  Toggle a section off to hide it. Hero and Final CTA are pinned to the top and bottom so every
                  page keeps a clear start and a working buy button.
                </p>

                <div className="flex flex-col gap-2">
                  {/* Pinned: Hero */}
                  <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Lock className="w-4 h-4 flex-shrink-0" style={{ color: '#52525b' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#a1a1aa' }}>{LANDING_SECTION_META.hero.label} <span style={{ color: '#52525b', fontWeight: 400 }}>· always first</span></p>
                      <p className="text-xs" style={{ color: '#52525b' }}>{LANDING_SECTION_META.hero.description}</p>
                    </div>
                  </div>

                  {/* Reorderable middle sections */}
                  {middleSections.map((section, i) => {
                    const meta = LANDING_SECTION_META[section.type]
                    const on = section.enabled
                    return (
                      <div key={section.type}
                        className="flex items-center gap-3 p-4 rounded-xl transition-all"
                        style={{
                          background: on ? 'rgba(var(--kurso-primary-rgb), 0.06)' : 'rgba(255,255,255,0.02)',
                          border: on ? '1px solid rgba(var(--kurso-primary-rgb), 0.2)' : '1px solid rgba(255,255,255,0.06)',
                        }}>
                        {/* Reorder arrows */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button type="button" onClick={() => moveSection(section.type, -1)} disabled={i === 0}
                            className="w-6 h-5 rounded flex items-center justify-center disabled:opacity-20"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => moveSection(section.type, 1)} disabled={i === middleSections.length - 1}
                            className="w-6 h-5 rounded flex items-center justify-center disabled:opacity-20"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Toggle */}
                        <button type="button" onClick={() => updateSectionEnabled(section.type, !on)}
                          className="relative flex-shrink-0 transition-all"
                          style={{ width: 40, height: 22, borderRadius: 999, background: on ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.1)' }}>
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: on ? '20px' : '2px' }} />
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: on ? '#fff' : '#71717a' }}>{meta.label}</p>
                          <p className="text-xs" style={{ color: '#52525b' }}>{meta.description}</p>
                        </div>

                        <div style={{ color: on ? 'var(--kurso-primary-lighter)' : '#3f3f46', flexShrink: 0 }}>
                          {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </div>
                      </div>
                    )
                  })}

                  {/* Pinned: Final CTA */}
                  <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Lock className="w-4 h-4 flex-shrink-0" style={{ color: '#52525b' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#a1a1aa' }}>{LANDING_SECTION_META.finalCta.label} <span style={{ color: '#52525b', fontWeight: 400 }}>· always last</span></p>
                      <p className="text-xs" style={{ color: '#52525b' }}>{LANDING_SECTION_META.finalCta.description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs" style={{ color: '#52525b' }}>
                    💡 Sections with no data (e.g. Testimonials if you haven't added any, or Curriculum if you
                    haven't added lessons yet) are automatically hidden on the live page regardless of this toggle.
                  </p>
                </div>
              </div>

              {/* ── BONUSES CONTENT ── */}
              <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4" style={{ color: 'var(--kurso-primary-lighter)' }} />
                  <h2 className="font-semibold text-white">Bonuses</h2>
                </div>
                <p className="text-xs mb-4" style={{ color: '#71717a' }}>
                  Extra resources or perks included with the course. Turn the "Bonuses" toggle on above once you've
                  added at least one — an empty list stays hidden on the live page either way.
                </p>
                <div className="flex flex-col gap-3">
                  {landingConfig.bonuses.map((bonus, i) => (
                    <div key={i} className="flex gap-2 items-start p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 flex flex-col gap-2">
                        <input value={bonus.title} onChange={e => updateBonus(i, 'title', e.target.value)}
                          placeholder="Bonus title (e.g. Private community access)"
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                        <input value={bonus.description} onChange={e => updateBonus(i, 'description', e.target.value)}
                          placeholder="Short description (optional)"
                          className="w-full px-3 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                      </div>
                      <button type="button" onClick={() => removeBonus(i)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addBonus}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.15)' }}>
                    <Plus className="w-3.5 h-3.5" /> Add bonus
                  </button>
                </div>
              </div>

              {/* ── DISCLAIMER CONTENT ── */}
              <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--kurso-primary-lighter)' }} />
                  <h2 className="font-semibold text-white">Disclaimer</h2>
                </div>
                <p className="text-xs mb-4" style={{ color: '#71717a' }}>
                  Optional legal/compliance notice — e.g. finance educators often need a "not a registered advisor"
                  line. Position it wherever it needs to sit using the arrows above (turn "Disclaimer" on in the
                  list first).
                </p>
                <div className="flex flex-col gap-2">
                  <input value={landingConfig.disclaimer.title} onChange={e => updateDisclaimer('title', e.target.value)}
                    placeholder="Title (e.g. Important information)"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                  <textarea value={landingConfig.disclaimer.text} onChange={e => updateDisclaimer('text', e.target.value)}
                    placeholder="Disclaimer text shown on the live page..." rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 resize-none" />
                </div>
              </div>

              {/* ── COUNTDOWN & SEATS CONTENT ── */}
              <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4" style={{ color: 'var(--kurso-primary-lighter)' }} />
                  <h2 className="font-semibold text-white">Countdown & Seats</h2>
                </div>
                <p className="text-xs mb-4" style={{ color: '#71717a' }}>
                  An urgency banner with a closing countdown and/or a seats-remaining counter. Both are optional and
                  independent — set one, both, or neither. Seats is a number you set yourself; it doesn't
                  auto-update from actual enrollments. Turn "Countdown & Seats" on in the list above to show it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: '#a1a1aa' }}>Countdown ends at</label>
                    <input type="datetime-local" value={landingConfig.urgency.endAt}
                      onChange={e => updateUrgency('endAt', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: '#a1a1aa' }}>Countdown label</label>
                    <input value={landingConfig.urgency.label} onChange={e => updateUrgency('label', e.target.value)}
                      placeholder="Enrollment closes in"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                  </div>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: '#a1a1aa' }}>Seats available</label>
                    <input type="number" min={0} value={landingConfig.urgency.seatsAvailable ?? ''}
                      onChange={e => updateUrgency('seatsAvailable', e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10)))}
                      placeholder="Leave blank to hide"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                  </div>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: '#a1a1aa' }}>Seats label</label>
                    <input value={landingConfig.urgency.seatsLabel} onChange={e => updateUrgency('seatsLabel', e.target.value)}
                      placeholder="seats left at this price"
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-zinc-600" />
                  </div>
                </div>
                {landingConfig.urgency.endAt && new Date(landingConfig.urgency.endAt).getTime() <= Date.now() && (
                  <p className="text-xs mt-3" style={{ color: 'var(--kurso-accent)' }}>
                    ⚠ This date is in the past — the countdown won't show on the live page until you set a future date.
                  </p>
                )}

                {(landingConfig.urgency.endAt || typeof landingConfig.urgency.seatsAvailable === 'number') && (
                  <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: '#71717a' }}>Live preview</p>
                    <div className="rounded-2xl flex flex-col sm:flex-row overflow-hidden"
                      style={{ background: getLandingTheme(selectedTheme).colors.cardBg, border: `1px solid ${getLandingTheme(selectedTheme).colors.accentBorder}` }}>
                      {landingConfig.urgency.endAt && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-5 py-5">
                          <span style={{ fontSize: '0.75rem', color: getLandingTheme(selectedTheme).colors.textSecondary, fontWeight: 600 }}>
                            {landingConfig.urgency.label || 'Enrollment closes in'}
                          </span>
                          <CountdownTimer
                            endAt={new Date(Date.now() + 2 * 86400000 + 3 * 3600000 + 45 * 60000).toISOString()}
                            accentGradient={getLandingTheme(selectedTheme).colors.accentGradient}
                            boxShadowColor={getLandingTheme(selectedTheme).colors.accentGradientShadow}
                            labelColor={getLandingTheme(selectedTheme).colors.textMuted}
                          />
                        </div>
                      )}
                      {typeof landingConfig.urgency.seatsAvailable === 'number' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-5 py-5">
                          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: getLandingTheme(selectedTheme).colors.textPrimary, lineHeight: 1 }}>
                            {landingConfig.urgency.seatsAvailable}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: getLandingTheme(selectedTheme).colors.textSecondary, fontWeight: 500 }}>
                            {landingConfig.urgency.seatsLabel}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: '#52525b' }}>
                      Preview uses a sample countdown time and your selected theme's colors — actual timing comes from the date you set above.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TAB: FONTS ── */}
          {activeTab === 'fonts' && (
            <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-semibold text-white mb-1">Font Style</h2>
              <p className="text-xs mb-5" style={{ color: '#71717a' }}>
                Override the heading font pairing from your theme. Body text always uses Inter for readability.
                Select "Theme Default" to use whatever font the theme was designed with.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FONT_PAIRS.map(fp => {
                  const active = fontPair === fp.id
                  return (
                    <button key={fp.id} type="button" onClick={() => setFontPair(fp.id)}
                      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                      style={{
                        background: active ? 'rgba(var(--kurso-primary-rgb), 0.12)' : 'rgba(255,255,255,0.03)',
                        border: active ? '2px solid rgba(var(--kurso-primary-rgb), 0.45)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                      {/* Mini font preview box */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? 'rgba(var(--kurso-primary-rgb), 0.2)' : 'rgba(255,255,255,0.05)' }}>
                        <Type className="w-4 h-4" style={{ color: active ? 'var(--kurso-primary-lighter)' : '#52525b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{fp.label}</p>
                          {active && (
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--kurso-primary)' }}>
                              <Check className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{fp.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs" style={{ color: '#52525b' }}>
                  💡 Font changes take effect on your live page immediately after saving. Use "Preview Live" at
                  the top to check before sharing.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
        {saving ? 'Saving...' : savedMsg ? '✓ Saved' : 'Save Landing Page'}
      </button>
      </div>
    </div>
  )
}
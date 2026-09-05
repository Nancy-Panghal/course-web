'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { LANDING_THEMES, DEFAULT_LANDING_THEME_ID, getLandingTheme, type LandingThemeId } from '@/lib/landing-themes'
import CountdownTimer from '@/components/CountdownTimer'
import {
  Check, ExternalLink, Image as ImageIcon, X,
  Palette, Plus, Trash2, Type, Gift, AlertTriangle, Timer, FileText,
} from 'lucide-react'
import {
  DEFAULT_LANDING_CONFIG, normalizeLandingConfig, LANDING_SECTION_META, LANDING_SECTION_TYPES,
  type LandingConfig, type LandingSectionType, type LandingSectionEntry,
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
  { id: 'theme-default', label: 'Theme Default', desc: 'Uses the font included with your theme' },
  { id: 'playfair-dm', label: 'Playfair · DM Sans', desc: 'Elegant serif + clean modern sans' },
  { id: 'fraunces-inter', label: 'Fraunces · Inter', desc: 'Editorial serif + versatile sans' },
  { id: 'space-inter', label: 'Space Grotesk · Inter', desc: 'Techy geometric headings' },
  { id: 'outfit-inter', label: 'Outfit · Inter', desc: 'Friendly rounded headings' },
  { id: 'dm-inter', label: 'DM Serif · Inter', desc: 'Compact serif + crisp body' },
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
  const landingLoadedRef = useRef(false)
  const lastSavedSnapshotRef = useRef('')

  const [courseName, setCourseName] = useState('')
  const [hostName, setHostName] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<LandingThemeId>(DEFAULT_LANDING_THEME_ID)
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [landingConfig, setLandingConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG)
  const [fontPair, setFontPair] = useState<FontPairId>('theme-default')
  const [activeTab, setActiveTab] = useState<'theme' | 'fonts'>('theme')

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

  async function saveLandingPage() {
    setSaving(true)
    setError('')

    // Basic client-side validation so a creator can't save something that'll
    // silently render wrong — e.g. a bonus with no title, a disclaimer enabled
    // with no text, or a custom section with no heading AND no body (dropped
    // here along with its now-orphaned order-list entry, so it can never
    // render as a hollow blank section on the live page).
    const cleanedBonuses = landingConfig.bonuses.map(b => ({ title: b.title.trim(), description: b.description.trim() })).filter(b => b.title.length > 0)
    const cleanedCustomSections = landingConfig.customSections
      .map(cs => ({ ...cs, heading: cs.heading.trim(), body: cs.body.trim() }))
      .filter(cs => cs.heading.length > 0 || cs.body.length > 0)
    const cleanedCustomIds = new Set(cleanedCustomSections.map(cs => cs.id))
    const configToSave: LandingConfig = {
      ...landingConfig,
      bonuses: cleanedBonuses,
      customSections: cleanedCustomSections,
      sections: landingConfig.sections.filter(s => s.type !== 'custom' || (s.customId ? cleanedCustomIds.has(s.customId) : false)),
    }



    // Mirror into the legacy flat column too, purely for backwards
    // compatibility with anything that might still read it directly.
    const legacyMirror: Record<string, boolean> = {}
    for (const s of configToSave.sections) legacyMirror[s.type] = s.enabled

    const { error: updateError } = await supabase
      .from('courses')
      .update({
        landing_theme: selectedTheme,
        landing_sections: legacyMirror,
        landing_config: configToSave,
        landing_font_pair: fontPair === 'theme-default' ? null : fontPair,
      })
      .eq('id', courseId)

    setSaving(false)
    if (updateError) { setError(updateError.message); return }

    const nextSnapshot = JSON.stringify({
      selectedTheme,
      brandLogoUrl,
      landingConfig: configToSave,
      fontPair,
    })
    lastSavedSnapshotRef.current = nextSnapshot

    setLandingConfig(configToSave)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const landingSnapshot = JSON.stringify({
    selectedTheme,
    brandLogoUrl,
    landingConfig,
    fontPair,
  })

  useEffect(() => {
    if (loading) return
    if (!landingLoadedRef.current) {
      landingLoadedRef.current = true
      lastSavedSnapshotRef.current = landingSnapshot
      return
    }
    if (saving) return
    if (landingSnapshot === lastSavedSnapshotRef.current) return

    const timer = window.setTimeout(async () => {
      await saveLandingPage()
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [landingSnapshot, loading, saving])



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



      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {([
          { id: 'theme', label: 'Theme & Colors', icon: <Palette className="w-3.5 h-3.5" /> },

          { id: 'fonts', label: 'Font Style', icon: <Type className="w-3.5 h-3.5" /> },
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
          <p className="text-sm mb-4" style={{ color: 'var(--kurso-hint)' }}>
            Shown in the landing page and certificate, if you don't have then disable brand logo on certificate and here don't upload.
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
                  className="ml-2 text-xs text-zinc-400 hover:text-red-500 inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
              <p className="text-[12px] text-zinc-400 mt-1.5">PNG/JPG/WebP · transparent background recommended · max 2 MB</p>
            </div>
          </div>
        </div>

        {/* ── TAB: THEME ── */}
        {activeTab === 'theme' && (
          <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-1">Choose a Theme</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--kurso-hint)' }}>
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
                      <p className="text-xs mt-0.5" style={{ color: 'var(--kurso-hint)' }}>{t.tagline}</p>
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



        {/* ── TAB: FONTS ── */}
        {activeTab === 'fonts' && (
          <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-1">Font Style</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--kurso-hint)' }}>
              On right side click preview course page option and see how the font is looking on your course.

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
                      <p className="text-xs mt-0.5" style={{ color: 'var(--kurso-hint)' }}>{fp.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>

            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

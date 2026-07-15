'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { LANDING_THEMES, DEFAULT_LANDING_THEME_ID, type LandingThemeId } from '@/lib/landing-themes'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Image as ImageIcon, X, Eye, EyeOff, Layout, Palette, Plus, Trash2, Type } from 'lucide-react'
import { DEFAULT_LANDING_CONFIG, normalizeLandingConfig, type LandingConfig, type LandingSectionType } from '@/lib/landing-config'

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

// All toggleable sections with display labels
const ALL_SECTIONS = [
  { key: 'stats',        label: 'Quick Stats Bar',         desc: 'Lessons · Duration · Language · Level' },
  { key: 'target',       label: 'Who Is This For?',        desc: 'Target audience bullets' },
  { key: 'learn',        label: "What You'll Learn",       desc: 'Learning outcomes checklist' },
  { key: 'requirements', label: 'Requirements',            desc: 'Prerequisites list' },
  { key: 'curriculum',   label: 'Course Curriculum',       desc: 'Module & lesson accordion' },
  { key: 'instructor',   label: 'Instructor',              desc: 'Photo · title · bio' },
  { key: 'testimonials', label: 'Student Testimonials',    desc: 'Reviews & star ratings' },
  { key: 'howItWorks',   label: 'How It Works',            desc: 'Enroll → Telegram → Learn steps' },
  { key: 'faq',          label: 'FAQ',                     desc: 'Frequently asked questions' },
] as const

type SectionKey = (typeof ALL_SECTIONS)[number]['key']

type SectionsConfig = Record<SectionKey, boolean>

const DEFAULT_SECTIONS: SectionsConfig = {
  stats: true,
  target: true,
  learn: true,
  requirements: true,
  curriculum: true,
  instructor: true,
  testimonials: true,
  howItWorks: true,
  faq: true,
}

const CONFIG_SECTION_LABELS: Record<LandingSectionType, { label: string; desc: string }> = {
  hero: { label: 'Hero', desc: 'Course promise and main CTA' }, stats: { label: 'Quick Stats', desc: 'Lessons, duration, language and level' },
  target: { label: 'Who is this for?', desc: 'Target audience bullets' }, learn: { label: "What you'll learn", desc: 'Learning outcomes' },
  requirements: { label: 'Requirements', desc: 'Prerequisites list' }, bonuses: { label: 'Bonuses', desc: 'Extra resources and benefits' },
  curriculum: { label: 'Curriculum', desc: 'Module and lesson accordion' }, instructor: { label: 'Instructor', desc: 'Photo, credentials and bio' },
  testimonials: { label: 'Testimonials', desc: 'Student reviews and ratings' }, howItWorks: { label: 'How it works', desc: 'Enrollment and delivery steps' },
  faq: { label: 'FAQ', desc: 'Frequently asked questions' }, refund: { label: 'Refund policy', desc: 'Course refund terms' },
  disclaimer: { label: 'Disclaimer', desc: 'Optional compliance or safety notice' }, finalCta: { label: 'Final CTA', desc: 'Closing enrollment CTA' },
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

export default function LandingPageDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: courseId } = use(params)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)

  const [courseName, setCourseName] = useState('')
  const [hostName, setHostName] = useState('')
  const [selectedTheme, setSelectedTheme] = useState<LandingThemeId>(DEFAULT_LANDING_THEME_ID)
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [sections, setSections] = useState<SectionsConfig>(DEFAULT_SECTIONS)
  const [landingConfig, setLandingConfig] = useState<LandingConfig>(DEFAULT_LANDING_CONFIG)
  const [fontPair, setFontPair] = useState<FontPairId>('theme-default')
  const [activeTab, setActiveTab] = useState<'theme' | 'sections' | 'fonts'>('theme')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: course } = await supabase
        .from('courses')
        .select('id, name, host_name, landing_theme, brand_logo_url, landing_sections, landing_config, landing_font_pair')
        .eq('id', courseId)
        .eq('creator_id', user.id)
        .single()

      if (!course) { router.push('/dashboard/courses'); return }

      setCourseName(course.name)
      setHostName(course.host_name || '')
      setSelectedTheme((course.landing_theme as LandingThemeId) || DEFAULT_LANDING_THEME_ID)
      setBrandLogoUrl(course.brand_logo_url || '')
      setSections({ ...DEFAULT_SECTIONS, ...(course.landing_sections || {}) })
      setLandingConfig(normalizeLandingConfig(course.landing_config, course.landing_sections || {}))
      setFontPair((course.landing_font_pair as FontPairId) || 'theme-default')
      setLoading(false)
    }
    load()
  }, [courseId, router])

  const previewUrl = (themeId: LandingThemeId) =>
    `/about-course/${slugify(hostName || 'instructor')}/${slugify(courseName)}/${courseId}?theme=${themeId}`

  function toggleSection(key: SectionKey) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function updateConfigSection(type: LandingSectionType, enabled: boolean) {
    setLandingConfig(prev => ({ ...prev, sections: prev.sections.map(section => section.type === type ? { ...section, enabled } : section) }))
  }

  function moveConfigSection(index: number, direction: -1 | 1) {
    setLandingConfig(prev => {
      const sections = [...prev.sections]
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= sections.length) return prev
      ;[sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]]
      return { ...prev, sections }
    })
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
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        landing_theme: selectedTheme,
        brand_logo_url: brandLogoUrl || null,
        landing_sections: sections,
        landing_config: landingConfig,
        landing_font_pair: fontPair === 'theme-default' ? null : fontPair,
      })
      .eq('id', courseId)

    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const enabledCount = Object.values(sections).filter(Boolean).length

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Sidebar />
        <main className="md:ml-56 p-6 md:p-8 max-w-4xl">
          <div className="w-32 h-6 rounded bg-white/5 animate-pulse" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8 max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push(`/dashboard/courses/${courseId}`)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Design Landing Page</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>{courseName}</p>
          </div>
          {/* Live preview button */}
          <a href={previewUrl(selectedTheme)} target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
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
                background: activeTab === tab.id ? '#7c3aed' : 'transparent',
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
                        background: active ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                        border: active ? '2px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
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
                            <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed' }}>
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{t.tagline}</p>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedTheme(t.id)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: active ? '#7c3aed' : 'rgba(255,255,255,0.06)', color: active ? '#fff' : '#a1a1aa' }}>
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
            <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-white">Page Sections</h2>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                  {enabledCount} / {ALL_SECTIONS.length} visible
                </span>
              </div>
              <p className="text-xs mb-5" style={{ color: '#71717a' }}>
                Toggle which sections appear on your landing page. Hidden sections won't show even if you have
                data for them.
              </p>

              <div className="flex flex-col gap-2">
                {ALL_SECTIONS.map(({ key, label, desc }) => {
                  const on = sections[key]
                  return (
                    <div key={key}
                      className="flex items-center gap-4 p-4 rounded-xl transition-all"
                      style={{
                        background: on ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.02)',
                        border: on ? '1px solid rgba(124,58,237,0.2)' : '1px solid rgba(255,255,255,0.06)',
                      }}>
                      {/* Toggle */}
                      <button type="button" onClick={() => toggleSection(key)}
                        className="relative w-10 h-5.5 rounded-full flex-shrink-0 transition-all"
                        style={{
                          width: 40, height: 22,
                          background: on ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                        }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: on ? '20px' : '2px' }} />
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: on ? '#fff' : '#71717a' }}>{label}</p>
                        <p className="text-xs" style={{ color: '#52525b' }}>{desc}</p>
                      </div>

                      {/* Eye icon */}
                      <div style={{ color: on ? '#a78bfa' : '#3f3f46', flexShrink: 0 }}>
                        {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs" style={{ color: '#52525b' }}>
                  💡 Sections with no data (e.g. Testimonials if you haven't added any) are automatically hidden
                  on the live page regardless of this toggle.
                </p>
              </div>
            </div>
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
                        background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                        border: active ? '2px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                      {/* Mini font preview box */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)' }}>
                        <Type className="w-4 h-4" style={{ color: active ? '#a78bfa' : '#52525b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{fp.label}</p>
                          {active && (
                            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed' }}>
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
      </main>
    </div>
  )
}

'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { LANDING_THEMES, DEFAULT_LANDING_THEME_ID, type LandingThemeId } from '@/lib/landing-themes'
import { ArrowLeft, Check, ExternalLink, Image as ImageIcon, X } from 'lucide-react'

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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: course } = await supabase
        .from('courses')
        .select('id, name, host_name, landing_theme, brand_logo_url')
        .eq('id', courseId)
        .eq('creator_id', user.id)
        .single()

      if (!course) { router.push('/dashboard/courses'); return }

      setCourseName(course.name)
      setHostName(course.host_name || '')
      setSelectedTheme((course.landing_theme as LandingThemeId) || DEFAULT_LANDING_THEME_ID)
      setBrandLogoUrl(course.brand_logo_url || '')
      setLoading(false)
    }
    load()
  }, [courseId, router])

  const previewUrl = (themeId: LandingThemeId) =>
    `/about-course/${slugify(hostName || 'instructor')}/${slugify(courseName)}/${courseId}?theme=${themeId}`

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be 2MB or smaller.')
      return
    }
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
      })
      .eq('id', courseId)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

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
          <div>
            <h1 className="text-2xl font-bold text-white">Design Landing Page</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>{courseName}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">

          {/* Brand Logo */}
          <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-1">Brand Logo</h2>
            <p className="text-xs mb-4" style={{ color: '#71717a' }}>
              Shown in your landing page's top nav instead of the Kurso logo. You can also choose to show it on
              completion certificates from the Certificate settings tab.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {brandLogoUrl ? (
                  <img src={brandLogoUrl} alt="Brand logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-zinc-600" />
                )}
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
                <p className="text-[10px] text-zinc-500 mt-1.5">PNG/JPG/WebP, transparent background recommended, max 2MB.</p>
              </div>
            </div>
          </div>

          {/* Theme picker */}
          <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-1">Choose a Theme</h2>
            <p className="text-xs mb-5" style={{ color: '#71717a' }}>
              Pick a look for your course landing page. Use "Preview" to see it live with your real course data
              before saving.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {LANDING_THEMES.map(t => {
                const active = selectedTheme === t.id
                return (
                  <div key={t.id}
                    className="rounded-2xl p-4 text-left transition-all flex flex-col gap-3"
                    style={{
                      background: active ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                      border: active ? '2px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                    {/* Swatch preview */}
                    <div className="w-full h-20 rounded-xl overflow-hidden flex">
                      {t.swatch.map((hex, i) => (
                        <div key={i} style={{ background: hex, flex: 1 }} />
                      ))}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        {active && (
                          <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: '#7c3aed' }}>
                            <Check className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#71717a' }}>{t.tagline}</p>
                    </div>

                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedTheme(t.id)}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: active ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                          color: active ? '#fff' : '#a1a1aa',
                        }}>
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
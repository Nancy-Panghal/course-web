'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { ArrowRight, ArrowLeft, Globe, MessageCircle, Monitor, Plus, X } from 'lucide-react'

const LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Marathi',
  'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
  'Urdu', 'Arabic', 'Spanish', 'French', 'German',
]

const DELIVERY_OPTIONS = [
  {
    id: 'both',
    label: 'Web + WhatsApp',
    desc: 'Students can learn on both platforms',
    icon: Globe,
    recommended: true,
  },
  {
    id: 'web',
    label: 'Web Only',
    desc: 'Students access via browser portal',
    icon: Monitor,
    recommended: false,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Only',
    desc: 'Lessons delivered via WhatsApp messages',
    icon: MessageCircle,
    recommended: false,
  },
]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Reusable input component defined outside
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-white mb-2 block">{label}</label>
      {children}
      {hint && <p className="text-xs mt-1.5" style={{color:'#52525b'}}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
      style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
      onFocus={e => e.target.style.borderColor = '#7c3aed'}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
    />
  )
}

export default function CreateCoursePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [hostName, setHostName] = useState('')
  const [aboutCreator, setAboutCreator] = useState('')
  const [delivery, setDelivery] = useState('both')
  const [totalLessons, setTotalLessons] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('')
  const [whatYouWillLearn, setWhatYouWillLearn] = useState([''])
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }])
  const [hostImage, setHostImage] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English'])
  const [langDropdown, setLangDropdown] = useState(false)
  const [freePreview, setFreePreview] = useState('nothing free')

  const slug = slugify(name)

  function toggleLanguage(lang: string) {
    setSelectedLanguages(prev =>
      prev.includes(lang)
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    )
  }

  function addWhatYouWillLearn() {
    setWhatYouWillLearn(prev => [...prev, ''])
  }

  function removeWhatYouWillLearn(index: number) {
    setWhatYouWillLearn(prev => prev.filter((_, i) => i !== index))
  }

  function updateWhatYouWillLearn(index: number, value: string) {
    const next = [...whatYouWillLearn]
    next[index] = value
    setWhatYouWillLearn(next)
  }

  function addFaq() {
    setFaqs(prev => [...prev, { question: '', answer: '' }])
  }

  function removeFaq(index: number) {
    setFaqs(prev => prev.filter((_, i) => i !== index))
  }

  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    const next = [...faqs]
    next[index][field] = value
    setFaqs(next)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload a JPG, PNG or WebP image.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2MB or smaller.')
      return
    }

    setUploadingImage(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setHostImage(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleCreate() {
    if (!name || !price || !description) {
      setError('Course name, price and description are required.')
      return
    }
    if (selectedLanguages.length === 0) {
      setError('Select at least one language.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('slug', slug)
      .single()

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    const { data: course, error: createError } = await supabase
      .from('courses')
      .insert({
        creator_id: user.id,
        name,
        slug: finalSlug,
        description,
        price: parseInt(price),
        original_price: originalPrice ? parseInt(originalPrice) : parseInt(price),
        host_name: hostName || user.user_metadata?.full_name || '',
        about_creator: aboutCreator,
        host_image: hostImage,
        delivery,
        total_lessons: totalLessons ? parseInt(totalLessons) : 0,
        language: selectedLanguages,
        start_date: startDate,
        start_time: startTime,
        duration: duration,
        what_you_will_learn: whatYouWillLearn.filter(item => item.trim() !== ''),
        faq: faqs.filter(f => f.question.trim() !== '' && f.answer.trim() !== ''),
        free_preview_config: freePreview,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/courses/${course.id}`)
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8 max-w-3xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Create Course</h1>
            <p className="text-sm" style={{color:'#a1a1aa'}}>Fill in the details to set up your course</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">

          {/* Basic Info */}
          <div className="rounded-2xl p-6 glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <h2 className="font-semibold text-white mb-5">Basic Information</h2>
            <div className="flex flex-col gap-4">

              <Field label="Course Name *">
                <Input value={name} onChange={setName} placeholder="e.g. SEO Masterclass 2026" />
                {name && (
                  <p className="text-xs mt-1.5" style={{color:'#52525b'}}>
                    Course URL: <span style={{color:'#8b5cf6'}}>/c/{slug}</span>
                  </p>
                )}
              </Field>

              <Field label="Description *" hint="Tell students what they will learn">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Learn everything about SEO from scratch..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all resize-none"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Price (₹) *">
                  <Input value={price} onChange={setPrice} placeholder="4999" type="number" />
                </Field>
                <Field label="Original Price (₹)" hint="For showing discount">
                  <Input value={originalPrice} onChange={setOriginalPrice} placeholder="9999" type="number" />
                </Field>
              </div>

              <Field label="Free Preview Configuration" hint="Select how much content is free for students">
                <select
                  value={freePreview}
                  onChange={e => setFreePreview(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all appearance-none cursor-pointer"
                  style={{background:'#050505', color:'#fff', border:'1px solid rgba(255,255,255,0.1)'}}
                >
                  <option value="nothing free" style={{background:'#050505', color:'#fff'}}>Nothing free (Pay immediately)</option>
                  <option value="lesson 1 free" style={{background:'#050505', color:'#fff'}}>Lesson 1 free</option>
                  <option value="2 lessons free" style={{background:'#050505', color:'#fff'}}>2 lessons free</option>
                  <option value="3 lessons free" style={{background:'#050505', color:'#fff'}}>3 lessons free</option>
                  <option value="module 1 free" style={{background:'#050505', color:'#fff'}}>Module 1 free</option>
                  <option value="2 modules free" style={{background:'#050505', color:'#fff'}}>2 modules free</option>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Instructor Name" hint="Shown on course page">
                  <Input value={hostName} onChange={setHostName} placeholder="Your name" />
                </Field>
                <Field label="Planned Number of Lessons">
                  <Input value={totalLessons} onChange={setTotalLessons} placeholder="24" type="number" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Start Date" hint="e.g. 15th May 2026">
                  <Input value={startDate} onChange={setStartDate} placeholder="15th May 2026" />
                </Field>
                <Field label="Start Time" hint="e.g. 7:00 PM IST">
                  <Input value={startTime} onChange={setStartTime} placeholder="7:00 PM IST" />
                </Field>
                <Field label="Total Duration" hint="e.g. 4 Weeks / 20 Hours">
                  <Input value={duration} onChange={setDuration} placeholder="4 Weeks" />
                </Field>
              </div>

              <Field label="What You Will Learn" hint="Add key takeaways for students">
                <div className="flex flex-col gap-2">
                  {whatYouWillLearn.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={item} onChange={v => updateWhatYouWillLearn(i, v)} placeholder={`Point ${i+1}`} />
                      {whatYouWillLearn.length > 1 && (
                        <button onClick={() => removeWhatYouWillLearn(i)}
                          className="px-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addWhatYouWillLearn}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl w-fit mt-1 transition-all"
                    style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa', border:'1px solid rgba(255,255,255,0.1)'}}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Point
                  </button>
                </div>
              </Field>

              <Field label="About You" hint="Shown on course page as instructor bio">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    {hostImage ? (
                      <img src={hostImage} alt="Instructor" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-zinc-700">
                        {hostName ? hostName.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      id="create-host-image"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="create-host-image"
                      className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10 transition-all"
                    >
                      {uploadingImage ? 'Uploading...' : hostImage ? 'Change Photo' : 'Upload Photo'}
                    </label>
                    {hostImage && (
                      <button
                        type="button"
                        onClick={() => setHostImage('')}
                        className="ml-2 text-xs text-zinc-500 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-[10px] text-zinc-500 mt-1.5">Square JPG/PNG/WebP recommended, max 2MB.</p>
                  </div>
                </div>
                <textarea
                  value={aboutCreator}
                  onChange={e => setAboutCreator(e.target.value)}
                  placeholder="SEO expert with 8 years of experience..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all resize-none"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </Field>

              <Field label="Frequently Asked Questions" hint="Address common student doubts">
                <div className="flex flex-col gap-4">
                  {faqs.map((faq, i) => (
                    <div key={i} className="p-4 rounded-xl relative flex flex-col gap-2"
                      style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)'}}>
                      <button onClick={() => removeFaq(i)}
                        className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <input
                        value={faq.question}
                        onChange={e => updateFaq(i, 'question', e.target.value)}
                        placeholder="Question"
                        className="w-full bg-transparent text-sm text-white font-medium outline-none pr-8"
                      />
                      <textarea
                        value={faq.answer}
                        onChange={e => updateFaq(i, 'answer', e.target.value)}
                        placeholder="Answer"
                        rows={2}
                        className="w-full bg-transparent text-sm text-zinc-400 outline-none resize-none"
                      />
                    </div>
                  ))}
                  <button onClick={addFaq}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl w-fit transition-all"
                    style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa', border:'1px solid rgba(255,255,255,0.1)'}}>
                    <Plus className="w-3.5 h-3.5" />
                    Add FAQ
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {/* Delivery */}
          <div className="rounded-2xl p-6 glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <h2 className="font-semibold text-white mb-5">Delivery Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DELIVERY_OPTIONS.map(opt => {
                const Icon = opt.icon
                const active = delivery === opt.id
                return (
                  <button key={opt.id}
                    onClick={() => setDelivery(opt.id)}
                    className="p-4 rounded-xl text-left transition-all relative"
                    style={{
                      background: active ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                      border: active ? '2px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                    {opt.recommended && (
                      <span className="absolute -top-2 right-3 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{background:'#7c3aed', color:'#fff'}}>
                        Recommended
                      </span>
                    )}
                    <Icon className="w-5 h-5 mb-2" style={{color: active ? '#8b5cf6' : '#52525b'}} />
                    <p className="text-sm font-medium" style={{color: active ? '#fff' : '#a1a1aa'}}>
                      {opt.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{color:'#52525b'}}>{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Languages */}
          <div className="rounded-2xl p-6 glass"
            style={{border:'1px solid rgba(255,255,255,0.06)'}}>
            <h2 className="font-semibold text-white mb-5">Course Language(s)</h2>

            {/* Selected tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedLanguages.map(lang => (
                <span key={lang}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
                  style={{background:'rgba(124,58,237,0.15)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.3)'}}>
                  {lang}
                  <button onClick={() => toggleLanguage(lang)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setLangDropdown(!langDropdown)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
                style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa', border:'1px solid rgba(255,255,255,0.1)'}}>
                <Plus className="w-3 h-3" />
                Add Language
              </button>
            </div>

            {/* Dropdown */}
            {langDropdown && (
              <div className="rounded-xl overflow-hidden"
                style={{border:'1px solid rgba(255,255,255,0.1)', background:'#111'}}>
                <div className="max-h-48 overflow-y-auto">
                  {LANGUAGES.filter(l => !selectedLanguages.includes(l)).map(lang => (
                    <button key={lang}
                      onClick={() => { toggleLanguage(lang); setLangDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-all"
                      style={{color:'#a1a1aa'}}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(124,58,237,0.1)'
                        e.currentTarget.style.color = '#fff'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#a1a1aa'
                      }}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl text-sm"
              style={{background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button onClick={() => router.back()}
              className="px-6 py-3 rounded-xl text-sm font-medium transition-all"
              style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow transition-all disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Course & Add Lessons'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { slugify, renumberLessons, getNextLessonOrder, renumberModules, getNextModuleOrder } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Video, FileText, Globe,
  Eye, EyeOff, ExternalLink, Copy, Check,
  GripVertical, Trash2, CheckCircle, AlertCircle,
  MessageCircle, Monitor, Share2, ChevronDown, ChevronUp, AlertTriangle,
  Calendar, Clock, Link as LinkIcon, Video as VideoIcon, Pencil, X, ChevronRight 
} from 'lucide-react'

interface Course {
  id: string
  name: string
  slug: string
  description: string
  price: number
  original_price: number
  host_name: string
  about_creator: string
  delivery: string
  total_lessons: number
  language: string[]
  is_published: boolean
  creator_id: string
  start_date?: string
  start_time?: string
  duration?: string
  what_you_will_learn?: string[]
  faq?: { question: string; answer: string }[]
  host_image?: string
  free_preview_config?: string
  scheduled_deletion_at?: string
  next_lesson_date?: string
  course_end_date?: string
  student_update_message?: string
}

interface Lesson {
  id: string
  course_id: string
  title: string
  content_url: string
  content_type: string
  order_num: number
  is_published: boolean
  duration: string
  module_id?: string | null
  summary_url?: string | null
  summary_name?: string | null
  notes_url?: string | null
  notes_name?: string | null
  quiz_questions?: QuizQuestion[] | null
  assignment_prompt?: string | null
  assignment_required?: boolean
  assignment_file_url?: string | null
  assignment_file_name?: string | null
  // Engagement & live session fields
  expected_delivery_text?: string | null
  live_scheduled_at?: string | null
  live_join_url?: string | null
  live_recording_url?: string | null
  live_duration_minutes?: number | null
}

interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
}

interface CourseModule {
  id: string
  course_id: string
  name: string
  order_num: number
  planned_lessons: number
}

async function uploadToSupabase(file: File, folder: string): Promise<{ publicUrl: string; storagePath: string }> {
  try {
    const ext = file.name.split('.').pop()
    const safeName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`

    // Upload directly using Supabase client (handles CORS properly)
    const { data, error: uploadError } = await supabase.storage
      .from('lessons')
      .upload(safeName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      // Provide specific error messages for common issues
      let errorMsg = uploadError.message

      if (errorMsg?.includes('row-level security') || errorMsg?.includes('RLS')) {
        errorMsg = 'Storage policy error: Please contact admin to enable file uploads. See STORAGE_RLS_FIX.md for fix.'
      } else if (errorMsg?.includes('unauthorized') || errorMsg?.includes('auth')) {
        errorMsg = 'Authentication error: Please log out and log back in.'
      } else if (errorMsg?.includes('not found')) {
        errorMsg = 'Storage bucket not found. Please check configuration.'
      }

      console.error('Supabase upload error:', uploadError)
      throw new Error(`Upload failed: ${errorMsg}`)
    }

    if (!data) {
      throw new Error('No data returned from upload')
    }

    // Generate public URL
    const { data: publicUrlData } = supabase.storage
      .from('lessons')
      .getPublicUrl(safeName)

    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: safeName
    }
  } catch (err: any) {
    console.error('Upload error:', err)
    throw new Error(err.message || 'Upload failed')
  }
}

function AddModuleModal({
  onClose,
  onAdd,
  courseId,
  nextOrder,
}: {
  onClose: () => void
  onAdd: () => void
  courseId: string
  nextOrder: number
}) {
  const [name, setName] = useState('')
  const [plannedLessons, setPlannedLessons] = useState('3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Module name is required.')
      return
    }

    setLoading(true)
    setError('')

    const { error: insertError } = await supabase.from('course_modules').insert({
      course_id: courseId,
      name: name.trim(),
      order_num: nextOrder,
      planned_lessons: plannedLessons ? parseInt(plannedLessons) : 0,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    onAdd()
    onClose()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#111', border: '1px solid rgba(124,58,237,0.3)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Module</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            X
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Module Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Week 1, Foundation, Advanced SEO"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          <div>
            <label className="text-sm font-medium text-white mb-2 block">How many lessons?</label>
            <input value={plannedLessons} onChange={e => setPlannedLessons(e.target.value)}
              type="number" min="0" placeholder="3"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          {error && (
            <div className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ADD LESSON MODAL ──
function AddLessonModal({
  onClose,
  onAdd,
  courseId,
  creatorId,
  nextOrder,
  modules,
  initialModuleId = '',
  initialType = 'video',
}: {
  onClose: () => void
  onAdd: () => void
  courseId: string
  creatorId: string
  nextOrder: number
  modules: CourseModule[]
  initialModuleId?: string
  initialType?: 'video' | 'pdf' | 'live' | 'quiz' | 'assignment'
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<'video' | 'pdf' | 'live' | 'quiz' | 'assignment'>(initialType)
  const [duration, setDuration] = useState('')
  const [moduleId, setModuleId] = useState(initialModuleId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveScheduledAt, setLiveScheduledAt] = useState('')
  const [liveDate, setLiveDate] = useState('')
  const [liveTime, setLiveTime] = useState('')
  const [liveDurationMins, setLiveDurationMins] = useState('60')
  const [expectedDelivery, setExpectedDelivery] = useState('')

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let finalUrl = url
    let finalStoragePath = ''

    if (file && type !== 'live' && type !== 'quiz') {
      try {
        const folder = type === 'video' ? 'videos' : 'pdfs'
        const { publicUrl, storagePath } = await uploadToSupabase(file, folder)
        finalUrl = publicUrl
        finalStoragePath = storagePath
      } catch (err: any) {
        setError(`Upload error: ${err.message}`)
        setLoading(false)
        return
      }
    }

    if (type !== 'live' && type !== 'quiz' && type !== 'assignment' && !finalUrl) {
      setError('Please provide a URL or upload a file.')
      setLoading(false)
      return
    }

    const lessonData: any = {
      course_id: courseId,
      creator_id: creatorId,
      title,
      content_url: finalUrl || '',
      content_type: type,
      order_num: nextOrder,
      duration,
      module_id: moduleId || null,
      is_published: false,
      expected_delivery_text: expectedDelivery.trim() || null,
    }

    if (type === 'live') {
      lessonData.live_join_url = url
      lessonData.live_scheduled_at = liveDate && liveTime
        ? new Date(`${liveDate}T${liveTime}`).toISOString()
        : null
      lessonData.live_duration_minutes = parseInt(liveDurationMins) || 60
    }

    if (finalStoragePath) {
      if (type === 'video') lessonData.video_storage_path = finalStoragePath
      else lessonData.pdf_storage_path = finalStoragePath
    }

    const { error: dbError } = await supabase.from('lessons').insert(lessonData)

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }

    onAdd()
    onClose()
    setLoading(false)
  }

  const typeConfig = {
    video: { icon: <Video className="w-4 h-4" />, label: 'Video' },
    pdf: { icon: <FileText className="w-4 h-4" />, label: 'PDF' },
    live: { icon: <span className="text-sm">📡</span>, label: 'Live' },
    quiz: { icon: <span className="text-sm">🧠</span>, label: 'Quiz' },
    assignment: { icon: <span className="text-sm">📝</span>, label: 'Assignment' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
        style={{ background: '#111', border: '1px solid rgba(124,58,237,0.3)' }}>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Content {nextOrder}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Content Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['video', 'pdf', 'live', 'quiz', 'assignment'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: type === t ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                    border: type === t ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: type === t ? '#8b5cf6' : '#a1a1aa',
                  }}>
                  {typeConfig[t].icon}
                  {typeConfig[t].label}
                </button>
              ))}
            </div>
          </div>

          {modules.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Module (optional)</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: '#050505', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="" style={{ background: '#050505' }}>No module</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id} style={{ background: '#050505' }}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {type === 'live' ? 'Session Title *' : type === 'quiz' ? 'Quiz Title *' : 'Lesson Title *'}
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder={
                type === 'live' ? 'e.g. Live Q&A — Week 3' :
                  type === 'quiz' ? 'e.g. Week 1 Knowledge Check' :
                    'e.g. Introduction to Keyword Research'
              }
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* Live-specific fields */}
          {type === 'live' && (
            <>
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Join URL *</label>
                <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://zoom.us/j/... or meet.google.com/..."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Date</label>
                  <input type="date" value={liveDate}
                    onChange={e => setLiveDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">Time</label>
                  <input type="time" value={liveTime}
                    onChange={e => setLiveTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Duration (min)</label>
                <input type="number" value={liveDurationMins}
                  onChange={e => setLiveDurationMins(e.target.value)}
                  min="15" max="480"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </>
          )}

          {/* Video/PDF source */}
          {(type === 'video' || type === 'pdf') && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                {type === 'video' ? 'Video Source *' : 'PDF Source *'}
              </label>
              <div className="flex flex-col gap-3">
                <div className="relative group">
                  <input type="file" accept={type === 'video' ? 'video/*' : 'application/pdf'}
                    onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f) setUrl('') }}
                    className="hidden" id="file-upload" />
                  <label htmlFor="file-upload"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer"
                    style={{ background: file ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)', borderColor: file ? '#7c3aed' : 'rgba(255,255,255,0.1)', color: file ? '#fff' : '#a1a1aa' }}>
                    <Plus className="w-4 h-4" />
                    {file ? file.name : `Upload ${type === 'video' ? 'Video' : 'PDF'}`}
                  </label>
                  {file && (
                    <button type="button" onClick={() => setFile(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">✕</button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600">OR</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <input type="url" value={url} onChange={e => { setUrl(e.target.value); if (e.target.value) setFile(null) }}
                  placeholder={type === 'video' ? 'Paste video link' : 'Paste PDF link'}
                  disabled={!!file}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>
          )}

          {type === 'quiz' && (
            <div className="p-3 rounded-xl"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <p className="text-xs text-violet-300">
                A quiz lesson will be created. After adding, click <strong>Edit Quiz</strong> directly on the lesson card to add questions.
              </p>
            </div>
          )}

          {type === 'assignment' && (
            <div className="p-3 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-xs" style={{ color: '#fbbf24' }}>
                An assignment lesson will be created. After adding, expand the lesson card to write the prompt and attach files.
              </p>
            </div>
          )}

          {/* Duration (for video/pdf/quiz) */}
          {type !== 'live' && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Duration (optional)</label>
              <input type="text" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="e.g. 18 min"
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
          )}

          {/* Expected delivery (pre-fill for unpublished) */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              📅 Expected Delivery <span className="text-zinc-600 font-normal">(optional · shown before lesson goes live)</span>
            </label>
            <input type="text" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)}
              placeholder="e.g. Dropping this Friday at 6 PM IST"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <p className="text-xs mt-1.5 text-zinc-600">Students see this on their course page before the lesson goes live.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
              {loading ? 'Adding...' : `Add ${typeConfig[type].label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ── EXPECTED DELIVERY EDITOR ──
function ExpectedDeliveryEditor({ lesson, onRefresh }: { lesson: Lesson; onRefresh: () => void }) {
  const [text, setText] = useState(lesson.expected_delivery_text || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(lesson.expected_delivery_text || '')
  }, [lesson.expected_delivery_text])

  async function save() {
    const trimmed = text.trim()
    if (trimmed === (lesson.expected_delivery_text || '')) return
    setSaving(true)
    await supabase.from('lessons').update({ expected_delivery_text: trimmed || null }).eq('id', lesson.id)
    setSaving(false)
    onRefresh()
  }

  return (
    <div className="p-3 rounded-xl"
      style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#eab308' }}>📅 Expected Delivery Date</p>
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={save}
        placeholder="e.g. Dropping this Friday at 6 PM IST"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/50"
      />
      <p className="text-[10px] text-zinc-600 mt-1.5">
        {saving ? 'Saving…' : 'Students see this on their course page. Saved automatically on blur.'}
      </p>
    </div>
  )
}

// ── LIVE RECORDING EDITOR ──
function LiveRecordingEditor({ lesson, onRefresh }: { lesson: Lesson; onRefresh: () => void }) {
  const [url, setUrl] = useState(lesson.live_recording_url || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const trimmed = url.trim()
    if (trimmed === (lesson.live_recording_url || '')) return
    setSaving(true)
    await supabase.from('lessons').update({ live_recording_url: trimmed || null, content_url: trimmed || lesson.content_url }).eq('id', lesson.id)
    setSaving(false)
    onRefresh()
  }

  return (
    <div className="p-3 rounded-xl"
      style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#22c55e' }}>🎬 Add Recording URL</p>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onBlur={save}
        placeholder="Paste recording link after session ends"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500/50"
      />
      <p className="text-[10px] text-zinc-600 mt-1.5">
        {saving ? 'Saving…' : 'Once added, students can watch the recording on-demand.'}
      </p>
    </div>
  )
}

// ── ASSIGNMENT EDITOR (inside lesson widget) ──
function AssignmentEditor({ lesson, onRefresh }: { lesson: Lesson; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [prompt, setPrompt] = useState(lesson.assignment_prompt || '')
  const [required, setRequired] = useState(lesson.assignment_required || false)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(lesson.assignment_file_url || null)
  const [localFileName, setLocalFileName] = useState<string | null>(lesson.assignment_file_name || null)

  // Sync with lesson prop when it changes
  useEffect(() => {
    if (!editing) {
      setPrompt(lesson.assignment_prompt || '')
      setRequired(lesson.assignment_required || false)
      setLocalFileUrl(lesson.assignment_file_url || null)
      setLocalFileName(lesson.assignment_file_name || null)
    }
  }, [lesson, editing])

  async function handleFileUpload(file: File) {
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.')
      return
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
    const allowedExtensions = ['.pdf', '.txt', '.md', '.jpg', '.jpeg', '.png', '.gif', '.webp']
    const fileNameLower = file.name.toLowerCase()
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.some(ext => fileNameLower.endsWith(ext))
    if (!isValidType) {
      alert('Only PDF, TXT, MD, JPG, JPEG, PNG, GIF, or WEBP files are allowed.')
      return
    }

    setUploadingFile(true)
    try {
      const { publicUrl } = await uploadToSupabase(file, 'assignments')
      await supabase
        .from('lessons')
        .update({
          assignment_file_url: publicUrl,
          assignment_file_name: file.name
        })
        .eq('id', lesson.id)
      setLocalFileUrl(publicUrl)
      setLocalFileName(file.name)
      onRefresh()
    } catch (err: any) {
      alert(err.message || 'File upload failed.')
    } finally {
      setUploadingFile(false)
    }
  }

  async function deleteAssignmentFile() {
    try {
      await supabase
        .from('lessons')
        .update({
          assignment_file_url: null,
          assignment_file_name: null
        })
        .eq('id', lesson.id)
      setLocalFileUrl(null)
      setLocalFileName(null)
      onRefresh()
    } catch (err: any) {
      alert(err.message || 'Failed to delete file.')
    }
  }

  async function save() {
    setSaving(true)
    await supabase
      .from('lessons')
      .update({
        assignment_prompt: prompt.trim() || null,
        assignment_required: required,
      })
      .eq('id', lesson.id)
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  async function remove() {
    setSaving(true)
    await supabase
      .from('lessons')
      .update({
        assignment_prompt: null,
        assignment_required: false,
        assignment_file_url: null,
        assignment_file_name: null
      })
      .eq('id', lesson.id)
    setPrompt('')
    setRequired(false)
    setLocalFileUrl(null)
    setLocalFileName(null)
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  if (!editing) {
    const hasContent = lesson.assignment_prompt || lesson.assignment_file_url
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl text-sm w-full"
        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fff' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4" />
            <span className="font-medium">Assignment</span>
          </div>
          {hasContent && (
            <div className="flex flex-col gap-1 mt-1">
              {lesson.assignment_prompt && (
                <p className="text-xs opacity-80 line-clamp-2">{lesson.assignment_prompt}</p>
              )}
              {lesson.assignment_file_url && (
                <Link href={lesson.assignment_file_url} target="_blank" className="text-xs text-violet-400 hover:text-violet-300 truncate">
                  {lesson.assignment_file_name || 'View Assignment File'}
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              onClick={remove}
              disabled={saving}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setPrompt(lesson.assignment_prompt || '');
              setRequired(lesson.assignment_required || false);
              setLocalFileUrl(lesson.assignment_file_url || null);
              setLocalFileName(lesson.assignment_file_name || null);
              setEditing(true)
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)'
            }}>
            {hasContent ? 'Edit' : 'Add'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-xl flex flex-col gap-3"
      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-white">Assignment Prompt</label>
      </div>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={3}
        placeholder="e.g. Write a 300-word analysis of today's strategy. Upload as PDF or type your answer."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none focus:border-amber-500/50"
      />

      {/* OR separator */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">OR</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* File Upload */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className="text-xs font-medium text-white">Assignment File</label>
          {localFileUrl && (
            <div className="flex items-center gap-2">
              <Link href={localFileUrl} target="_blank" className="text-xs text-violet-400 hover:text-violet-300 truncate max-w-[150px]">
                {localFileName}
              </Link>
              <button
                onClick={deleteAssignmentFile}
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <input
          type="file"
          accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          id={`assignment-file-${lesson.id}`}
          onChange={e => {
            const file = e.target.files?.[0] || null
            if (file) {
              handleFileUpload(file)
            }
          }}
        />
        <label htmlFor={`assignment-file-${lesson.id}`}
          className="block w-full text-center px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
          style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
          {uploadingFile ? 'Uploading...' : localFileUrl ? 'Replace File' : 'Upload File (PDF, TXT, MD, Images ≤5MB)'}
        </label>
      </div>

      {/* Toggle with description */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs" style={{ color: '#a1a1aa' }}>
          {required
            ? 'Students cannot proceed to next lesson before submitting assignment'
            : 'Students can proceed to next lesson without completing assignment'}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs" style={{ color: '#a1a1aa' }}>
            {required ? 'Required to proceed' : 'Optional'}
          </span>
          <button
            onClick={() => setRequired(v => !v)}
            className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
            style={{ background: required ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: required ? '20px' : '2px' }} />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || (!prompt.trim() && !localFileUrl)}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white violet-gradient disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Assignment'}
        </button>
      </div>
    </div>
  )
}

// ── DELETE MODULE MODAL ──
function DeleteModuleModal({
  module,
  onConfirm,
  onClose,
}: {
  module: CourseModule
  onConfirm: () => void
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#111', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Delete Module</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            Delete module <strong className="text-white">"{module.name}"</strong>? Lessons inside will
            be unassigned (not deleted). This cannot be undone.
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-300">
              Type <span className="text-white font-semibold">{module.name}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type module name here"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmText.trim() !== module.name.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#ef4444' }}>
              Delete Module
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DELETE LESSON MODAL ──
function DeleteLessonModal({
  lesson,
  onConfirm,
  onClose
}: {
  lesson: Lesson
  onConfirm: () => void
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Delete Lesson</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete the lesson <strong className="text-white">{lesson.title}</strong>? This action cannot be undone.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-300">
              To confirm, type the lesson name: <span className="text-white">{lesson.title}</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type lesson name here"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmText.trim() !== lesson.title.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#ef4444' }}
            >
              Delete Lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LESSON WIDGET ──
function LessonWidget({
  lesson,
  onDelete,
  onTogglePublish,
  onRefresh,
}: {
  lesson: Lesson
  onDelete: (id: string) => void
  onTogglePublish: (id: string, current: boolean) => void
  onRefresh: () => void
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('lessonId', lesson.id)
  }

  const [expanded, setExpanded] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [resourceSaving, setResourceSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  async function uploadNotes(file: File | null) {
    if (!file) return
    const lower = file.name.toLowerCase()
    const valid = lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.doc') || lower.endsWith('.docx')
    if (!valid) {
      setOperationError('Only PDF, text, markdown, or document files are allowed.')
      return
    }
    setOperationError('')
    setResourceSaving(true)
    try {
      const { publicUrl } = await uploadToSupabase(file, 'notes')
      const { error } = await supabase.from('lessons').update({ notes_url: publicUrl, notes_name: file.name }).eq('id', lesson.id)
      if (error) throw error
      onRefresh()
    } catch (err: any) {
      setOperationError(err.message || 'Notes upload failed.')
    } finally {
      setResourceSaving(false)
    }
  }

  async function deleteNotes() {
    setOperationError('')
    try {
      const { error } = await supabase.from('lessons').update({ notes_url: null, notes_name: null }).eq('id', lesson.id)
      if (error) throw error
      onRefresh()
    } catch (err: any) {
      setOperationError(err.message || 'Failed to delete notes.')
    }
  }

  const typeIcon = lesson.content_type === 'pdf'
    ? <FileText className="w-4 h-4" style={{ color: '#f59e0b' }} />
    : lesson.content_type === 'live'
      ? <span style={{ fontSize: 14 }}>📡</span>
      : lesson.content_type === 'quiz'
        ? <span style={{ fontSize: 14 }}>🧠</span>
        : lesson.content_type === 'assignment'
          ? <span style={{ fontSize: 14 }}>📝</span>
          : <Video className="w-4 h-4" style={{ color: '#8b5cf6' }} />

  return (
    <>
      {showDeleteModal && (
        <DeleteLessonModal
          lesson={lesson}
          onConfirm={() => onDelete(lesson.id)}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
      <div className="rounded-2xl overflow-hidden transition-all"
        draggable
        onDragStart={handleDragStart}
        style={{
          border: lesson.is_published
            ? '1px solid rgba(74,222,128,0.2)'
            : '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}>

        {/* Main row */}
        <div className="flex items-center gap-3 p-4">
          <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: '#3f3f46' }} />

          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#8b5cf6' }}>
            {String(lesson.order_num).padStart(2, '0')}
          </div>

          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            {typeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {lesson.duration && (
                <span className="text-xs" style={{ color: '#52525b' }}>{lesson.duration}</span>
              )}
              <span className="text-xs" style={{ color: lesson.is_published ? '#4ade80' : '#52525b' }}>
                {lesson.is_published ? '● Published' : '○ Draft'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Assignment: show Edit/Add button directly in the row */}
            {lesson.content_type === 'assignment' && (
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}>
                📝 {lesson.assignment_prompt || lesson.assignment_file_url ? 'Edit' : 'Add'}
              </button>
            )}
            {/* Quiz: show Edit Quiz directly in the row */}
            {lesson.content_type === 'quiz' && (
              <Link
                href={`/dashboard/courses/${lesson.course_id}/lessons/${lesson.id}/quiz`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}>
                🧠 {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0
                  ? `${lesson.quiz_questions.length} Qs`
                  : 'Add Qs'}
              </Link>
            )}

            <button
              onClick={() => onTogglePublish(lesson.id, lesson.is_published)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: lesson.is_published ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                color: lesson.is_published ? '#ef4444' : '#4ade80',
                border: lesson.is_published ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(74,222,128,0.2)',
              }}>
              {lesson.is_published
                ? <><EyeOff className="w-3 h-3" />Unpublish</>
                : <><Eye className="w-3 h-3" />Publish</>
              }
            </button>

            <button onClick={() => { setExpanded(!expanded); setOperationError('') }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="px-4 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <div className="pt-4 flex flex-col gap-3">

              {/* Inline error */}
              {operationError && (
                <div className="p-3 rounded-xl text-xs flex items-start gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {operationError}
                </div>
              )}

              {/* ── QUIZ: only quiz builder + delete ── */}
              {lesson.content_type === 'quiz' && (
                <>
                  <Link
                    href={`/dashboard/courses/${lesson.course_id}/lessons/${lesson.id}/quiz`}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      <div>
                        <p className="text-sm font-semibold text-white">Open Quiz Builder</p>
                        <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>
                          {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0
                            ? `${lesson.quiz_questions.length} question${lesson.quiz_questions.length !== 1 ? 's' : ''} added`
                            : 'No questions yet — click to add'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                  </Link>
                  {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0 && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete all quiz questions for this lesson?')) {
                          const { error } = await supabase.from('lessons').update({ quiz_questions: [] }).eq('id', lesson.id)
                          if (error) setOperationError(error.message)
                          else onRefresh()
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit"
                      style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <Trash2 className="w-3.5 h-3.5" /> Clear All Questions
                    </button>
                  )}
                  <button onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit"
                    style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Lesson
                  </button>
                </>
              )}

              {/* ── ASSIGNMENT: only assignment editor + delete ── */}
              {lesson.content_type === 'assignment' && (
                <>
                  <AssignmentEditor lesson={lesson} onRefresh={onRefresh} />
                  <button onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit"
                    style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Lesson
                  </button>
                </>
              )}

              {/* ── PDF: only quiz builder + delete ── */}
              {lesson.content_type === 'pdf' && (
                <>
                  <Link
                    href={`/dashboard/courses/${lesson.course_id}/lessons/${lesson.id}/quiz`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl text-sm"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#fff' }}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Quiz Builder</span>
                    </div>
                    <span className="text-xs" style={{ color: '#a78bfa' }}>
                      {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0
                        ? `${lesson.quiz_questions.length} questions`
                        : 'Add quiz'}
                    </span>
                  </Link>
                  <button onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit"
                    style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Lesson
                  </button>
                </>
              )}

              {/* ── VIDEO + LIVE: notes, quiz, assignment, delivery, live stuff, delete ── */}
              {(lesson.content_type === 'video' || lesson.content_type === 'live') && (
                <>
                  {/* Notes */}
                  <div className="p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white">📝 Notes</p>
                        {lesson.notes_url && (
                          <button onClick={deleteNotes}
                            className="w-5 h-5 flex items-center justify-center rounded"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {lesson.notes_url && (
                        <Link href={`/resource/${lesson.id}?type=notes`} target="_blank"
                          className="text-[10px] text-violet-400 hover:text-violet-300">View</Link>
                      )}
                    </div>
                    <p className="text-[10px] truncate mb-2" style={{ color: '#52525b' }}>
                      {lesson.notes_url ? lesson.notes_name || 'Uploaded' : 'Upload a PDF, doc or text file for students'}
                    </p>
                    <input type="file"
                      accept=".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden" id={`notes-${lesson.id}`}
                      onChange={e => uploadNotes(e.target.files?.[0] || null)}
                    />
                    <label htmlFor={`notes-${lesson.id}`}
                      className="block w-full text-center px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                      {resourceSaving ? 'Uploading...' : lesson.notes_url ? 'Replace Notes' : 'Upload Notes'}
                    </label>
                  </div>

                  {/* Quiz Builder */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl text-sm"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', color: '#fff' }}>
                    <Link href={`/dashboard/courses/${lesson.course_id}/lessons/${lesson.id}/quiz`}
                      className="flex-1 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Quiz Builder</span>
                    </Link>
                    {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0 && (
                      <button
                        onClick={async () => {
                          if (window.confirm('Delete this quiz?')) {
                            const { error } = await supabase.from('lessons').update({ quiz_questions: [] }).eq('id', lesson.id)
                            if (error) setOperationError(error.message)
                            else onRefresh()
                          }
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-xs text-violet-300">
                      {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0
                        ? `${lesson.quiz_questions.length} questions`
                        : 'Optional'}
                    </span>
                  </div>

                  {/* Assignment */}
                  <AssignmentEditor lesson={lesson} onRefresh={onRefresh} />

                  {/* Expected delivery (unpublished only) */}
                  {!lesson.is_published && (
                    <ExpectedDeliveryEditor lesson={lesson} onRefresh={onRefresh} />
                  )}

                  {/* Live session info */}
                  {lesson.content_type === 'live' && (
                    <div className="p-3 rounded-xl"
                      style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs font-semibold text-green-400 mb-1">📡 Live Session</p>
                          {lesson.live_scheduled_at && (
                            <p className="text-xs text-zinc-400">
                              {new Date(lesson.live_scheduled_at).toLocaleString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })} · {lesson.live_duration_minutes || 60} min
                            </p>
                          )}
                          {lesson.live_recording_url && (
                            <p className="text-xs mt-1" style={{ color: '#4ade80' }}>✓ Recording available</p>
                          )}
                        </div>
                        {lesson.live_join_url && (
                          <a href={lesson.live_join_url} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                            Join Link ↗
                          </a>
                        )}
                      </div>
                      <div className="mt-3">
                        <LiveRecordingEditor lesson={lesson} onRefresh={onRefresh} />
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  <button onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium w-fit"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Lesson
                  </button>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── LIVE SESSIONS TAB ──
interface LiveSession {
  id: string
  title: string
  description?: string | null
  scheduled_at: string
  duration_minutes: number
  join_url: string
  recording_url?: string | null
}

function LiveSessionsTab({ courseId, token }: { courseId: string; token: string }) {
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [fTitle, setFTitle] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fDate, setFDate] = useState('')
  const [fTime, setFTime] = useState('')
  const [fDuration, setFDuration] = useState('60')
  const [fJoinUrl, setFJoinUrl] = useState('')
  const [fRecordingUrl, setFRecordingUrl] = useState('')
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)
  const [recordingUrl, setRecordingUrlState] = useState('')
  const [savingRecording, setSavingRecording] = useState(false)

  useEffect(() => { fetchSessions() }, [courseId])

  async function fetchSessions() {
    setLoading(true)
    try {
      const res = await fetch(`/api/live-sessions?courseId=${courseId}`)
      const json = await res.json()
      setSessions(json.sessions || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }

  function openAddForm() {
    setEditingSession(null)
    setFTitle(''); setFDesc(''); setFDate(''); setFTime('')
    setFDuration('60'); setFJoinUrl(''); setFRecordingUrl('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(s: LiveSession) {
    setEditingSession(s)
    const dt = new Date(s.scheduled_at)
    setFTitle(s.title)
    setFDesc(s.description || '')
    setFDate(dt.toISOString().slice(0, 10))
    setFTime(dt.toISOString().slice(11, 16))
    setFDuration(String(s.duration_minutes))
    setFJoinUrl(s.join_url)
    setFRecordingUrl(s.recording_url || '')
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fTitle.trim() || !fDate || !fTime || !fJoinUrl.trim()) {
      setError('Title, date, time and join URL are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const scheduledAt = new Date(`${fDate}T${fTime}`).toISOString()
      const body = {
        courseId,
        title: fTitle.trim(),
        description: fDesc.trim() || null,
        scheduledAt,
        durationMinutes: parseInt(fDuration) || 60,
        joinUrl: fJoinUrl.trim(),
      }

      if (editingSession) {
        const res = await fetch(`/api/live-sessions/${editingSession.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed')
      } else {
        const res = await fetch('/api/live-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed')
      }

      setShowForm(false)
      await fetchSessions()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sessionId: string) {
    if (!confirm('Delete this live session?')) return
    await fetch(`/api/live-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchSessions()
  }

  async function saveRecording(sessionId: string) {
    if (!recordingUrl.trim()) return
    setSavingRecording(true)
    try {
      await fetch(`/api/live-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recording_url: recordingUrl.trim() }),
      })
      setRecordingSessionId(null)
      setRecordingUrlState('')
      await fetchSessions()
    } catch { /* non-fatal */ }
    finally { setSavingRecording(false) }
  }

  function formatSessionDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  function isUpcoming(iso: string) {
    return new Date(iso) > new Date()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Live Sessions</h2>
          <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
            Schedule Zoom/Meet classes — reminders auto-sent via Telegram
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Schedule Session
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-2xl p-5 glass" style={{ border: '1px solid rgba(124,58,237,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              {editingSession ? 'Edit Session' : 'New Live Session'}
            </h3>
            <button onClick={() => setShowForm(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Session Title *</label>
              <input value={fTitle} onChange={e => setFTitle(e.target.value)}
                placeholder="e.g. Live Q&A — Week 3"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Description (optional)</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                rows={2} placeholder="What will be covered in this session?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none focus:border-violet-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Date *</label>
                <input value={fDate} onChange={e => setFDate(e.target.value)}
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Time *</label>
                <input value={fTime} onChange={e => setFTime(e.target.value)}
                  type="time"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Duration (minutes)</label>
              <input value={fDuration} onChange={e => setFDuration(e.target.value)}
                type="number" min="15" max="480"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Zoom / Meet Join URL *</label>
              <input value={fJoinUrl} onChange={e => setFJoinUrl(e.target.value)}
                type="url" placeholder="https://zoom.us/j/... or meet.google.com/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
            {error && (
              <p className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : editingSession ? 'Save Changes' : 'Schedule Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Session list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl p-12 text-center glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Calendar className="w-6 h-6" style={{ color: '#8b5cf6' }} />
          </div>
          <p className="text-sm font-medium text-white mb-1">No live sessions yet</p>
          <p className="text-xs" style={{ color: '#52525b' }}>
            Schedule a session — students get automatic Telegram reminders 24h and 15 min before.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(s => {
            const upcoming = isUpcoming(s.scheduled_at)
            return (
              <div key={s.id} className="rounded-2xl p-5 glass"
                style={{ border: upcoming ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={upcoming
                          ? { background: 'rgba(124,58,237,0.15)', color: '#8b5cf6' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#52525b' }}>
                        {upcoming ? 'Upcoming' : 'Past'}
                      </span>
                      {s.recording_url && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          Recording added
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs mb-2" style={{ color: '#a1a1aa' }}>{s.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        {formatSessionDate(s.scheduled_at)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
                        <Clock className="w-3.5 h-3.5" />
                        {s.duration_minutes} min
                      </span>
                      <a href={s.join_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs hover:underline"
                        style={{ color: '#8b5cf6' }}>
                        <LinkIcon className="w-3.5 h-3.5" />
                        Join link
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEditForm(s)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add recording (for past sessions without one) */}
                {!upcoming && !s.recording_url && recordingSessionId !== s.id && (
                  <button
                    onClick={() => { setRecordingSessionId(s.id); setRecordingUrlState('') }}
                    className="text-xs px-3 py-1.5 rounded-lg mt-1"
                    style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                    + Add Recording URL
                  </button>
                )}

                {recordingSessionId === s.id && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={recordingUrl}
                      onChange={e => setRecordingUrlState(e.target.value)}
                      type="url"
                      placeholder="Recording link..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
                    />
                    <button onClick={() => saveRecording(s.id)} disabled={savingRecording}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient disabled:opacity-50">
                      {savingRecording ? '...' : 'Save'}
                    </button>
                    <button onClick={() => setRecordingSessionId(null)}
                      className="px-3 py-2 rounded-xl text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── CERTIFICATE PREVIEW MODAL ──
function CertificatePreviewModal({
  isOpen,
  onClose,
  template,
  courseName,
  creatorName,
  skills,
  courseDuration,
  logoUrl,
  signatureUrl,
  customMessage,
}: {
  isOpen: boolean
  onClose: () => void
  template: string
  courseName: string
  creatorName: string
  skills?: string
  courseDuration?: string
  logoUrl?: string
  signatureUrl?: string
  customMessage?: string
}) {
  if (!isOpen) return null

  const templateStyles: Record<string, any> = {
    classic: {
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)',
      borderColor: '#1a2744',
      accentColor: '#c9a227',
      textColor: '#1a2744',
    },
    modern: {
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
      borderColor: '#7c3aed',
      accentColor: '#7c3aed',
      textColor: '#ffffff',
    },
    gold: {
      background: 'linear-gradient(135deg, #fdf8ed 0%, #f5ecd8 100%)',
      borderColor: '#c9a227',
      accentColor: '#c9a227',
      textColor: '#3d2b1f',
    },
    minimal: {
      background: '#ffffff',
      borderColor: '#7c3aed',
      accentColor: '#7c3aed',
      textColor: '#000000',
    },
    royal: {
      background: 'linear-gradient(135deg, #060d2e 0%, #0a1440 100%)',
      borderColor: '#d4af37',
      accentColor: '#d4af37',
      textColor: '#ffffff',
    },
  }

  const style = templateStyles[template] || templateStyles.classic

  const skillsArray = skills
    ? skills.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col max-h-[95vh]" style={{ background: '#111', border: '1px solid rgba(124,58,237,0.3)' }}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-lg font-semibold text-white">Certificate Preview</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-6 flex-1 overflow-auto" style={{ background: '#0a0a0a' }}>
          <div
            className="w-full aspect-[1.414/1] rounded-xl overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col items-center justify-center mx-auto"
            style={{ background: style.background, border: `4px solid ${style.borderColor}` }}
          >
            {/* Logo */}
            {logoUrl && (
              <div className="mb-4 md:mb-6">
                <img src={logoUrl} alt="Brand Logo" className="h-12 md:h-16 object-contain" />
              </div>
            )}

            {/* Certificate Header */}
            <p
              className="text-xs tracking-[0.2em] uppercase mb-3 md:mb-4"
              style={{ color: style.accentColor }}
            >
              Certificate of Completion
            </p>

            {/* Student Name */}
            <h1
              className="text-2xl md:text-4xl font-bold mb-2"
              style={{ color: style.textColor }}
            >
              John Doe
            </h1>
            <div className="w-16 md:w-24 h-1 mb-3 md:mb-4" style={{ background: style.accentColor }} />

            {/* Course Name */}
            <p
              className="text-lg md:text-xl mb-4 md:mb-6 text-center"
              style={{ color: style.textColor }}
            >
              has successfully completed <strong>{courseName}</strong>
            </p>

            {/* Skills */}
            {skillsArray.length > 0 && (
              <div className="mb-4 md:mb-6 flex flex-wrap gap-2 justify-center">
                {skillsArray.slice(0, 4).map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 md:px-3 py-1 rounded-full text-xs"
                    style={{ background: `${style.accentColor}20`, color: style.accentColor, border: `1px solid ${style.accentColor}40` }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Duration */}
            {courseDuration && (
              <p
                className="text-xs md:text-sm mb-4 md:mb-6"
                style={{ color: style.textColor + 'cc' }}
              >
                Duration: {courseDuration}
              </p>
            )}

            {/* Custom Message */}
            {customMessage && (
              <p
                className="text-xs md:text-sm mb-4 md:mb-6 italic text-center max-w-md"
                style={{ color: style.textColor + 'aa' }}
              >
                "{customMessage}"
              </p>
            )}

            {/* Signature */}
            <div className="flex items-center justify-between w-full max-w-md mt-auto">
              <div className="text-center">
                {signatureUrl ? (
                  <img src={signatureUrl} alt="Signature" className="h-10 md:h-16 object-contain mb-2" />
                ) : (
                  <div className="h-10 md:h-12 w-24 md:w-32 border-b mb-2" style={{ borderColor: style.textColor + '60' }} />
                )}
                <p className="text-xs md:text-sm font-semibold" style={{ color: style.textColor }}>
                  {creatorName}
                </p>
                <p className="text-xs" style={{ color: style.textColor + '80' }}>
                  Instructor
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs md:text-sm font-semibold" style={{ color: style.textColor }}>
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs" style={{ color: style.textColor + '80' }}>
                  Issue Date
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──
export default function CourseManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [modules, setModules] = useState<CourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedModuleForLesson, setSelectedModuleForLesson] = useState('')
  const [showModuleModal, setShowModuleModal] = useState(false)

  const [addContentType, setAddContentType] = useState<'video' | 'pdf' | 'live' | 'quiz' | 'assignment'>('video')
  const [deletingModule, setDeletingModule] = useState<CourseModule | null>(null)
  const [delayMessage, setDelayMessage] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastSent, setBroadcastSent] = useState(false)
  const [creatorId, setCreatorId] = useState('')
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const publishingRef = useRef(false)
  const [activeTab, setActiveTab] = useState<'lessons' | 'settings'>('lessons')
  const [token, setToken] = useState('')

  // Settings state
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editOriginalPrice, setEditOriginalPrice] = useState('')
  const [editHostName, setEditHostName] = useState('')
  const [editAbout, setEditAbout] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editPlannedLessons, setEditPlannedLessons] = useState('')
  const [editNextLessonDate, setEditNextLessonDate] = useState('')
  const [editCourseEndDate, setEditCourseEndDate] = useState('')
  const [editStudentMessage, setEditStudentMessage] = useState('')
  const [editLearn, setEditLearn] = useState<string[]>([])
  const [editFaq, setEditFaq] = useState<{ question: string; answer: string }[]>([])
  const [editHostImage, setEditHostImage] = useState('')
  const [editFreePreview, setEditFreePreview] = useState('nothing free')
  const [editCertEnabled, setEditCertEnabled] = useState(true)
  const [editCertTemplate, setEditCertTemplate] = useState<string>('classic')
  const [editCertCustomMessage, setEditCertCustomMessage] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [editSkills, setEditSkills] = useState('') // comma-separated in the UI
  const [editCertLogoUrl, setEditCertLogoUrl] = useState('')
  const [editCertSignatureUrl, setEditCertSignatureUrl] = useState('')
  const [showCertPreview, setShowCertPreview] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<string>('classic')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCreatorId(user.id)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) setToken(session.access_token)

      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single()

      if (!courseData) { router.push('/dashboard/courses'); return }
      setCourse(courseData)

      // Init settings state
      setEditName(courseData.name)
      setEditDesc(courseData.description)
      setEditPrice(courseData.price.toString())
      setEditOriginalPrice(courseData.original_price?.toString() || '')
      setEditHostName(courseData.host_name || '')
      setEditAbout(courseData.about_creator || '')
      setEditStartDate(courseData.start_date || '')
      setEditStartTime(courseData.start_time || '')
      setEditDuration(courseData.duration || '')

      setEditSkills(Array.isArray(courseData.skills) ? courseData.skills.join(', ') : '')
      setEditPlannedLessons(courseData.total_lessons?.toString() || '')
      setEditNextLessonDate(courseData.next_lesson_date || '')
      setEditCourseEndDate(courseData.course_end_date || '')
      setEditStudentMessage(courseData.student_update_message || '')
      setEditLearn(courseData.what_you_will_learn || [''])
      setEditFaq(courseData.faq || [{ question: '', answer: '' }])
      setEditHostImage(courseData.host_image || '')
      setEditFreePreview(courseData.free_preview_config || 'nothing free')
      setEditCertEnabled(courseData.cert_enabled !== false)
      setEditCertTemplate(courseData.cert_template || 'classic')
      setEditCertCustomMessage(courseData.cert_custom_message || '')
      setEditCertLogoUrl(courseData.cert_logo_url || '')
      setEditCertSignatureUrl(courseData.cert_signature_url || '')

      await Promise.all([fetchLessons(), fetchModules()])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be 2MB or smaller.')
      return
    }

    setUploadingImage(true)
    try {
      const { publicUrl } = await uploadToSupabase(file, 'images')
      setEditHostImage(publicUrl)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  async function updateSettings() {
    setSavingSettings(true)
    const { error } = await supabase
      .from('courses')
      .update({
        name: editName,
        description: editDesc,
        price: parseInt(editPrice),
        original_price: editOriginalPrice ? parseInt(editOriginalPrice) : parseInt(editPrice),
        host_name: editHostName,
        about_creator: editAbout,
        start_date: editStartDate,
        start_time: editStartTime,
        duration: editDuration,
        total_lessons: editPlannedLessons ? parseInt(editPlannedLessons) : lessons.length,
        next_lesson_date: editNextLessonDate || null,
        course_end_date: editCourseEndDate || null,
        student_update_message: editStudentMessage.trim() || null,
        what_you_will_learn: editLearn.filter(l => l.trim()),
        faq: editFaq.filter(f => f.question.trim() && f.answer.trim()),
        host_image: editHostImage,
        free_preview_config: editFreePreview,
        cert_enabled: editCertEnabled,
        cert_template: editCertTemplate,
        cert_logo_url: editCertLogoUrl || null,
        cert_signature_url: editCertSignatureUrl || null,
        cert_custom_message: editCertCustomMessage.trim() || null,
        skills: editSkills.trim()
          ? editSkills.split(',').map(s => s.trim()).filter(Boolean)
          : null,
      })
      .eq('id', id)

    if (!error) {
      setCourse({
        ...course!,
        name: editName,
        description: editDesc,
        price: parseInt(editPrice),
        original_price: editOriginalPrice ? parseInt(editOriginalPrice) : parseInt(editPrice),
        host_name: editHostName,
        about_creator: editAbout,
        start_date: editStartDate,
        start_time: editStartTime,
        duration: editDuration,
        total_lessons: editPlannedLessons ? parseInt(editPlannedLessons) : lessons.length,
        next_lesson_date: editNextLessonDate || undefined,
        course_end_date: editCourseEndDate || undefined,
        student_update_message: editStudentMessage.trim() || undefined,
        what_you_will_learn: editLearn.filter(l => l.trim()),
        faq: editFaq.filter(f => f.question.trim() && f.answer.trim()),
        host_image: editHostImage,
        free_preview_config: editFreePreview,
      })
    }
    setSavingSettings(false)
  }

  async function handleDeleteCourse() {
    if (deleteInput !== course?.name) return
    setIsDeleting(true)
    try {
      // 1. Get lesson IDs first — needed for lesson_access_logs cleanup
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', id)

      const lessonIds = (lessonRows || []).map((l: any) => l.id)

      // 2. Delete lesson_access_logs (no FK cascade, must be manual)
      if (lessonIds.length > 0) {
        await supabase
          .from('lesson_access_logs')
          .delete()
          .in('lesson_id', lessonIds)
      }

      // 3. Delete payments (no CASCADE on course_id FK)
      await supabase
        .from('payments')
        .delete()
        .eq('course_id', id)

      // 4. Delete enrollments
      await supabase
        .from('enrollments')
        .delete()
        .eq('course_uuid', id)

      // 5. Delete lessons
      await supabase
        .from('lessons')
        .delete()
        .eq('course_id', id)

      // 6. Delete course_modules
      await supabase
        .from('course_modules')
        .delete()
        .eq('course_id', id)

      // 7. Delete course — telegram_tokens, coupons, email_logs
      //    handled automatically by DB CASCADE / SET NULL
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)

      if (error) throw error

      router.push('/dashboard/courses')
    } catch (err: any) {
      alert('Error deleting course: ' + err.message)
    }
    setIsDeleting(false)
  }

  async function sendDelayBroadcast() {
    if (!delayMessage.trim() || broadcastSending) return
    setBroadcastSending(true)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: id, message: delayMessage.trim() }),
      })
      if (res.ok) {
        setBroadcastSent(true)
        setDelayMessage('')
        setTimeout(() => setBroadcastSent(false), 4000)
      }
    } catch { /* non-fatal */ }
    setBroadcastSending(false)
  }


  async function fetchLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', id)
      .order('order_num', { ascending: true })
    setLessons(data || [])
  }

  async function fetchModules() {
    const { data } = await supabase
      .from('course_modules')
      .select('*')
      .eq('course_id', id)
      .order('order_num', { ascending: true })
    setModules(data || [])
  }

  async function deleteLesson(lessonId: string) {
    await supabase.from('lessons').delete().eq('id', lessonId)

    // Renumber remaining lessons to fill gap
    await renumberLessons(supabase, id)

    await fetchLessons()
  }

  async function toggleLessonPublish(lessonId: string, current: boolean) {
    await supabase
      .from('lessons')
      .update({ is_published: !current })
      .eq('id', lessonId)
    await fetchLessons()
  }

  async function publishAllLessons() {
    if (publishingRef.current) return

    publishingRef.current = true
    setPublishing(true)

    try {
      const { error: lessonsError } = await supabase
        .from('lessons')
        .update({ is_published: true })
        .eq('course_id', id)

      if (lessonsError) throw lessonsError

      // Also publish the course itself
      const { error: courseError } = await supabase
        .from('courses')
        .update({ is_published: true })
        .eq('id', id)

      if (courseError) throw courseError

      if (course) setCourse({ ...course, is_published: true })
      await fetchLessons()
    } catch (err: any) {
      console.error('Failed to publish all lessons:', err)
      alert(err?.message || 'Failed to publish all lessons. Please try again.')
    } finally {
      publishingRef.current = false
      setPublishing(false)
    }
  }

  async function deleteModule(moduleId: string) {
  await supabase.from('lessons').update({ module_id: null }).eq('module_id', moduleId)
  await supabase.from('course_modules').delete().eq('id', moduleId)
  await fetchModules()
  await fetchLessons()
  setDeletingModule(null)
}

  async function toggleCoursePublish() {
    if (!course) return
    const newState = !course.is_published
    await supabase
      .from('courses')
      .update({ is_published: newState })
      .eq('id', id)
    setCourse({ ...course, is_published: newState })
  }

  async function handleLessonDrop(lessonId: string, moduleId: string | null) {
    const { error } = await supabase
      .from('lessons')
      .update({ module_id: moduleId })
      .eq('id', lessonId)

    if (error) {
      alert('Failed to move lesson: ' + error.message)
      return
    }

    await fetchLessons()
  }

  function copyCourseLink() {
    if (!course) return
    const url = `${window.location.origin}/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const publishedCount = lessons.filter(l => l.is_published).length
  const allPublished = lessons.length > 0 && publishedCount === lessons.length
  const plannedTotal = Math.max(course?.total_lessons || 0, lessons.length)
  const remainingLessons = Math.max(plannedTotal - publishedCount, 0)
  const courseUrl = course ? `${window.location.origin}/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}` : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
      </div>
    )
  }

  if (!course) return null

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />

      {showAddModal && (
        <AddLessonModal
          onClose={() => {
            setShowAddModal(false)
            setSelectedModuleForLesson('')
          }}
          onAdd={fetchLessons}
          courseId={id}
          creatorId={creatorId}
          nextOrder={lessons.length + 1}
          modules={modules}
          initialModuleId={selectedModuleForLesson}
          initialType={addContentType}
        />
      )}


      {showModuleModal && (
        <AddModuleModal
          onClose={() => setShowModuleModal(false)}
          onAdd={fetchModules}
          courseId={id}
          nextOrder={modules.length + 1}
        />
      )}
      {deletingModule && (
        <DeleteModuleModal
          module={deletingModule}
          onConfirm={() => deleteModule(deletingModule.id)}
          onClose={() => setDeletingModule(null)}
        />
      )}

      <main className="md:ml-56 p-6 md:p-8">



        {/* Deletion Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
            <div className="w-full max-w-md rounded-2xl p-8"
              style={{ background: '#0a0a0a', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">Delete Course Permanently?</h2>
              <p className="text-sm text-zinc-400 text-center mb-6">
                This will permanently delete the course <strong className="text-white">"{course.name}"</strong> and all its data. This action cannot be undone.
              </p>

              <div className="mb-6">
                <p className="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-widest">Type course name to confirm:</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder={course.name}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteModal(false); setDeleteInput('') }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-zinc-400 bg-white/5 hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button onClick={handleDeleteCourse}
                  disabled={deleteInput !== course.name || isDeleting}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-30 transition-all">
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <button onClick={() => router.push('/dashboard/courses')}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white truncate">{course.name}</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: course.is_published ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                  color: course.is_published ? '#4ade80' : '#52525b',
                  border: course.is_published ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                {course.is_published ? '● Live' : '○ Draft'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-4 border-b border-white/5">
              {(['lessons', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 text-sm font-medium capitalize transition-all relative"
                  style={{ color: activeTab === tab ? '#8b5cf6' : '#52525b' }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8b5cf6]" />
                  )}
                </button>
              ))}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Content ── */}
          <div className="lg:col-span-2">
            {activeTab === 'lessons' ? (
              <>
                {/* Content header */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white">Course Content</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                      {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} · {publishedCount} published
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">

                  {/* Add Module */}
                  <button
                    onClick={() => setShowModuleModal(true)}
                    className="flex flex-col items-start p-4 rounded-2xl text-left transition-all hover:opacity-90"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">📁</span>
                      <span className="text-sm font-bold text-white">Add Module</span>
                      <Plus className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: '#8b5cf6' }} />
                    </div>
                    <p className="text-xs mb-3" style={{ color: '#71717a' }}>Group lessons into weeks or topics</p>
                    <div className="flex flex-col gap-1 w-full text-[10px]">
                      <div className="px-2 py-1 rounded font-semibold" style={{ background: 'rgba(124,58,237,0.18)', color: '#a78bfa' }}>📁 Module 1</div>
                      <div className="ml-3 px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#52525b' }}>↳ Lesson · Lesson · ···</div>
                      <div className="px-2 py-1 rounded font-semibold mt-0.5" style={{ background: 'rgba(124,58,237,0.08)', color: '#52525b' }}>📁 Module 2</div>
                      <div className="ml-3 px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', color: '#3f3f46' }}>↳ Lesson · ···</div>
                    </div>
                  </button>

                  {/* Add Lesson */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: '#52525b' }}>Add Lesson</p>
                    {([
                      { label: 'Video', icon: '🎬', type: 'video' as const },
                      { label: 'PDF', icon: '📄', type: 'pdf' as const },
                      { label: 'Live Session', icon: '📡', type: 'live' as const },
                      { label: 'Quiz', icon: '🧠', type: 'quiz' as const },
                      { label: 'Assignment', icon: '📝', type: 'assignment' as const },
                    ]).map((btn, i) => (
                      <button key={i}
                        onClick={() => { setAddContentType(btn.type); setShowAddModal(true) }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 text-left w-full"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span>{btn.icon}</span> {btn.label}
                      </button>
                    ))}
                  </div>

                </div>
              </div>

                {/* Lesson list */}
                {lessons.length === 0 && modules.length === 0 ? (
                  <div className="rounded-2xl p-12 text-center glass"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Video className="w-10 h-10 mx-auto mb-3" style={{ color: '#3f3f46' }} />
                    <p className="text-sm font-medium text-white mb-1">No lessons yet</p>
                    <p className="text-xs mb-4" style={{ color: '#52525b' }}>
                      Add your first lesson to get started
                    </p>
                    <button onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90">
                      <Plus className="w-4 h-4" />Add Lesson 1
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {modules.map(module => {
                      const moduleLessons = lessons.filter(lesson => lesson.module_id === module.id)
                      return (
                        <div key={module.id} className="rounded-2xl p-4 transition-all"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            const lessonId = e.dataTransfer.getData('lessonId')
                            if (lessonId) handleLessonDrop(lessonId, module.id)
                          }}
                          style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-center justify-between mb-3 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white truncate">{module.name}</h3>
                                <button
                                  onClick={() => setDeletingModule(module)}
                                  className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
                                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                                  title="Delete module">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                                {moduleLessons.length} lesson{moduleLessons.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button onClick={() => {
                              setSelectedModuleForLesson(module.id)
                              setShowAddModal(true)
                            }}
                              className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                              style={{ background: 'rgba(124,58,237,0.12)', color: '#8b5cf6', border: '1px solid rgba(124,58,237,0.2)' }}>
                              + Lesson
                            </button>
                          </div>

                          <div className="flex flex-col gap-3">
                            {moduleLessons.length === 0 ? (
                              <p className="text-xs py-3" style={{ color: '#52525b' }}>No lessons in this module yet.</p>
                            ) : moduleLessons.map(lesson => (
                              <LessonWidget
                                key={lesson.id}
                                lesson={lesson}
                                onDelete={deleteLesson}
                                onTogglePublish={toggleLessonPublish}
                                onRefresh={fetchLessons}
                              />
                            ))}
                            {module.planned_lessons > 0 && moduleLessons.length >= module.planned_lessons && (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl"
                                style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.18)' }}>
                                <p className="text-xs" style={{ color: '#eab308' }}>
                                  📋 You planned {module.planned_lessons} lesson{module.planned_lessons !== 1 ? 's' : ''} for this module — all added. Start a new module or keep adding here.
                                </p>
                                <div className="flex gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => { setSelectedModuleForLesson(module.id); setShowAddModal(true) }}
                                    className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                    style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                                    Continue Here
                                  </button>
                                  <button onClick={() => setShowModuleModal(true)}
                                    className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                    style={{ background: 'rgba(124,58,237,0.1)', color: '#8b5cf6', border: '1px solid rgba(124,58,237,0.2)' }}>
                                    New Module
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const lessonId = e.dataTransfer.getData('lessonId')
                        if (lessonId) handleLessonDrop(lessonId, null)
                      }}
                      className="flex flex-col gap-3 min-h-[50px]"
                    >
                      {lessons.filter(lesson => !lesson.module_id).map(lesson => (
                        <LessonWidget
                          key={lesson.id}
                          lesson={lesson}
                          onDelete={deleteLesson}
                          onTogglePublish={toggleLessonPublish}
                          onRefresh={fetchLessons}
                        />
                      ))}
                    </div>

                    {/* Add next lesson */}
                    <button onClick={() => setShowAddModal(true)}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        color: '#52525b',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
                        e.currentTarget.style.color = '#8b5cf6'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.color = '#52525b'
                      }}>
                      <Plus className="w-4 h-4" />
                      Add Lesson {lessons.length + 1}
                    </button>

                    {/* Publish all */}
                    {!allPublished && lessons.length > 0 && (
                      <button onClick={publishAllLessons} disabled={publishing}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-50"
                        style={{
                          background: 'rgba(74,222,128,0.08)',
                          border: '1px solid rgba(74,222,128,0.2)',
                          color: '#4ade80',
                        }}>
                        <CheckCircle className="w-4 h-4" />
                        {publishing ? 'Publishing...' : `Publish All ${lessons.length} Lessons`}
                      </button>
                    )}

                    {allPublished && (
                      <div className="flex items-center gap-2 p-3 rounded-xl"
                        style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
                        <p className="text-sm" style={{ color: '#4ade80' }}>
                          All lessons published
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            
            ) : (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl p-6 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h2 className="font-semibold text-white mb-5">Course Settings</h2>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Course Name</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Description</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Price (₹)</label>
                        <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Original Price (₹)</label>
                        <input value={editOriginalPrice} onChange={e => setEditOriginalPrice(e.target.value)} type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Free Preview Configuration</label>
                      <select
                        value={editFreePreview}
                        onChange={e => setEditFreePreview(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                        style={{ background: '#050505', color: '#fff' }}
                      >
                        <option value="completely free" style={{ background: '#050505', color: '#fff' }}>Completely free (no payment required)</option>
                        <option value="nothing free" style={{ background: '#050505', color: '#fff' }}>Nothing free (Pay immediately)</option>
                        <option value="lesson 1 free" style={{ background: '#050505', color: '#fff' }}>Lesson 1 free</option>
                        <option value="2 lessons free" style={{ background: '#050505', color: '#fff' }}>2 lessons free</option>
                        <option value="3 lessons free" style={{ background: '#050505', color: '#fff' }}>3 lessons free</option>
                        <option value="module 1 free" style={{ background: '#050505', color: '#fff' }}>Module 1 free</option>
                        <option value="2 modules free" style={{ background: '#050505', color: '#fff' }}>2 modules free</option>
                      </select>
                      <p className="text-[10px] text-zinc-500 mt-1.5">Select how much content is free for students</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Start Date</label>
                        <input value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Start Time</label>
                        <input value={editStartTime} onChange={e => setEditStartTime(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Duration</label>
                        <input value={editDuration} onChange={e => setEditDuration(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                      </div>
                    </div>


                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Skills Covered (comma separated, for certificate)</label>
                      <input value={editSkills} onChange={e => setEditSkills(e.target.value)}
                        placeholder="e.g. SEO, Content Marketing, Keyword Research"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">What You Will Learn</label>
                      <div className="flex flex-col gap-2">
                        {editLearn.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <input value={item} onChange={e => {
                              const next = [...editLearn]; next[i] = e.target.value; setEditLearn(next)
                            }} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none" />
                            <button onClick={() => setEditLearn(editLearn.filter((_, idx) => idx !== i))}
                              className="p-2 text-zinc-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                        <button onClick={() => setEditLearn([...editLearn, ''])}
                          className="text-xs text-violet-400 hover:text-violet-300 w-fit font-medium">+ Add Point</button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Instructor Photo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                          {editHostImage ? (
                            <img src={editHostImage} alt="Instructor" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-zinc-700">
                              {editHostName ? editHostName.charAt(0).toUpperCase() : '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            id="host-image"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                          />
                          <label
                            htmlFor="host-image"
                            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10 transition-all"
                          >
                            {uploadingImage ? 'Uploading...' : 'Change Photo'}
                          </label>
                          <p className="text-[10px] text-zinc-500 mt-1.5">Square JPG/PNG recommended (max 2MB)</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">About Instructor</label>
                      <input value={editHostName} onChange={e => setEditHostName(e.target.value)} placeholder="Name"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-2" />
                      <textarea value={editAbout} onChange={e => setEditAbout(e.target.value)} rows={2} placeholder="Bio"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Frequently Asked Questions</label>
                      <div className="flex flex-col gap-3">
                        {editFaq.map((faq, i) => (
                          <div key={i} className="p-4 rounded-xl relative flex flex-col gap-2"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <button onClick={() => setEditFaq(editFaq.filter((_, idx) => idx !== i))}
                              className="absolute top-4 right-4 text-zinc-600 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <input
                              value={faq.question}
                              onChange={e => {
                                const next = [...editFaq]; next[i].question = e.target.value; setEditFaq(next)
                              }}
                              placeholder="Question"
                              className="w-full bg-transparent text-sm text-white font-medium outline-none pr-8"
                            />
                            <textarea
                              value={faq.answer}
                              onChange={e => {
                                const next = [...editFaq]; next[i].answer = e.target.value; setEditFaq(next)
                              }}
                              placeholder="Answer"
                              rows={2}
                              className="w-full bg-transparent text-sm text-zinc-400 outline-none resize-none"
                            />
                          </div>
                        ))}
                        <button onClick={() => setEditFaq([...editFaq, { question: '', answer: '' }])}
                          className="text-xs text-violet-400 hover:text-violet-300 w-fit font-medium">+ Add FAQ</button>
                      </div>
                    </div>
                    {/* Certificate Settings */}
                    <div className="pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Completion Certificates</p>
                          <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                            Auto-issued as PDF when a student completes all lessons
                          </p>
                        </div>
                        <button
                          onClick={() => setEditCertEnabled(v => !v)}
                          className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                          style={{ background: editCertEnabled ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
                        >
                          <div
                            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: editCertEnabled ? '24px' : '4px' }}
                          />
                        </button>
                      </div>

                      {editCertEnabled && (
                        <div className="flex flex-col gap-4 mt-2">
                          {/* Template picker */}
                          <div>
                            <label className="text-xs font-medium text-zinc-500 mb-2 block">Certificate Template</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {([
                                { id: 'classic', label: 'Classic', desc: 'White · Navy border · Gold accents' },
                                { id: 'modern', label: 'Modern', desc: 'Dark · Violet accents · Clean' },
                                { id: 'gold', label: 'Gold', desc: 'Ivory · Ornate gold borders' },
                                { id: 'minimal', label: 'Minimal', desc: 'Pure white · Ultra clean' },
                                { id: 'royal', label: 'Royal', desc: 'Deep navy · Gold typography' },
                              ] as const).map(t => (
                                <div
                                  key={t.id}
                                  className="flex items-center gap-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setEditCertTemplate(t.id)}
                                    className="flex-1 flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                                    style={{
                                      background: editCertTemplate === t.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                      border: editCertTemplate === t.id
                                        ? '1px solid rgba(124,58,237,0.45)'
                                        : '1px solid rgba(255,255,255,0.08)',
                                    }}
                                  >
                                    {/* Tiny colour swatch */}
                                    <div
                                      className="w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
                                      style={{
                                        background:
                                          t.id === 'classic' ? 'linear-gradient(135deg,#1a2744,#c9a227)' :
                                            t.id === 'modern' ? 'linear-gradient(135deg,#0f0f1a,#7c3aed)' :
                                              t.id === 'gold' ? 'linear-gradient(135deg,#fdf8ed,#c9a227)' :
                                                t.id === 'minimal' ? 'linear-gradient(135deg,#ffffff,#7c3aed)' :
                                                  'linear-gradient(135deg,#060d2e,#d4af37)',
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-white">{t.label}</p>
                                      <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{t.desc}</p>
                                    </div>
                                    {editCertTemplate === t.id && (
                                      <div
                                        className="ml-auto flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: '#7c3aed', marginTop: 2 }}
                                      >
                                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                          <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </div>
                                    )}
                                  </button>
                                  {/* Preview icon button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setPreviewTemplate(t.id)
                                      setShowCertPreview(true)
                                    }}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/10"
                                    style={{
                                      background: 'rgba(255,255,255,0.03)',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      color: '#a1a1aa',
                                    }}
                                    title={`Preview ${t.label} template`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Brand Logo (optional)</label>
                              <input type="file" accept="image/png,image/jpeg" id="cert-logo"
                                className="hidden"
                                onChange={async e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  const { publicUrl } = await uploadToSupabase(file, 'cert-assets')
                                  setEditCertLogoUrl(publicUrl)
                                }} />
                              <label htmlFor="cert-logo" className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10">
                                {editCertLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                              </label>
                              {editCertLogoUrl && <span className="text-xs text-zinc-500 ml-2">Uploaded</span>}
                            </div>

                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Instructor Signature (optional)</label>
                              <input type="file" accept="image/png,image/jpeg" id="cert-sig"
                                className="hidden"
                                onChange={async e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  const { publicUrl } = await uploadToSupabase(file, 'cert-assets')
                                  setEditCertSignatureUrl(publicUrl)
                                }} />
                              <label htmlFor="cert-sig" className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10">
                                {editCertSignatureUrl ? 'Replace Signature' : 'Upload Signature'}
                              </label>
                              {editCertSignatureUrl && <span className="text-xs text-zinc-500 ml-2">Uploaded</span>}
                            </div>
                          </div>

                          {/* Custom message */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium text-zinc-500">Custom Message on Certificate</label>
                              <span className="text-xs" style={{ color: '#52525b' }}>{editCertCustomMessage.length}/120</span>
                            </div>
                            <input
                              type="text"
                              value={editCertCustomMessage}
                              onChange={e => setEditCertCustomMessage(e.target.value.slice(0, 120))}
                              placeholder="e.g. Keep building, keep shipping. — Your Name"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
                            />
                            <p className="text-xs mt-1" style={{ color: '#52525b' }}>
                              Appears as a small line on the certificate. Leave blank to omit.
                            </p>
                          </div>

                          {/* Preview badge */}
                          <div
                            className="flex items-center gap-3 p-3 rounded-xl"
                            style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)' }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                            </svg>
                            <p className="text-xs" style={{ color: '#a1a1aa' }}>
                              Students get a PDF certificate at{' '}
                              <span style={{ color: '#d4af37' }}>
                                academykit.in/certificate/[ID]
                              </span>{' '}
                              — shareable verification link included.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={updateSettings} disabled={savingSettings}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50 mt-4">
                      {savingSettings ? 'Saving Changes...' : 'Save All Changes'}
                    </button>

                    {/* Danger Zone */}
                    <div className="mt-12 pt-8 border-t border-red-500/20">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest">Danger Zone</h3>
                      </div>
                      <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-white mb-1">Delete Course</p>
                          <p className="text-xs text-zinc-500">
                            Permanently delete this course and all its data. This cannot be undone.
                          </p>
                        </div>
                        <button onClick={() => setShowDeleteModal(true)}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500/10 text-red-500 hover:bg-red-500 border border-red-500/20 hover:text-white transition-all whitespace-nowrap">
                          Delete Course
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Course Info + Share ── */}
          <div className="flex flex-col gap-4">

            
            {/* Publish toggle */}
            <div className="rounded-2xl p-5"
              style={{
                background: course.is_published ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
                border: course.is_published ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {course.is_published ? 'Course is Live' : 'Course is Draft'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                    {course.is_published
                      ? 'Students can find and enroll'
                      : 'Course page hidden · enrollment blocked · enrolled students unaffected'}
                  </p>
                </div>
                <button onClick={toggleCoursePublish}
                  className="relative w-12 h-6 rounded-full transition-all"
                  style={{ background: course.is_published ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: course.is_published ? '28px' : '4px' }} />
                </button>
              </div>
              {!course.is_published && lessons.length === 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <p className="text-xs" style={{ color: '#f59e0b' }}>
                    Add at least one lesson before publishing
                  </p>
                </div>
              )}
            </div>

            {/* Course page preview */}
            <div className="rounded-2xl p-5 glass"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                Course Page
              </h3>
              <p className="text-xs mb-3" style={{ color: '#52525b' }}>
                This is what students see when they visit your course link.
              </p>
              <Link href={`/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}`} target="_blank"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all mb-2"
                style={{ background: 'rgba(124,58,237,0.1)', color: '#8b5cf6', border: '1px solid rgba(124,58,237,0.2)' }}>
                <ExternalLink className="w-4 h-4" />
                Preview Course Page
              </Link>
            </div>

            {/* Student Update / Delay Broadcast */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <h3 className="font-semibold text-white mb-1">📢 Send Student Update</h3>
              <p className="text-xs mb-3" style={{ color: '#71717a' }}>
                Notify all enrolled students about schedule changes, delays, or upcoming lessons.
              </p>
              <textarea
                value={delayMessage}
                onChange={e => setDelayMessage(e.target.value.slice(0, 500))}
                placeholder="e.g. Lesson 5 is delayed by 1 day due to production. Dropping tomorrow at 7 PM!"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none mb-2"
                style={{ borderColor: delayMessage ? 'rgba(245,158,11,0.4)' : undefined }}
              />
              <span className="text-xs" style={{ color: '#949499' }}>{delayMessage.length}/500</span>
              <div className="flex items-center justify-between mb-3">
                
                <span className="text-xs" style={{ color: '#949499' }}>Sends via Telegram & WhatsApp to all enrolled students</span>
              </div>
              <button
                onClick={sendDelayBroadcast}
                disabled={!delayMessage.trim() || broadcastSending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{
                  background: broadcastSent
                    ? 'rgba(74,222,128,0.8)'
                    : 'rgba(245,158,11,0.75)',
                }}>
                {broadcastSending ? 'Sending…' : broadcastSent ? '✓ Message Sent!' : 'Send to All Students'}
              </button>
            </div>

            {/* Share section */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Share2 className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                Share Course
              </h3>
              <p className="text-xs mb-4" style={{ color: '#949499' }}>
                Share this link with your students to enroll.
              </p>



              {/* Copy link */}
              <button onClick={copyCourseLink}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all mb-2"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                {copied
                  ? <><Check className="w-4 h-4" style={{ color: '#4ade80' }} />Copied!</>
                  : <><Copy className="w-4 h-4" />Copy Course Link</>
                }
              </button>

              {/* Share on WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hey! Enroll in my course "${course.name}" here: ${courseUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: '#25d366', color: '#fff' }}>
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </a>
            </div>

          </div>
        </div>
      </main>

      {/* Certificate Preview Modal */}
      {course && (
        <CertificatePreviewModal
          isOpen={showCertPreview}
          onClose={() => setShowCertPreview(false)}
          template={previewTemplate}
          courseName={course.name}
          creatorName={course.host_name || 'Instructor'}
          skills={editSkills}
          courseDuration={editDuration}
          logoUrl={editCertLogoUrl}
          signatureUrl={editCertSignatureUrl}
          customMessage={editCertCustomMessage}
        />
      )}
    </div>
  )
}

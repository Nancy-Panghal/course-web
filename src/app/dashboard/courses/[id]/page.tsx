'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { slugify, renumberLessons, getNextLessonOrder, renumberModules, getNextModuleOrder } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Video, FileText, Globe,
  Eye, EyeOff, ExternalLink, Copy, Check,
  GripVertical, Trash2, CheckCircle, AlertCircle,
  MessageCircle, Monitor, Share2, ChevronDown, ChevronUp,AlertTriangle
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
      style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{background:'#111', border:'1px solid rgba(124,58,237,0.3)'}}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Module</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{background:'rgba(255,255,255,0.06)', color:'#a1a1aa'}}>
            X
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Module Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Week 1, Foundation, Advanced SEO"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}} />
          </div>
          <div>
            <label className="text-sm font-medium text-white mb-2 block">How many lessons?</label>
            <input value={plannedLessons} onChange={e => setPlannedLessons(e.target.value)}
              type="number" min="0" placeholder="3"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}} />
          </div>
          {error && (
            <div className="p-3 rounded-xl text-sm"
              style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
              {error}
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
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
}: {
  onClose: () => void
  onAdd: () => void
  courseId: string
  creatorId: string
  nextOrder: number
  modules: CourseModule[]
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<'video' | 'pdf'>('video')
  const [duration, setDuration] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let finalUrl = url
    let finalStoragePath = ''

    // If file is selected, upload it to Supabase
    if (file) {
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

    if (!finalUrl) {
      setError('Please provide a URL or upload a file.')
      setLoading(false)
      return
    }

    // Build lesson object with storage path if available
    const lessonData: any = {
      course_id: courseId,
      creator_id: creatorId,
      title,
      content_url: finalUrl,
      content_type: type,
      order_num: nextOrder,
      duration,
      module_id: moduleId || null,
      is_published: false,
    }

    // Add storage path if file was uploaded to Supabase
    if (finalStoragePath) {
      if (type === 'video') {
        lessonData.video_storage_path = finalStoragePath
      } else {
        lessonData.pdf_storage_path = finalStoragePath
      }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)'}}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{background:'#111', border:'1px solid rgba(124,58,237,0.3)'}}>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Lesson {nextOrder}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{background:'rgba(255,255,255,0.06)', color:'#a1a1aa'}}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['video', 'pdf'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: type === t ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                    border: type === t ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: type === t ? '#8b5cf6' : '#a1a1aa',
                  }}>
                  {t === 'video'
                    ? <Video className="w-4 h-4" />
                    : <FileText className="w-4 h-4" />
                  }
                  {t === 'video' ? 'Video' : 'PDF'}
                </button>
              ))}
            </div>
          </div>

          {modules.length > 0 && (
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Module</label>
              <select
                value={moduleId}
                onChange={e => setModuleId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{background:'#050505', border:'1px solid rgba(255,255,255,0.1)'}}
              >
                <option value="" style={{background:'#050505', color:'#fff'}}>No module</option>
                {modules.map(module => (
                  <option key={module.id} value={module.id} style={{background:'#050505', color:'#fff'}}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Lesson Title *</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Keyword Research"
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* URL or File */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {type === 'video' ? 'Video Source' : 'PDF Source'} *
            </label>
            
            <div className="flex flex-col gap-3">
              {/* File Upload */}
              <div className="relative group">
                <input
                  type="file"
                  accept={type === 'video' ? 'video/*' : 'application/pdf'}
                  onChange={e => {
                    const selected = e.target.files?.[0] || null
                    setFile(selected)
                    if (selected) setUrl('') // Clear URL if file is selected
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                  style={{
                    background: file ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                    borderColor: file ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                    color: file ? '#fff' : '#a1a1aa'
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {file ? file.name : `Upload ${type === 'video' ? 'Video' : 'PDF'}`}
                </label>
                {file && (
                  <button 
                    type="button"
                    onClick={() => setFile(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] uppercase tracking-widest text-zinc-600">OR</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* URL Input */}
              <input
                type="url" value={url} onChange={e => {
                  setUrl(e.target.value)
                  if (e.target.value) setFile(null) // Clear file if URL is typed
                }}
                placeholder={type === 'video' ? "Paste Telegram/YouTube/Direct link" : "Paste PDF link"}
                disabled={!!file}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none disabled:opacity-50"
                style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <p className="text-xs mt-1.5" style={{color:'#52525b'}}>
              {type === 'video' 
                ? "Files will be stored securely in your academy storage."
                : "PDFs will be stored securely in your academy storage."}
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Duration (optional)</label>
            <input
              type="text" value={duration} onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 18 min"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm"
              style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Lesson'}
            </button>
          </div>
        </form>
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
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resourceSaving, setResourceSaving] = useState<'summary' | 'notes' | null>(null)

  async function uploadResource(kind: 'summary' | 'notes', file: File | null) {
    if (!file) return
    const lower = file.name.toLowerCase()
    const valid = lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.doc') || lower.endsWith('.docx')
    if (!valid) {
      alert('Only PDF or text document files are allowed.')
      return
    }

    setResourceSaving(kind)
    try {
      const { publicUrl } = await uploadToSupabase(file, `${kind}s`)
      const payload = kind === 'summary'
        ? { summary_url: publicUrl, summary_name: file.name }
        : { notes_url: publicUrl, notes_name: file.name }
      const { error } = await supabase.from('lessons').update(payload).eq('id', lesson.id)
      if (error) throw error
      onRefresh()
    } catch (err: any) {
      alert(err.message || 'Resource upload failed.')
    } finally {
      setResourceSaving(null)
    }
  }

  function copyLink() {
    // Don't expose the actual URL — just copy a reference
    navigator.clipboard.writeText(`Lesson ${lesson.order_num}: ${lesson.title}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: lesson.is_published
          ? '1px solid rgba(74,222,128,0.2)'
          : '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>

      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        <GripVertical className="w-4 h-4 flex-shrink-0 cursor-grab"
          style={{color:'#3f3f46'}} />

        {/* Order badge */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{background:'rgba(124,58,237,0.15)', color:'#8b5cf6'}}>
          {String(lesson.order_num).padStart(2, '0')}
        </div>

        {/* Type icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{background:'rgba(255,255,255,0.05)'}}>
          {lesson.content_type === 'pdf'
            ? <FileText className="w-4 h-4" style={{color:'#f59e0b'}} />
            : <Video className="w-4 h-4" style={{color:'#8b5cf6'}} />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {lesson.duration && (
              <span className="text-xs" style={{color:'#52525b'}}>{lesson.duration}</span>
            )}
            <span className="text-xs" style={{
              color: lesson.is_published ? '#4ade80' : '#52525b'
            }}>
              {lesson.is_published ? '● Published' : '○ Draft'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

          <button onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 border-t"
          style={{borderColor:'rgba(255,255,255,0.04)'}}>
          <div className="pt-4 flex flex-col gap-3">

            {/* Visit lesson — URL hidden from display */}
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white mb-0.5">Lesson Content</p>
                <p className="text-xs truncate" style={{color:'#52525b'}}>
                  {lesson.content_type === 'video' ? '🎬' : '📄'} {lesson.content_type.toUpperCase()} · URL stored securely
                </p>
              </div>
              <a
                href={lesson.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                style={{background:'rgba(124,58,237,0.15)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
                <ExternalLink className="w-3 h-3" />
                Preview
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['summary', 'notes'] as const).map(kind => {
                const hasFile = kind === 'summary' ? !!lesson.summary_url : !!lesson.notes_url
                const name = kind === 'summary' ? lesson.summary_name : lesson.notes_name
                return (
                  <div key={kind} className="p-3 rounded-xl"
                    style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white capitalize">{kind}</p>
                        <p className="text-[10px] truncate" style={{color:'#52525b'}}>
                          {hasFile ? name || 'Uploaded' : 'PDF or text document'}
                        </p>
                      </div>
                      {hasFile && (
                        <Link href={`/resource/${lesson.id}?type=${kind}`} target="_blank"
                          className="text-[10px] text-violet-400 hover:text-violet-300">
                          View
                        </Link>
                      )}
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      id={`${kind}-${lesson.id}`}
                      onChange={e => uploadResource(kind, e.target.files?.[0] || null)}
                    />
                    <label htmlFor={`${kind}-${lesson.id}`}
                      className="block w-full text-center px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                      style={{background:'rgba(124,58,237,0.12)', color:'#a78bfa', border:'1px solid rgba(124,58,237,0.2)'}}>
                      {resourceSaving === kind ? 'Uploading...' : hasFile ? 'Replace File' : `Add ${kind}`}
                    </label>
                  </div>
                )
              })}
            </div>

            <Link
              href={`/dashboard/courses/${lesson.course_id}/lessons/${lesson.id}/quiz`}
              className="flex items-center justify-between gap-3 p-3 rounded-xl text-sm"
              style={{background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.18)', color:'#fff'}}>
              <span>Quiz Builder</span>
              <span className="text-xs text-violet-300">
                {Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0
                  ? `${lesson.quiz_questions.length} questions`
                  : 'Add quiz'}
              </span>
            </Link>

            {/* Delete */}
            <button
              onClick={() => onDelete(lesson.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all w-fit"
              style={{background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.15)'}}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete Lesson
            </button>
          </div>
        </div>
      )}
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
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [creatorId, setCreatorId] = useState('')
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeTab, setActiveTab] = useState<'lessons' | 'settings'>('lessons')

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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCreatorId(user.id)

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
      setEditPlannedLessons(courseData.total_lessons?.toString() || '')
      setEditNextLessonDate(courseData.next_lesson_date || '')
      setEditCourseEndDate(courseData.course_end_date || '')
      setEditStudentMessage(courseData.student_update_message || '')
      setEditLearn(courseData.what_you_will_learn || [''])
      setEditFaq(courseData.faq || [{ question: '', answer: '' }])
      setEditHostImage(courseData.host_image || '')
      setEditFreePreview(courseData.free_preview_config || 'nothing free')

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
      // Delete enrollments first (foreign key)
      await supabase.from('enrollments').delete().eq('course_uuid', id)
      
      // Delete lessons
      await supabase.from('lessons').delete().eq('course_id', id)
      
      // Delete course modules
      await supabase.from('course_modules').delete().eq('course_id', id)
      
      // Finally delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)

      if (!error) {
        router.push('/dashboard/courses')
      } else {
        alert('Failed to delete course: ' + error.message)
      }
    } catch (err: any) {
      alert('Error deleting course: ' + err.message)
    }
    setIsDeleting(false)
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
    setPublishing(true)
    await supabase
      .from('lessons')
      .update({ is_published: true })
      .eq('course_id', id)

    // Also publish the course itself
    await supabase
      .from('courses')
      .update({ is_published: true })
      .eq('id', id)

    if (course) setCourse({ ...course, is_published: true })
    await fetchLessons()
    setPublishing(false)
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
          onClose={() => setShowAddModal(false)}
          onAdd={fetchLessons}
          courseId={id}
          creatorId={creatorId}
          nextOrder={lessons.length + 1}
          modules={modules}
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
            style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
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
                  {tab}
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
                {/* Lessons header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white">Lessons</h2>
                    <p className="text-xs mt-0.5" style={{color:'#52525b'}}>
                      {lessons.length} total · {publishedCount} published
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowModuleModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa', border:'1px solid rgba(255,255,255,0.08)'}}>
                      <Plus className="w-4 h-4" />
                      Add Module
                    </button>
                    <button onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow">
                      <Plus className="w-4 h-4" />
                      Add Lesson {lessons.length + 1}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl p-4 mb-4"
                  style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-white">Release Schedule</p>
                      <p className="text-xs text-zinc-500">{lessons.length} uploaded / {publishedCount} published / {remainingLessons} remaining</p>
                    </div>
                    <button onClick={updateSettings} disabled={savingSettings}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white violet-gradient hover:opacity-90 disabled:opacity-50">
                      {savingSettings ? 'Saving...' : 'Save Schedule'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Planned Lessons</label>
                      <input value={editPlannedLessons} onChange={e => setEditPlannedLessons(e.target.value)}
                        type="number" min={lessons.length}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Next Lesson Date</label>
                      <input value={editNextLessonDate} onChange={e => setEditNextLessonDate(e.target.value)}
                        type="date"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 block">Course End Date</label>
                      <input value={editCourseEndDate} onChange={e => setEditCourseEndDate(e.target.value)}
                        type="date"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Student Info Message</label>
                      <span className="text-[10px] text-zinc-600">{editStudentMessage.length}/500</span>
                    </div>
                    <textarea
                      value={editStudentMessage}
                      onChange={e => setEditStudentMessage(e.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={3}
                      placeholder="Example: Lesson 3 is being recorded and will be available next Friday."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Lesson list */}
                {lessons.length === 0 && modules.length === 0 ? (
                  <div className="rounded-2xl p-12 text-center glass"
                    style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                    <Video className="w-10 h-10 mx-auto mb-3" style={{color:'#3f3f46'}} />
                    <p className="text-sm font-medium text-white mb-1">No lessons yet</p>
                    <p className="text-xs mb-4" style={{color:'#52525b'}}>
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
                        <div key={module.id} className="rounded-2xl p-4"
                          style={{background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.06)'}}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-semibold text-white">{module.name}</h3>
                              <p className="text-xs" style={{color:'#52525b'}}>
                                {moduleLessons.length} / {module.planned_lessons || moduleLessons.length} lessons
                              </p>
                            </div>
                            <button onClick={() => setShowAddModal(true)}
                              className="text-xs px-3 py-1.5 rounded-lg"
                              style={{background:'rgba(124,58,237,0.12)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
                              Add Lesson
                            </button>
                          </div>
                          <div className="flex flex-col gap-3">
                            {moduleLessons.length === 0 ? (
                              <p className="text-xs py-3" style={{color:'#52525b'}}>No lessons in this module yet.</p>
                            ) : moduleLessons.map(lesson => (
                              <LessonWidget
                                key={lesson.id}
                                lesson={lesson}
                                onDelete={deleteLesson}
                                onTogglePublish={toggleLessonPublish}
                                onRefresh={fetchLessons}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {lessons.filter(lesson => !lesson.module_id).map(lesson => (
                      <LessonWidget
                        key={lesson.id}
                        lesson={lesson}
                        onDelete={deleteLesson}
                        onTogglePublish={toggleLessonPublish}
                        onRefresh={fetchLessons}
                      />
                    ))}

                    {/* Add next lesson */}
                    <button onClick={() => setShowAddModal(true)}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm transition-all"
                      style={{
                        background:'rgba(255,255,255,0.02)',
                        border:'1px dashed rgba(255,255,255,0.1)',
                        color:'#52525b',
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
                          background:'rgba(74,222,128,0.08)',
                          border:'1px solid rgba(74,222,128,0.2)',
                          color:'#4ade80',
                        }}>
                        <CheckCircle className="w-4 h-4" />
                        {publishing ? 'Publishing...' : `Publish All ${lessons.length} Lessons`}
                      </button>
                    )}

                    {allPublished && (
                      <div className="flex items-center gap-2 p-3 rounded-xl"
                        style={{background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.15)'}}>
                        <CheckCircle className="w-4 h-4" style={{color:'#4ade80'}} />
                        <p className="text-sm" style={{color:'#4ade80'}}>
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
                        style={{ background:'#050505', color:'#fff' }}
                      >
                        <option value="nothing free" style={{background:'#050505', color:'#fff'}}>Nothing free (Pay immediately)</option>
                        <option value="lesson 1 free" style={{background:'#050505', color:'#fff'}}>Lesson 1 free</option>
                        <option value="2 lessons free" style={{background:'#050505', color:'#fff'}}>2 lessons free</option>
                        <option value="3 lessons free" style={{background:'#050505', color:'#fff'}}>3 lessons free</option>
                        <option value="module 1 free" style={{background:'#050505', color:'#fff'}}>Module 1 free</option>
                        <option value="2 modules free" style={{background:'#050505', color:'#fff'}}>2 modules free</option>
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

            {/* Course stats */}
            <div className="rounded-2xl p-5 glass"
              style={{border:'1px solid rgba(255,255,255,0.06)'}}>
              <h3 className="font-semibold text-white mb-4">Course Details</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Price', value: `₹${course.price.toLocaleString()}` },
                  { label: 'Lessons', value: `${lessons.length} uploaded / ${plannedTotal} planned` },
                  { label: 'Published', value: `${publishedCount} of ${lessons.length}` },
                  { label: 'Delivery', value: course.delivery === 'both' ? 'Web + WhatsApp' : course.delivery === 'web' ? 'Web Only' : 'WhatsApp Only' },
                  { label: 'Language', value: course.language?.join(', ') || 'English' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2"
                    style={{borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}>
                    <span className="text-xs" style={{color:'#52525b'}}>{item.label}</span>
                    <span className="text-xs font-medium text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

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
                  <p className="text-xs mt-0.5" style={{color:'#52525b'}}>
                    {course.is_published
                      ? 'Students can find and enroll'
                      : 'Not visible to students yet'}
                  </p>
                </div>
                <button onClick={toggleCoursePublish}
                  className="relative w-12 h-6 rounded-full transition-all"
                  style={{background: course.is_published ? '#7c3aed' : 'rgba(255,255,255,0.1)'}}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{left: course.is_published ? '28px' : '4px'}} />
                </button>
              </div>
              {!course.is_published && lessons.length === 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg"
                  style={{background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)'}}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{color:'#f59e0b'}} />
                  <p className="text-xs" style={{color:'#f59e0b'}}>
                    Add at least one lesson before publishing
                  </p>
                </div>
              )}
            </div>

            {/* Course page preview */}
            <div className="rounded-2xl p-5 glass"
              style={{border:'1px solid rgba(255,255,255,0.06)'}}>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" style={{color:'#8b5cf6'}} />
                Course Page
              </h3>
              <p className="text-xs mb-3" style={{color:'#52525b'}}>
                This is what students see when they visit your course link.
              </p>
              <Link href={`/about-course/${slugify(course.host_name || 'instructor')}/${slugify(course.name)}/${course.id}`} target="_blank"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all mb-2"
                style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
                <ExternalLink className="w-4 h-4" />
                Preview Course Page
              </Link>
            </div>

            {/* Share section */}
            <div className="rounded-2xl p-5"
              style={{background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)'}}>
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Share2 className="w-4 h-4" style={{color:'#8b5cf6'}} />
                Share Course
              </h3>
              <p className="text-xs mb-4" style={{color:'#52525b'}}>
                Share this link with your students to enroll and pay.
              </p>

              {/* URL display */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3"
                style={{background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)'}}>
                <p className="text-xs flex-1 truncate font-mono" style={{color:'#a1a1aa'}}>
                  /about-course/.../{course.id.slice(0, 8)}
                </p>
              </div>

              {/* Copy link */}
              <button onClick={copyCourseLink}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all mb-2"
                style={{background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.1)'}}>
                {copied
                  ? <><Check className="w-4 h-4" style={{color:'#4ade80'}} />Copied!</>
                  : <><Copy className="w-4 h-4" />Copy Course Link</>
                }
              </button>

              {/* Share on WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hey! Enroll in my course "${course.name}" here: ${courseUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{background:'#25d366', color:'#fff'}}>
                <MessageCircle className="w-4 h-4" />
                Share to WhatsApp
              </a>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

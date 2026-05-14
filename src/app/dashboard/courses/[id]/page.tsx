'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Video, FileText, Globe,
  Eye, EyeOff, ExternalLink, Copy, Check,
  GripVertical, Trash2, CheckCircle, AlertCircle,
  MessageCircle, Monitor, Share2, ChevronDown, ChevronUp
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
}

interface Lesson {
  id: string
  title: string
  content_url: string
  content_type: string
  order_num: number
  is_published: boolean
  duration: string
}

// ── ADD LESSON MODAL ──
function AddLessonModal({
  onClose,
  onAdd,
  courseId,
  creatorId,
  nextOrder,
}: {
  onClose: () => void
  onAdd: () => void
  courseId: string
  creatorId: string
  nextOrder: number
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'video' | 'pdf'>('video')
  const [duration, setDuration] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('lessons').insert({
      course_id: courseId,
      creator_id: creatorId,
      title,
      content_url: url,
      content_type: type,
      order_num: nextOrder,
      duration,
      is_published: false,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Update course total_lessons count
    await supabase
      .from('courses')
      .update({ total_lessons: nextOrder })
      .eq('id', courseId)

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

          {/* URL */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {type === 'video' ? 'Video URL' : 'PDF URL'} *
            </label>
            <input
              type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <p className="text-xs mt-1.5" style={{color:'#52525b'}}>
              Paste a direct link. File upload coming soon.
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
}: {
  lesson: Lesson
  onDelete: (id: string) => void
  onTogglePublish: (id: string, current: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

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
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [creatorId, setCreatorId] = useState('')
  const [copied, setCopied] = useState(false)
  const [publishing, setPublishing] = useState(false)

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

      await fetchLessons()
      setLoading(false)
    }
    load()
  }, [id])

  async function fetchLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', id)
      .order('order_num', { ascending: true })
    setLessons(data || [])
  }

  async function deleteLesson(lessonId: string) {
    await supabase.from('lessons').delete().eq('id', lessonId)
    await fetchLessons()
    // Update count
    if (course) {
      const newCount = lessons.length - 1
      await supabase.from('courses').update({ total_lessons: newCount }).eq('id', id)
      setCourse({ ...course, total_lessons: newCount })
    }
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
    navigator.clipboard.writeText(`${window.location.origin}/learn/${course.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const publishedCount = lessons.filter(l => l.is_published).length
  const allPublished = lessons.length > 0 && publishedCount === lessons.length
  const courseUrl = course ? `${window.location.origin}/learn/${course.slug}` : ''

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
        />
      )}

      <main className="md:ml-56 p-6 md:p-8">

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
            <p className="text-sm mt-1 truncate" style={{color:'#a1a1aa'}}>{course.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Lessons ── */}
          <div className="lg:col-span-2">

            {/* Lessons header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white">Lessons</h2>
                <p className="text-xs mt-0.5" style={{color:'#52525b'}}>
                  {lessons.length} total · {publishedCount} published
                </p>
              </div>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow">
                <Plus className="w-4 h-4" />
                Add Lesson {lessons.length + 1}
              </button>
            </div>

            {/* Lesson list */}
            {lessons.length === 0 ? (
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
                {lessons.map(lesson => (
                  <LessonWidget
                    key={lesson.id}
                    lesson={lesson}
                    onDelete={deleteLesson}
                    onTogglePublish={toggleLessonPublish}
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
                  { label: 'Lessons', value: `${lessons.length} / ${course.total_lessons} planned` },
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
              <Link href={`/learn/${course.slug}`} target="_blank"
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
                  /learn/{course.slug}
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

              {/* WhatsApp share */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join my course "${course.name}": ${courseUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{background:'#25d366', color:'#fff'}}>
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </a>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { BookOpen, Plus, Trash2, GripVertical, Video, FileText, Link, X, Check } from 'lucide-react'

interface Lesson {
  id: string
  title: string
  r2_key: string
  order_num: number
  created_at: string
}

function AddLessonModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'video' | 'pdf'>('video')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: existing } = await supabase
      .from('lessons')
      .select('order_num')
      .order('order_num', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].order_num + 1 : 1

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('lessons').insert({
      title,
      r2_key: url,
      order_num: nextOrder,
      creator_id: user?.id,
    })

    if (error) {
      setError(error.message)
    } else {
      onAdd()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#111', border: '1px solid rgba(124,58,237,0.3)' }}>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add New Lesson</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['video', 'pdf'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: type === t ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                    border: type === t ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: type === t ? '#8b5cf6' : '#a1a1aa',
                  }}
                >
                  {t === 'video' ? <Video className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  {t === 'video' ? 'Video' : 'PDF'}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Lesson Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Keyword Research"
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {type === 'video' ? 'Video URL' : 'PDF URL'}
            </label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={type === 'video' ? 'https://...' : 'https://...'}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#52525b' }}>
              Paste a direct video/PDF link. Cloudflare R2 upload coming soon.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-white violet-gradient transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<string | null>(null)

  async function fetchLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .order('order_num', { ascending: true })
    setLessons(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchLessons() }, [])

  async function deleteLesson(id: string) {
    setDeleting(id)
    await supabase.from('lessons').delete().eq('id', id)
    setDeleted(id)
    setTimeout(() => {
      setLessons(l => l.filter(x => x.id !== id))
      setDeleted(null)
      setDeleting(null)
    }, 400)
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      {showModal && (
        <AddLessonModal
          onClose={() => setShowModal(false)}
          onAdd={fetchLessons}
        />
      )}

      <main className="md:ml-56 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Lessons</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} in your course
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 transition-all glow"
          >
            <Plus className="w-4 h-4" />
            Add Lesson
          </button>
        </div>

        {/* Lessons list */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
          </div>
        ) : lessons.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl p-16 text-center glass"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <BookOpen className="w-8 h-8" style={{ color: '#8b5cf6' }} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No lessons yet</h3>
            <p className="text-sm mb-6" style={{ color: '#a1a1aa' }}>
              Add your first lesson to get started.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90 glow"
            >
              <Plus className="w-4 h-4" />
              Add First Lesson
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lessons.map((lesson, i) => (
              <div
                key={lesson.id}
                className="flex items-center gap-4 p-4 rounded-2xl transition-all"
                style={{
                  background: deleted === lesson.id ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                  border: deleted === lesson.id ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  opacity: deleted === lesson.id ? 0.5 : 1,
                }}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 flex-shrink-0 cursor-grab" style={{ color: '#3f3f46' }} />

                {/* Order badge */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#8b5cf6' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {lesson.r2_key.includes('.pdf') || lesson.r2_key.includes('pdf')
                    ? <FileText className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    : <Video className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#52525b' }}>{lesson.r2_key}</p>
                </div>

                {/* Date */}
                <span className="text-xs flex-shrink-0 hidden sm:block" style={{ color: '#52525b' }}>
                  {new Date(lesson.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteLesson(lesson.id)}
                  disabled={!!deleting}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                >
                  {deleted === lesson.id
                    ? <Check className="w-4 h-4 text-green-400" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        {lessons.length > 0 && (
          <div className="mt-6 flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <div className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#8b5cf6' }}>ℹ</div>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              Lessons are delivered in order via WhatsApp. Students unlock the next lesson after marking the current one complete.
              Video links expire after 60 minutes to prevent piracy.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
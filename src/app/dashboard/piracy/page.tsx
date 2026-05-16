'use client'
import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  Shield,
} from 'lucide-react'

interface Course {
  id: string
  name: string
  slug: string
  creator_id: string
}

interface PiracyLog {
  id: string
  creator_id: string
  course_id: string | null
  lesson_id: string | null
  platform: string
  infringing_url: string
  matched_text: string | null
  confidence: number | null
  status: 'detected' | 'filed' | 'resolved' | 'nuked'
  detected_at: string
  notified_at: string | null
  takedown_email_subject: string | null
  takedown_email_body: string | null
  takedown_sent_at: string | null
  resolved_at: string | null
  courses?: { name: string; slug: string } | null
}

const statusConfig = {
  detected: { label: 'Detected', color: '#ef4444', icon: AlertTriangle },
  filed: { label: 'Notice Drafted', color: '#facc15', icon: Clock },
  resolved: { label: 'Resolved', color: '#4ade80', icon: CheckCircle },
  nuked: { label: 'Removed', color: '#4ade80', icon: CheckCircle },
}

function cleanUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function buildTakedown(courseName: string, creatorEmail: string, infringingUrl: string) {
  const date = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const subject = `Copyright infringement notice - ${courseName}`
  const body = [
    'Hello Telegram Copyright Team,',
    '',
    'I am the copyright owner or authorized representative for the course content listed below.',
    '',
    `Original work: ${courseName}`,
    `Rights owner/contact: ${creatorEmail}`,
    `Infringing URL: ${infringingUrl}`,
    '',
    'The linked public content is distributing copyrighted course material without permission. Please remove or disable access to the infringing content.',
    '',
    'I have a good-faith belief that this use is not authorized by the copyright owner, its agent, or the law.',
    '',
    'The information in this notice is accurate, and I confirm that I am the copyright owner or authorized to act on behalf of the copyright owner.',
    '',
    `Signature: ${creatorEmail}`,
    `Date: ${date}`,
  ].join('\n')

  return { subject, body }
}

export default function PiracyPage() {
  const [reports, setReports] = useState<PiracyLog[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [creatorEmail, setCreatorEmail] = useState('')
  const [filter, setFilter] = useState<'all' | 'detected' | 'filed' | 'resolved'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [url, setUrl] = useState('')
  const [matchedText, setMatchedText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setCreatorEmail(user.email || '')

    const [{ data: courseRows }, { data: reportRows }] = await Promise.all([
      supabase
        .from('courses')
        .select('id, name, slug, creator_id')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('piracy_log')
        .select('*, courses:course_id(name, slug)')
        .eq('creator_id', user.id)
        .order('detected_at', { ascending: false }),
    ])

    setCourses(courseRows || [])
    setReports((reportRows || []) as PiracyLog[])
    setLoading(false)
  }

  async function createReport(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please sign in again.')
      setSaving(false)
      return
    }

    const finalUrl = cleanUrl(url)
    const course = courses.find(c => c.id === selectedCourseId)
    if (!finalUrl || !course) {
      setError('Choose a course and paste the infringing link.')
      setSaving(false)
      return
    }

    const draft = buildTakedown(course.name, user.email || 'creator', finalUrl)
    const { error: insertError } = await supabase.from('piracy_log').insert({
      creator_id: user.id,
      course_id: course.id,
      platform: finalUrl.includes('t.me') || finalUrl.includes('telegram') ? 'telegram' : 'web',
      infringing_url: finalUrl,
      matched_text: matchedText || null,
      confidence: matchedText ? 0.75 : 0.5,
      status: 'filed',
      notified_at: new Date().toISOString(),
      takedown_email_subject: draft.subject,
      takedown_email_body: draft.body,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setUrl('')
    setMatchedText('')
    setShowForm(false)
    await load()
    setSaving(false)
  }

  async function markResolved(report: PiracyLog) {
    await supabase
      .from('piracy_log')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', report.id)
    await load()
  }

  async function markSent(report: PiracyLog) {
    await supabase
      .from('piracy_log')
      .update({ status: 'filed', takedown_sent_at: new Date().toISOString() })
      .eq('id', report.id)
    await load()
  }

  async function copyDraft(report: PiracyLog) {
    const text = `To: dmca@telegram.org\nSubject: ${report.takedown_email_subject || ''}\n\n${report.takedown_email_body || ''}`
    await navigator.clipboard.writeText(text)
    setCopiedId(report.id)
    setTimeout(() => setCopiedId(''), 2000)
  }

  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports
    return reports.filter(r => r.status === filter || (filter === 'resolved' && r.status === 'nuked'))
  }, [filter, reports])

  const stats = {
    total: reports.length,
    active: reports.filter(r => r.status === 'detected' || r.status === 'filed').length,
    filed: reports.filter(r => r.status === 'filed').length,
    resolved: reports.filter(r => r.status === 'resolved' || r.status === 'nuked').length,
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Piracy Shield</h1>
            <p className="text-sm text-zinc-400">
              Track public leaks, generate takedown drafts, and keep evidence in one place.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white violet-gradient hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Report Piracy
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Reports', value: stats.total, color: '#a1a1aa' },
            { label: 'Active Threats', value: stats.active, color: '#ef4444' },
            { label: 'Drafts Ready', value: stats.filed, color: '#facc15' },
            { label: 'Resolved', value: stats.resolved, color: '#4ade80' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl p-5 bg-white/[0.03] border border-white/5">
              <div className="text-3xl font-bold mb-1" style={{ color: item.color }}>{item.value}</div>
              <div className="text-sm text-zinc-400">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex gap-3">
          <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            AcademyKit prepares copyright evidence and takedown drafts for public URLs. Telegram complaints should be sent by the copyright owner or authorized agent to dmca@telegram.org. Do not promise guaranteed removal timelines to students or creators.
          </p>
        </div>

        {showForm && (
          <form onSubmit={createReport} className="mb-8 rounded-2xl p-5 bg-white/[0.03] border border-white/5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Course</label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none bg-black border border-white/10"
                >
                  <option value="" style={{ background:'#050505', color:'#fff' }}>Select course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id} style={{ background:'#050505', color:'#fff' }}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Infringing URL</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://t.me/channel/123"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none bg-white/5 border border-white/10"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Matched Content / Evidence</label>
              <textarea
                value={matchedText}
                onChange={e => setMatchedText(e.target.value)}
                rows={3}
                placeholder="Example: Lesson 3 video title, screenshot notes, copied description, channel name..."
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none bg-white/5 border border-white/10"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={saving} className="w-full py-3 rounded-xl text-sm font-semibold text-white violet-gradient disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Takedown Draft'}
            </button>
          </form>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {(['all', 'detected', 'filed', 'resolved'] as const).map(item => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize"
              style={{
                background: filter === item ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: filter === item ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filter === item ? '#8b5cf6' : '#a1a1aa',
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 text-center rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-400">Loading piracy reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-24 text-center rounded-2xl bg-white/[0.02] border border-white/5">
            <Shield className="w-10 h-10 text-violet-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No reports yet</h3>
            <p className="text-sm text-zinc-400">Add a public Telegram or web leak when you find one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredReports.map(report => {
              const config = statusConfig[report.status] || statusConfig.detected
              const Icon = config.icon
              const displayUrl = report.infringing_url.replace(/^https?:\/\//, '')

              return (
                <div key={report.id} className="rounded-2xl p-5 bg-white/[0.02] border border-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5">
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5" style={{ color: config.color }}>
                            {config.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400">
                            {report.platform}
                          </span>
                          {report.courses?.name && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                              {report.courses.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono text-white truncate max-w-[720px]">{displayUrl}</p>
                        {report.matched_text && (
                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{report.matched_text}</p>
                        )}
                        <p className="text-xs text-zinc-600 mt-2">
                          Detected {new Date(report.detected_at).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <a href={report.infringing_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/5 text-zinc-500 hover:text-white flex items-center justify-center">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => copyDraft(report)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white border border-white/10">
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === report.id ? 'Copied' : 'Copy Email Draft'}
                    </button>
                    <a
                      href={`mailto:dmca@telegram.org?subject=${encodeURIComponent(report.takedown_email_subject || '')}&body=${encodeURIComponent(report.takedown_email_body || '')}`}
                      onClick={() => markSent(report)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Open Email
                    </a>
                    {report.status !== 'resolved' && report.status !== 'nuked' && (
                      <button onClick={() => markResolved(report)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

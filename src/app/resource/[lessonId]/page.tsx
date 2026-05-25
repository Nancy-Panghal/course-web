'use client'

import { useEffect, useMemo, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, FileText, HelpCircle, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ResourceType = 'summary' | 'notes' | 'quiz'

interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
}

interface LessonResource {
  id: string
  title: string
  course_id: string
  summary_url?: string | null
  summary_name?: string | null
  notes_url?: string | null
  notes_name?: string | null
  quiz_questions?: QuizQuestion[] | null
}

function getFileExtension(url?: string | null): string {
  if (!url) return ''
  const clean = url.split('?')[0]
  const parts = clean.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function isTextType(ext: string): boolean {
  return ext === 'md' || ext === 'txt'
}

function isPdfType(ext: string): boolean {
  return ext === 'pdf'
}

// Minimal markdown -> HTML renderer (no external deps)
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Code blocks (must come before inline code)
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
      return `<pre><code>${code}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Split into blocks and wrap
  const blocks = html.split(/\n\n+/)
  html = blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    // Already wrapped in block element
    if (/^<(h[1-6]|pre|hr|ul|ol|blockquote)/i.test(trimmed)) return trimmed
    // List items — wrap in ul
    if (/^<li>/i.test(trimmed)) return `<ul>${trimmed}</ul>`
    // Single newlines within a paragraph become <br>
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  // Handle unordered lists (lines starting with - or *)
  html = html.replace(/<p>(?:[-*] .+\n?)+<\/p>/g, (match) => {
    const items = match
      .replace(/<\/?p>/g, '')
      .split('<br>')
      .map(line => line.replace(/^[-*] /, '').trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  })

  return html
}

function TextRenderer({ content, fileName }: { content: string; fileName?: string | null }) {
  const ext = getFileExtension(fileName)
  const isMd = ext === 'md'
  const html = isMd
    ? renderMarkdown(content)
    : `<pre style="white-space:pre-wrap;word-break:break-word;">${content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      }</pre>`

  return (
    <div
      className="resource-content"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        color: '#d4d4d8',
        lineHeight: 1.8,
        fontSize: 15,
        padding: '24px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    />
  )
}

export default function LessonResourcePage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = use(params)
  const searchParams = useSearchParams()
  const type = ((searchParams.get('type') || 'summary') as ResourceType)
  const [lesson, setLesson] = useState<LessonResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  // Text content state for .md / .txt
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lessons')
        .select('id,title,course_id,summary_url,summary_name,notes_url,notes_name,quiz_questions')
        .eq('id', lessonId)
        .limit(1)
      setLesson(data?.[0] || null)
      setLoading(false)
    }
    load()
  }, [lessonId])

  // Fetch text content when lesson loads and type is summary/notes
  useEffect(() => {
    if (!lesson || type === 'quiz') return

    const url = type === 'summary' ? lesson.summary_url : lesson.notes_url
    const name = type === 'summary' ? lesson.summary_name : lesson.notes_name
    const ext = getFileExtension(name || url)

    if (!url || !isTextType(ext)) return

    setLoadingText(true)
    setTextContent(null)
    setTextError(null)

    fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error(`Failed to load file (HTTP ${res.status})`)
        const text = await res.text()
        setTextContent(text)
      })
      .catch(err => {
        setTextError(err.message || 'Could not load file content')
      })
      .finally(() => setLoadingText(false))
  }, [lesson?.id, type])

  const questions = useMemo(() => {
    return Array.isArray(lesson?.quiz_questions) ? lesson!.quiz_questions : []
  }, [lesson])

  const score = questions.reduce(
    (sum, q, index) => sum + (answers[index] === q.answerIndex ? 1 : 0),
    0
  )

  const resourceUrl = type === 'summary' ? lesson?.summary_url : lesson?.notes_url
  const resourceName = type === 'summary' ? lesson?.summary_name : lesson?.notes_name
  const ext = getFileExtension(resourceName || resourceUrl)

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }} />
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        Resource not found.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .resource-content h1 { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 1.2em 0 0.5em; line-height: 1.3; }
        .resource-content h2 { font-size: 1.3rem; font-weight: 700; color: #e4e4e7; margin: 1em 0 0.4em; line-height: 1.3; }
        .resource-content h3 { font-size: 1.05rem; font-weight: 700; color: #a78bfa; margin: 0.9em 0 0.3em; line-height: 1.3; }
        .resource-content p { margin: 0.6em 0; }
        .resource-content ul { padding-left: 1.5em; margin: 0.6em 0; list-style: disc; }
        .resource-content ol { padding-left: 1.5em; margin: 0.6em 0; list-style: decimal; }
        .resource-content li { margin: 0.3em 0; }
        .resource-content code { background: rgba(124,58,237,0.18); color: #c4b5fd; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: 'Courier New', monospace; }
        .resource-content pre { background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; overflow-x: auto; margin: 1em 0; }
        .resource-content pre code { background: none; padding: 0; color: #e4e4e7; font-size: 0.88em; }
        .resource-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5em 0; }
        .resource-content a { color: #a78bfa; text-decoration: underline; }
        .resource-content strong { color: #fff; font-weight: 700; }
        .resource-content em { color: #c4b5fd; font-style: italic; }
        .resource-content blockquote { border-left: 3px solid #7c3aed; padding-left: 1em; color: #a1a1aa; margin: 0.8em 0; font-style: italic; }
      `}</style>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Shield className="w-3.5 h-3.5" />
            Protected AcademyKit resource
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-violet-400 font-bold">
            {type === 'quiz' ? 'Quiz' : type === 'summary' ? 'Summary' : 'Notes'}
          </p>
          <h1 className="text-2xl font-bold mt-2">{lesson.title}</h1>
          {resourceName && type !== 'quiz' && (
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {resourceName}
            </p>
          )}
        </div>

        {/* ── QUIZ ── */}
        {type === 'quiz' ? (
          questions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">
              No quiz is available for this lesson yet.
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <HelpCircle className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <h2 className="font-semibold">{index + 1}. {q.question}</h2>
                  </div>
                  <div className="grid gap-2">
                    {q.options.map((option, optionIndex) => {
                      const isSelected = answers[index] === optionIndex
                      const isCorrect = submitted && q.answerIndex === optionIndex
                      const isWrong = submitted && isSelected && !isCorrect
                      return (
                        <button
                          key={optionIndex}
                          onClick={() => !submitted && setAnswers(prev => ({ ...prev, [index]: optionIndex }))}
                          className="text-left rounded-lg px-4 py-3 text-sm border transition"
                          style={{
                            background: isCorrect
                              ? 'rgba(74,222,128,0.1)'
                              : isWrong
                              ? 'rgba(239,68,68,0.1)'
                              : isSelected
                              ? 'rgba(124,58,237,0.16)'
                              : 'rgba(255,255,255,0.03)',
                            borderColor: isCorrect
                              ? 'rgba(74,222,128,0.35)'
                              : isWrong
                              ? 'rgba(239,68,68,0.35)'
                              : isSelected
                              ? 'rgba(124,58,237,0.45)'
                              : 'rgba(255,255,255,0.08)',
                          }}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length < questions.length}
                className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
              >
                {submitted ? `Score: ${score}/${questions.length}` : 'Submit Quiz'}
              </button>

              {submitted && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Quiz completed on this device.
                </div>
              )}
            </div>
          )
        ) : resourceUrl ? (
          <>
            {/* .md / .txt — fetch and render inline */}
            {isTextType(ext) && (
              <>
                {loadingText && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">
                    Loading content...
                  </div>
                )}
                {textError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-400 text-sm">
                    Could not load file: {textError}
                    <br />
                    <a href={resourceUrl} target="_blank" rel="noopener noreferrer" className="underline mt-2 inline-block text-violet-400">
                      Open file directly
                    </a>
                  </div>
                )}
                {textContent !== null && !loadingText && (
                  <TextRenderer content={textContent} fileName={resourceName} />
                )}
              </>
            )}

            {/* PDF — render in iframe */}
            {isPdfType(ext) && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-sm text-zinc-300">
                  <FileText className="w-4 h-4 text-violet-400" />
                  {resourceName || `${type} resource`}
                </div>
                <iframe src={resourceUrl} title={resourceName || type} className="w-full h-[75vh] bg-zinc-950" />
              </div>
            )}

            {/* Unknown — download link */}
            {!isTextType(ext) && !isPdfType(ext) && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <FileText className="w-12 h-12 text-violet-400 mx-auto mb-4" />
                <p className="text-white font-semibold mb-2">{resourceName || 'Resource file'}</p>
                <p className="text-zinc-400 text-sm mb-6">
                  This file type cannot be previewed in the browser.
                </p>
                <a
                  href={resourceUrl}
                  download
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                >
                  Download File
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">
            No {type} is available for this lesson yet.
          </div>
        )}
      </main>
    </div>
  )
}
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

  const questions = useMemo(() => {
    return Array.isArray(lesson?.quiz_questions) ? lesson!.quiz_questions : []
  }, [lesson])

  const score = questions.reduce((sum, q, index) => sum + (answers[index] === q.answerIndex ? 1 : 0), 0)
  const resourceUrl = type === 'summary' ? lesson?.summary_url : lesson?.notes_url
  const resourceName = type === 'summary' ? lesson?.summary_name : lesson?.notes_name

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>
  }

  if (!lesson) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Resource not found.</div>
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <Link href={`/course/course/course/${lesson.course_id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
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
        </div>

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
                    <HelpCircle className="w-5 h-5 text-violet-400 mt-0.5" />
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
                            background: isCorrect ? 'rgba(74,222,128,0.1)' : isWrong ? 'rgba(239,68,68,0.1)' : isSelected ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.03)',
                            borderColor: isCorrect ? 'rgba(74,222,128,0.35)' : isWrong ? 'rgba(239,68,68,0.35)' : isSelected ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.08)',
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
            </div>
          )
        ) : resourceUrl ? (
          <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-sm text-zinc-300">
              <FileText className="w-4 h-4 text-violet-400" />
              {resourceName || `${type} resource`}
            </div>
            <iframe src={resourceUrl} title={resourceName || type} className="w-full h-[75vh] bg-zinc-950" />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">
            No {type} is available for this lesson yet.
          </div>
        )}

        {submitted && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            Quiz completed on this device.
          </div>
        )}
      </main>
    </div>
  )
}

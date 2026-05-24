'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
}

const emptyQuestion: QuizQuestion = {
  question: '',
  options: ['', '', '', ''],
  answerIndex: 0,
}

export default function LessonQuizBuilderPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>
}) {
  const { id, lessonId } = use(params)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([{ ...emptyQuestion }])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('lessons')
        .select('title,quiz_questions')
        .eq('id', lessonId)
        .eq('course_id', id)
        .limit(1)

      const lesson = data?.[0]
      setTitle(lesson?.title || 'Lesson Quiz')
      if (Array.isArray(lesson?.quiz_questions) && lesson.quiz_questions.length > 0) {
        setQuestions(lesson.quiz_questions)
      }
    }
    load()
  }, [id, lessonId])

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...patch } : q))
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== questionIndex) return q
      const options = [...q.options]
      options[optionIndex] = value
      return { ...q, options }
    }))
  }

  async function saveQuiz() {
    setMessage('')
    const cleaned = questions
      .map(q => ({
        question: q.question.trim(),
        options: q.options.map(o => o.trim()).filter(Boolean).slice(0, 4),
        answerIndex: q.answerIndex,
      }))
      .filter(q => q.question && q.options.length >= 2 && q.answerIndex < q.options.length)

    if (cleaned.length === 0) {
      setMessage('Add at least one valid question with two options and one answer.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('lessons')
      .update({ quiz_questions: cleaned })
      .eq('id', lessonId)
      .eq('course_id', id)

    setSaving(false)
    setMessage(error ? error.message : 'Quiz saved.')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/dashboard/courses/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to course
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-400 font-bold">Quiz Builder</p>
            <h1 className="text-2xl font-bold mt-2">{title}</h1>
          </div>
          <button
            onClick={saveQuiz}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Question {index + 1}</p>
                {questions.length > 1 && (
                  <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== index))}
                    className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <input
                value={q.question}
                onChange={e => updateQuestion(index, { question: e.target.value })}
                placeholder="Type the question"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none mb-4"
              />

              <div className="grid gap-3">
                {q.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={q.answerIndex === optionIndex}
                      onChange={() => updateQuestion(index, { answerIndex: optionIndex })}
                    />
                    <input
                      value={option}
                      onChange={e => updateOption(index, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setQuestions(prev => [...prev, { ...emptyQuestion, options: [...emptyQuestion.options] }])}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>

        {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
      </main>
    </div>
  )
}

/**
 * src/app/api/ai/ask/route.ts
 * ─────────────────────────────────────────────────────────────────
 * AI Doubt Assistant — general study helper, not fed lesson content.
 * Quota: MAX_QUESTIONS_PER_LESSON per student per lesson, enforced
 * server-side via a count-only row in lesson_ai_usage (no question/
 * answer text stored in the DB — that lives only in the student's
 * browser via sessionStorage, per design).
 *
 * Same access rule as lesson Q&A: enrolled, or free-preview lesson on
 * a published course.
 *
 * Provider: Gemini 2.5 Flash first (free tier), DeepSeek fallback.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveQaIdentity } from '@/lib/qaIdentity'

const MAX_QUESTIONS_PER_LESSON = 10
const MAX_QUESTION_WORDS = 500

const SYSTEM_PROMPT =
  'You are a friendly study helper inside an online course platform. A student has a quick general doubt — ' +
  'a term they don\'t know, a concept they want explained simply, something they\'re stuck on. Answer clearly ' +
  'and simply, like you\'re explaining it to someone mid-lesson who just needs a good answer so they can keep ' +
  'going. If the question has nothing to do with learning or study topics, politely say you can only help ' +
  'with study questions.'

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

async function askGemini(question: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[askGemini] GEMINI_API_KEY is not set')
    return null
  }
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        }),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      console.error('[askGemini] Gemini returned', res.status, body)
      return null
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ').trim()
    return text || null
  } catch (err: any) {
    console.error('[askGemini] threw', err.message)
    return null
  }
}

async function askDeepSeek(question: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('[askDeepSeek] DEEPSEEK_API_KEY is not set')
    return null
  }
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        max_tokens: 500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[askDeepSeek] DeepSeek returned', res.status, body)
      return null
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content?.trim() || null
  } catch (err: any) {
    console.error('[askDeepSeek] threw', err.message)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { lessonId, question, enrollmentId } = await req.json()

    if (!lessonId || !question || !question.trim()) {
      return NextResponse.json({ error: 'lessonId and question are required' }, { status: 400 })
    }
    if (wordCount(question) > MAX_QUESTION_WORDS) {
      return NextResponse.json({ error: `Keep questions under ${MAX_QUESTION_WORDS} words.` }, { status: 400 })
    }

    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, is_free')
      .eq('id', lessonId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const identity = await resolveQaIdentity(req, lesson.course_id, enrollmentId)

    if (!identity) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('is_published, is_free_course')
        .eq('id', lesson.course_id)
        .single()
      const isFreePreview = course?.is_published !== false && (course?.is_free_course || lesson.is_free)
      if (!isFreePreview) {
        return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 })
      }
    }

    let remaining = MAX_QUESTIONS_PER_LESSON
    if (identity?.kind === 'student') {
      const { count } = await supabaseAdmin
        .from('lesson_ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonId)
        .eq('enrollment_id', identity.enrollmentId)

      if ((count || 0) >= MAX_QUESTIONS_PER_LESSON) {
        return NextResponse.json(
          { error: `You've reached the ${MAX_QUESTIONS_PER_LESSON}-question limit for this lesson.` },
          { status: 429 }
        )
      }
      remaining = MAX_QUESTIONS_PER_LESSON - (count || 0) - 1
    }

    const answer = (await askGemini(question.trim())) || (await askDeepSeek(question.trim()))

    if (!answer) {
      return NextResponse.json({ error: 'The AI assistant is temporarily unavailable — try again in a moment.' }, { status: 502 })
    }

    // Count-only — no question/answer text stored server-side.
    if (identity?.kind === 'student') {
      await supabaseAdmin.from('lesson_ai_usage').insert({
        lesson_id: lessonId,
        enrollment_id: identity.enrollmentId,
      })
    }

    return NextResponse.json({ answer, remaining })
  } catch (err: any) {
    console.error('[ai/ask POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
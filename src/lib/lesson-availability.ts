/**
 * src/lib/lesson-availability.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared logic for the lesson-messaging feature. Kept deliberately
 * pure (no DB calls) so it's safe to reuse from any API route or
 * page without pulling in a Supabase client — callers fetch the data,
 * this file just decides what it means.
 *
 * Mirrors the same content-check rules already used in the creator
 * dashboard (`lessonNeedsContent` in dashboard/courses/[id]/page.tsx)
 * — kept as a separate copy rather than a shared import so nothing
 * about the existing, working dashboard behavior is touched.
 * ─────────────────────────────────────────────────────────────────
 */

export interface LessonAvailabilityInput {
  order_num: number
  is_published: boolean
  content_type: string
  quiz_questions?: unknown[] | null
  assignment_prompt?: string | null
  assignment_file_url?: string | null
}

/**
 * Quiz/assignment lessons can exist as an empty shell before the creator
 * adds real content — this catches that case. Video/PDF/live lessons
 * have no separate "content" concept beyond existing, so they never need
 * this check.
 */
export function lessonNeedsContent(lesson: LessonAvailabilityInput): boolean {
  if (lesson.content_type === 'quiz') {
    return !Array.isArray(lesson.quiz_questions) || lesson.quiz_questions.length === 0
  }
  if (lesson.content_type === 'assignment') {
    return !lesson.assignment_prompt?.trim() && !lesson.assignment_file_url?.trim()
  }
  return false
}

/**
 * A lesson is genuinely available to students only when it's both
 * published AND (for quiz/assignment types) has real content.
 */
export function isLessonAvailable(lesson: LessonAvailabilityInput): boolean {
  return lesson.is_published && !lessonNeedsContent(lesson)
}

/**
 * Human-readable reason a lesson isn't available yet, or null if it is.
 * Used both for the broadcast page's status column and for tooltip text.
 */
export function lessonUnavailableReason(lesson: LessonAvailabilityInput): string | null {
  if (!lesson.is_published) return 'Not published'
  if (lessonNeedsContent(lesson)) return 'Content not added'
  return null
}

export interface NextLessonSlot {
  /** The lesson number "Next Lesson" actually refers to right now. */
  nextNumber: number
  /** Whether a message can currently be sent targeting that slot. */
  isTargetable: boolean
  /** Why it's blocked, for a disabled-option tooltip — null if targetable. */
  blockedReason: string | null
}

/**
 * Resolves what "Next Lesson" means for a course right now, and whether
 * it's currently valid to target with a message. The rule: the next slot
 * can only be targeted once the immediately-preceding real lesson is
 * fully available (published + content, where applicable) — a creator
 * can't queue up messages for lesson 6 while lesson 5 still isn't ready.
 *
 * If no lessons exist yet at all, there's no "previous lesson" to block
 * on, so slot 1 is always targetable.
 */
export function getNextLessonSlot(lessons: LessonAvailabilityInput[]): NextLessonSlot {
  if (lessons.length === 0) {
    return { nextNumber: 1, isTargetable: true, blockedReason: null }
  }

  const sorted = [...lessons].sort((a, b) => a.order_num - b.order_num)
  const lastLesson = sorted[sorted.length - 1]
  const nextNumber = lastLesson.order_num + 1

  const reason = lessonUnavailableReason(lastLesson)
  if (reason) {
    return {
      nextNumber,
      isTargetable: false,
      blockedReason: `Lesson ${lastLesson.order_num} isn't ready yet (${reason.toLowerCase()}) — make it available before messaging about the next one.`,
    }
  }

  return { nextNumber, isTargetable: true, blockedReason: null }
}
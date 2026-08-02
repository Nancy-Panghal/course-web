/**
 * src/lib/freeLesson.ts
 *
 * Single source of truth for the free-lesson access check.
 * Every call site in course-web must import this function — do NOT
 * re-implement the OR condition inline anywhere else.
 *
 * The bot repos (telegram-bot, whatsapp-bot) each carry a copy of this
 * logic in their own isLessonFree() helper.  Those copies MUST be kept
 * byte-for-byte identical to the logic below; look for the comment
 * "KEEP IN SYNC WITH src/lib/freeLesson.ts" in each bot file.
 */

export function isLessonFree(
  lesson: { is_free: boolean },
  course: { is_free_course: boolean }
): boolean {
  return course.is_free_course === true || lesson.is_free === true
}

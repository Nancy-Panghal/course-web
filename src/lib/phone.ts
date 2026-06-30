/**
 * src/lib/phone.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for phone number normalization.
 *
 * Different parts of the system were storing/matching phone numbers in
 * different formats — some with a leading "+", some without, some with
 * spaces/dashes from a checkout form. Since `enrollments.phone` is used
 * both as a lookup key (Telegram/WhatsApp identity matching) AND has a
 * unique constraint (enrollments_one_paid_phone_per_course), format
 * drift caused duplicate enrollment rows for the same real person and
 * intermittent "enrollment not found" / unique-constraint failures.
 *
 * Always normalize phone numbers through this function before reading
 * OR writing the `phone` column anywhere (enrollments, students,
 * whatsapp_tokens). Stored format: digits only, no "+", no spaces.
 * ─────────────────────────────────────────────────────────────────
 */

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits || null
}
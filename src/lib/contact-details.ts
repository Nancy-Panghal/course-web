// src/lib/contact-details.ts
//
// Single source of truth for the landing-page "Contact details" feature:
// up to 2 phone numbers + 2 emails per course, each with its own short
// message and its own placement (below the description / in the footer).
//
// Stored in courses.contact_details as a JSON array. The database also
// enforces the caps and message limits with a CHECK constraint (see the
// SQL migration), so these constants must stay in sync with it.

export const MAX_PHONES = 2
export const MAX_EMAILS = 2
export const MAX_CONTACT_MESSAGE_CHARS = 25
export const MAX_CONTACT_MESSAGE_WORDS = 4
const MAX_CONTACT_VALUE_CHARS = 254

export type ContactType = 'phone' | 'email'

export interface ContactDetail {
  type: ContactType
  /** The actual phone number or email address. */
  value: string
  /** Short custom message shown with this entry ('' = none). */
  message: string
  /** Show in the block below the course description. */
  show_below_description: boolean
  /** Show in the page footer. Independent of show_below_description. */
  show_in_footer: boolean
}

export interface ContactEntryErrors {
  value?: string
  message?: string
}

// ── Counting / cleaning ───────────────────────────────────────────

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** Plain text, one line, single spaces. */
export function cleanContactMessage(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Validation ────────────────────────────────────────────────────

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const PHONE_CHARS_RE = /^\+?[0-9\s\-().]+$/

export function isValidEmail(value: string): boolean {
  const v = value.trim()
  return v.length <= MAX_CONTACT_VALUE_CHARS && EMAIL_RE.test(v)
}

export function isValidPhone(value: string): boolean {
  const v = value.trim()
  if (!PHONE_CHARS_RE.test(v)) return false
  const digits = v.replace(/\D/g, '').length
  return digits >= 7 && digits <= 15
}

function messageError(raw: string): string | undefined {
  const cleaned = cleanContactMessage(raw)
  if (cleaned.length > MAX_CONTACT_MESSAGE_CHARS) {
    return `Keep it to ${MAX_CONTACT_MESSAGE_CHARS} characters or fewer.`
  }
  if (countWords(cleaned) > MAX_CONTACT_MESSAGE_WORDS) {
    return `Keep it to ${MAX_CONTACT_MESSAGE_WORDS} words or fewer.`
  }
  return undefined
}

/** Per-entry errors (same order as `entries`) + a single hasErrors flag.
 *  A completely blank row (no number/email, no message) is NOT an error —
 *  it is simply not saved. */
export function getContactDetailsErrors(entries: ContactDetail[]): {
  errors: ContactEntryErrors[]
  hasErrors: boolean
} {
  const errors: ContactEntryErrors[] = entries.map(entry => {
    const err: ContactEntryErrors = {}
    const value = entry.value.trim()
    const noun = entry.type === 'phone' ? 'phone number' : 'email address'

    if (!value) {
      if (cleanContactMessage(entry.message)) {
        err.value = `Add the ${noun} this message belongs to, or clear the message.`
      }
    } else if (entry.type === 'phone' ? !isValidPhone(value) : !isValidEmail(value)) {
      err.value =
        entry.type === 'phone'
          ? 'Enter a valid phone number (7–15 digits, e.g. +91 98765 43210).'
          : 'Enter a valid email address.'
    }

    const msgErr = messageError(entry.message)
    if (msgErr) err.message = msgErr
    return err
  })
  return { errors, hasErrors: errors.some(e => e.value || e.message) }
}

// ── Reading from / writing to the database ────────────────────────

function toBool(v: unknown): boolean {
  return v === true
}

/** Structural parse only — used by the settings editor. Keeps entries whose
 *  value is invalid (so the creator sees and fixes them instead of them
 *  silently vanishing), and applies the 2 phone + 2 email caps. */
export function parseContactDetails(raw: unknown): ContactDetail[] {
  if (!Array.isArray(raw)) return []
  const out: ContactDetail[] = []
  let phones = 0
  let emails = 0
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (o.type !== 'phone' && o.type !== 'email') continue
    if (typeof o.value !== 'string') continue
    if (o.type === 'phone') {
      if (phones >= MAX_PHONES) continue
      phones++
    } else {
      if (emails >= MAX_EMAILS) continue
      emails++
    }
    out.push({
      type: o.type,
      value: o.value,
      message: typeof o.message === 'string' ? o.message : '',
      show_below_description: toBool(o.show_below_description),
      show_in_footer: toBool(o.show_in_footer),
    })
  }
  return out
}

/** What the public landing page renders: parsed, blank/invalid values
 *  dropped, messages clamped to the limits. Never throws on bad data. */
export function getRenderableContactDetails(raw: unknown): ContactDetail[] {
  return parseContactDetails(raw)
    .map(d => ({
      ...d,
      value: d.value.trim(),
      message: cleanContactMessage(d.message)
        .split(' ')
        .filter(Boolean)
        .slice(0, MAX_CONTACT_MESSAGE_WORDS)
        .join(' ')
        .slice(0, MAX_CONTACT_MESSAGE_CHARS)
        .trim(),
    }))
    .filter(d => d.value && (d.type === 'phone' ? isValidPhone(d.value) : isValidEmail(d.value)))
}

/** What gets written to courses.contact_details: blank rows removed, text
 *  trimmed, phones first then emails, caps applied. Call only after
 *  getContactDetailsErrors(...).hasErrors is false. */
export function cleanContactDetails(entries: ContactDetail[]): ContactDetail[] {
  const cleaned = entries
    .map(e => ({
      type: e.type,
      value: e.value.trim(),
      message: cleanContactMessage(e.message),
      show_below_description: e.show_below_description,
      show_in_footer: e.show_in_footer,
    }))
    .filter(e => e.value)
  return [
    ...cleaned.filter(e => e.type === 'phone').slice(0, MAX_PHONES),
    ...cleaned.filter(e => e.type === 'email').slice(0, MAX_EMAILS),
  ]
}

/** tel:/mailto: link for one entry. Digits-only (plus a leading +) for
 *  phones so spaces/dashes in what the creator typed never break the link. */
export function contactHref(entry: Pick<ContactDetail, 'type' | 'value'>): string {
  const v = entry.value.trim()
  if (entry.type === 'email') return `mailto:${v}`
  return `tel:${v.startsWith('+') ? '+' : ''}${v.replace(/\D/g, '')}`
}
// ── Grouping (for display only) ────────────────────────────────────

export interface ContactGroup {
  type: ContactType
  /** '' when this group's entries have no shared message. */
  message: string
  /** 1 entry normally; 2 when both phones (or both emails) share one message. */
  entries: ContactDetail[]
}

/** Groups entries so that two phones (or two emails) with the exact same
 *  custom message render as one group instead of repeating the message.
 *  Entries with no message, or a message no other entry shares, each stay
 *  their own group of one. Order of first appearance is preserved. */
export function groupContactDetails(entries: ContactDetail[]): ContactGroup[] {
  const groups: ContactGroup[] = []
  const indexByKey = new Map<string, number>()
  for (const entry of entries) {
    const msg = entry.message.trim()
    if (msg) {
      const key = `${entry.type}|${msg.toLowerCase()}`
      const existing = indexByKey.get(key)
      if (existing !== undefined) {
        groups[existing].entries.push(entry)
        continue
      }
      indexByKey.set(key, groups.length)
    }
    groups.push({ type: entry.type, message: msg, entries: [entry] })
  }
  return groups
}
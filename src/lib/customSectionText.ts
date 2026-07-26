import sanitizeHtml from 'sanitize-html'

export const MAX_CUSTOM_HEADING_LENGTH = 120
export const MAX_CUSTOM_BODY_LENGTH = 4000
export const MAX_CUSTOM_SECTIONS_PER_COURSE = 8

/**
 * Custom sections are TEXT ONLY — no images, video, embeds, or links, by
 * product decision. This strips every HTML tag and attribute a creator might
 * have pasted in from Word/Docs/a rich editor, keeping only the plain text
 * and its line breaks. There's no "allowed tags" list to maintain because
 * nothing but plain text is ever allowed through.
 */
export function sanitizeCustomSectionText(raw: string): string {
  if (typeof raw !== 'string') return ''
  const textOnly = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} })
  return textOnly
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}
/**
 * src/lib/formatCommentTime.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared timestamp formatting for lesson Q&A comments — YouTube-style:
 * under 24 hours old shows a relative time ("3 hours ago", "12 minutes
 * ago"), 24 hours or older shows an absolute date only (no time).
 *
 * Used anywhere a comment timestamp is rendered — keep this the single
 * source of truth rather than reimplementing per-render.
 * ─────────────────────────────────────────────────────────────────
 */

export function formatCommentTime(isoString: string): string {
  const then = new Date(isoString).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
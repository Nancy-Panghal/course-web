// src/lib/policyDocs.ts
//
// Shared helpers for creator-uploaded policy documents (Refund Policy,
// Terms & Conditions, Privacy Policy) shown on a course's landing page.
// Creators upload one .txt/.md file per doc; this module owns the size
// limit and the heading/body parser used to render it in the course theme.

export const MAX_POLICY_FILE_BYTES = 20 * 1024 // 20 KB

export type PolicyDocType = 'refund' | 'terms' | 'privacy'

export const POLICY_DOC_LABELS: Record<PolicyDocType, string> = {
  refund: 'Refund Policy',
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
}

export type PolicyBlock = { heading: string; body: string }

/**
 * Parses a creator-written policy doc into heading/body blocks.
 * Convention: a line starting with "#", "##" or "###" starts a new
 * section — everything until the next heading is that section's body.
 * Text before the first heading is grouped under "Overview" so nothing
 * a creator writes is ever silently dropped.
 */
export function parsePolicyDoc(raw: string): PolicyBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: PolicyBlock[] = []
  let current: PolicyBlock | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      if (current) blocks.push(current)
      current = { heading: headingMatch[1].trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else if (line.trim()) {
      current = { heading: 'Overview', body: line }
    }
  }
  if (current) blocks.push(current)

  return blocks
    .map(b => ({ heading: b.heading, body: b.body.trim() }))
    .filter(b => b.heading || b.body)
}
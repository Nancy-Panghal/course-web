/** Shared assignment file rules (web + Telegram). */

export const ASSIGNMENT_MAX_BYTES = 5 * 1024 * 1024

export const ASSIGNMENT_ALLOWED_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'pdf',
  'doc',
  'docx',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
] as const

const MIME_TO_EXT: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function sanitizeAssignmentFilename(name: string): string {
  return String(name || 'submission')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

export function resolveAssignmentExtension(filename: string, mimeType?: string | null): string | null {
  const extFromName = filename.includes('.')
    ? filename.split('.').pop()?.toLowerCase()
    : null

  if (extFromName && ASSIGNMENT_ALLOWED_EXTENSIONS.includes(extFromName as typeof ASSIGNMENT_ALLOWED_EXTENSIONS[number])) {
    return extFromName === 'jpeg' ? 'jpg' : extFromName
  }

  const fromMime = mimeType ? MIME_TO_EXT[mimeType.toLowerCase()] : null
  if (fromMime) return fromMime

  if (mimeType === 'application/octet-stream' && extFromName) {
    const normalized = extFromName === 'jpeg' ? 'jpg' : extFromName
    if (ASSIGNMENT_ALLOWED_EXTENSIONS.includes(normalized as typeof ASSIGNMENT_ALLOWED_EXTENSIONS[number])) {
      return normalized
    }
  }

  return null
}

export function validateAssignmentFile(
  filename: string,
  mimeType: string | null | undefined,
  sizeBytes: number,
): { ok: true; ext: string } | { ok: false; error: string } {
  if (!sizeBytes || sizeBytes <= 0) {
    return { ok: false, error: 'File is empty' }
  }
  if (sizeBytes > ASSIGNMENT_MAX_BYTES) {
    return { ok: false, error: 'File must be 5 MB or smaller' }
  }

  const ext = resolveAssignmentExtension(filename, mimeType)
  if (!ext) {
    return {
      ok: false,
      error: 'Allowed types: TXT, Markdown, PDF, Word (DOC/DOCX), or images (JPG, PNG, WEBP, GIF)',
    }
  }

  return { ok: true, ext }
}

export function assignmentStoragePath(
  courseId: string,
  enrollmentId: string,
  lessonId: string,
  ext: string,
): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `assignments/${courseId}/${enrollmentId}/${lessonId}-${Date.now()}-${rand}.${ext}`
}

export function assignmentMimeForExt(ext: string): string {
  const map: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return map[ext] || 'application/octet-stream'
}

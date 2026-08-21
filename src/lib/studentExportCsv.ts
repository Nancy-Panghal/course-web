/**
 * lib/studentExportCsv.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared CSV building logic for the student export feature, used by
 * both /api/analytics/[courseId]/export (per-course) and
 * /api/creator/students/export (all courses). Kept in one place so
 * both exports always produce the exact same column set — a creator
 * shouldn't get a different set of fields depending on which button
 * they clicked.
 * ─────────────────────────────────────────────────────────────────
 */

export interface ExportRow {
  studentName: string
  phone: string
  email: string
  courseName?: string // only included in the "all courses" export
  enrolledAt: string | null
  paymentStatus: string
  amountPaid: number | null
  completedCount: number
  totalLessons: number
  lastAccessed: string | null
  channel: string
  certificateIssued: boolean
}

// Escapes a single CSV field per RFC 4180: wraps in quotes and doubles
// any internal quotes, whenever the value contains a comma, quote, or
// newline that would otherwise break column alignment. A student's own
// name is free text they typed themselves — this is the one thing in
// the whole export that isn't controlled by Kurso, so it's the one
// value that actually needs this treatment.
function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function buildStudentCsv(rows: ExportRow[], includeCourseColumn: boolean): string {
  const headers = [
    'Student Name',
    'Phone',
    'Email',
    ...(includeCourseColumn ? ['Course'] : []),
    'Enrolled Date',
    'Payment Status',
    'Amount Paid (INR)',
    'Lessons Completed',
    'Progress %',
    'Last Active',
    'Channel',
    'Certificate Issued',
  ]

  const lines = rows.map(r => {
    const progressPct = r.totalLessons > 0 ? Math.round((r.completedCount / r.totalLessons) * 100) : 0
    const fields = [
      csvField(r.studentName || 'Unknown'),
      csvField(r.phone),
      csvField(r.email),
      ...(includeCourseColumn ? [csvField(r.courseName || '')] : []),
      csvField(formatDate(r.enrolledAt)),
      csvField(r.paymentStatus),
      csvField(r.amountPaid ?? ''),
      csvField(`${r.completedCount}/${r.totalLessons}`),
      csvField(`${progressPct}%`),
      csvField(formatDate(r.lastAccessed)),
      csvField(r.channel),
      csvField(r.certificateIssued ? 'Yes' : 'No'),
    ]
    return fields.join(',')
  })

  // Leading \uFEFF (byte-order mark) so Excel — which a lot of Indian
  // creators will actually open this in — correctly detects UTF-8
  // instead of mis-rendering non-ASCII student names.
  return '\uFEFF' + [headers.join(','), ...lines].join('\r\n')
}
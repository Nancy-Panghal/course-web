import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'
import { sendLoggedEmail, escapeHtml } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_ROWS_PER_REQUEST = 2000
const BATCH_CONCURRENCY = 10

type ImportRow = {
  name?: string
  phone?: string
  email?: string
  amountPaid?: number | string
  enrolledAt?: string
}

type RowResult = {
  row: number
  status: 'created' | 'updated' | 'skipped' | 'failed'
  reason?: string
  name?: string
  identifier?: string
}

async function firstRow(query: any) {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

function parseAmountPaid(raw: ImportRow['amountPaid']): number {
  if (raw === undefined || raw === null || raw === '') return 0
  const n = Number(String(raw).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

function parseEnrolledAt(raw: string | undefined): string {
  if (!raw) return new Date().toISOString()
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/**
 * Creates (or upgrades to paid) a web login for a migrated student who
 * supplied an email — via admin.generateLink, never Supabase's own default
 * invite email, so the branded Kurso email + Resend pipeline stays the
 * single source of outbound mail. Best-effort: a failure here never blocks
 * the enrollment itself — WhatsApp/Telegram access does not depend on it.
 */
async function provisionWebAccountAndNotify(opts: {
  email: string
  name: string
  phone: string | null
  courseId: string
  courseName: string
  creatorId: string
  creatorName: string
}): Promise<string | null> {
  const { email, name, phone, courseId, courseName, creatorId, creatorName } = opts

  let authUserId: string | null = null
  let actionLink: string | null = null

  const signupAttempt = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    password: randomUUID(),
    options: { data: { full_name: name || null, role: 'student', phone: phone || null } },
  })

  if (!signupAttempt.error && signupAttempt.data?.user) {
    authUserId = signupAttempt.data.user.id
    actionLink = signupAttempt.data.properties?.action_link || null
  } else {
    // Already registered (e.g. this email signed up before, on this or
    // another course) — send a recovery link to set/reset their password
    // instead of failing the whole row.
    const recoveryAttempt = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    })
    if (!recoveryAttempt.error && recoveryAttempt.data?.user) {
      authUserId = recoveryAttempt.data.user.id
      actionLink = recoveryAttempt.data.properties?.action_link || null
    }
  }

  if (!authUserId || !actionLink) return null

  const safeName = escapeHtml(name || 'there')
  const safeCourse = escapeHtml(courseName)
  const safeCreator = escapeHtml(creatorName)

  await sendLoggedEmail({
    supabase,
    emailType: 'migrated_student_set_password',
    to: email,
    subject: `Your ${courseName} access on Kurso is ready`,
    creatorId,
    courseId,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Hi ${safeName},</h2>
        <p style="margin:0 0 8px">${safeCreator} has moved <strong>${safeCourse}</strong> to Kurso. Your enrollment has already been carried over — no need to pay again.</p>
        <p style="margin:0 0 16px">Set a password to access your course on the web (you can also keep using WhatsApp/Telegram if you were already using those):</p>
        <a href="${actionLink}"
          style="display:inline-block;background:#f79514;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
          Set your password
        </a>
        <p style="margin:16px 0 0;font-size:12px;color:#666">If the button doesn't work, open this link: ${actionLink}</p>
      </div>
    `,
  })

  return authUserId
}

export async function POST(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { courseId, rows, sendWebInvite } = (await req.json()) as {
      courseId: string
      rows: ImportRow[]
      sendWebInvite?: boolean
    }

    if (!courseId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'courseId and a non-empty rows array are required' }, { status: 400 })
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many rows in one file (${rows.length}). Please split into batches of ${MAX_ROWS_PER_REQUEST} or fewer.` },
        { status: 400 }
      )
    }

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, creator_id, delivery, host_name')
      .eq('id', courseId)
      .maybeSingle()
    if (courseErr) throw courseErr
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.creator_id !== creator.id) {
      return NextResponse.json({ error: 'You can only import students into your own course.' }, { status: 403 })
    }

    const { data: creatorProfile } = await supabase
      .from('creators')
      .select('name')
      .eq('id', creator.id)
      .maybeSingle()
    const creatorName = creatorProfile?.name || course.host_name || 'Your instructor'
    const effectiveDeliveryMethod = course.delivery || 'both'
    const creatorId = creator.id
    const courseName = course.name

    async function processRow(raw: ImportRow, index: number): Promise<RowResult> {
      const rowNum = index + 1
      try {
        const name = (raw.name || '').trim() || null
        const normalizedPhone = normalizePhone(raw.phone || '')
        const email = (raw.email || '').trim().toLowerCase() || null

        if (!normalizedPhone && !email) {
          return { row: rowNum, status: 'failed', reason: 'No phone or email provided', name: name || undefined }
        }

        // enrollments.phone is NOT NULL — mirrors the existing system-wide
        // convention (see findPaidEnrollment / webhook handler) of storing
        // the email in the phone column when no phone was collected.
        const phoneOrEmail = normalizedPhone || (email as string)
        const amountPaid = parseAmountPaid(raw.amountPaid)
        const enrolledAt = parseEnrolledAt(raw.enrolledAt)

        // ── Upsert student ──────────────────────────────────────────
        let student: { id: string } | null = null
        if (normalizedPhone) {
          student = await firstRow(supabase.from('students').select('id').eq('phone', normalizedPhone))
        }
        if (!student && email) {
          student = await firstRow(supabase.from('students').select('id').eq('email', email))
        }

        if (student) {
          await supabase
            .from('students')
            .update({
              name: name || undefined,
              phone: normalizedPhone || undefined,
              email: email || undefined,
            })
            .eq('id', student.id)
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('students')
            .insert({ name, phone: normalizedPhone, email })
            .select('id')
            .single()
          if (insertErr) throw insertErr
          student = inserted
        }

        // ── Find existing enrollment (by student_id, then by phone) ──
        let existing = await firstRow(
          supabase
            .from('enrollments')
            .select('id, payment_status, delivery_method, source')
            .eq('course_uuid', courseId)
            .eq('student_id', student.id)
        )
        if (!existing) {
          existing = await firstRow(
            supabase
              .from('enrollments')
              .select('id, payment_status, delivery_method, source')
              .eq('course_uuid', courseId)
              .eq('phone', phoneOrEmail)
          )
        }

        if (existing && existing.payment_status === 'paid') {
          return {
            row: rowNum,
            status: 'skipped',
            reason: 'Already has a paid enrollment for this course',
            name: name || undefined,
            identifier: phoneOrEmail,
          }
        }

        const paymentId = `MIGRATED:${courseId}:${phoneOrEmail}`

        if (existing) {
          const { error: updateErr } = await supabase
            .from('enrollments')
            .update({
              student_id: student.id,
              phone: phoneOrEmail,
              certificate_student_name: name,
              payment_status: 'paid',
              payment_id: paymentId,
              amount_paid: amountPaid,
              enrolled_at: enrolledAt,
              delivery_method: existing.delivery_method || effectiveDeliveryMethod,
              source: 'migrated',
              is_test: false,
            })
            .eq('id', existing.id)
          if (updateErr) throw updateErr

          if (email && sendWebInvite) {
            await provisionWebAccountAndNotify({
              email, name: name || '', phone: normalizedPhone, courseId,
              courseName, creatorId, creatorName,
            }).catch(() => null)
          }

          return { row: rowNum, status: 'updated', name: name || undefined, identifier: phoneOrEmail }
        }

        const { error: insertEnrollErr } = await supabase.from('enrollments').insert({
          course_uuid: courseId,
          creator_id: creatorId,
          student_id: student.id,
          phone: phoneOrEmail,
          certificate_student_name: name,
          current_lesson: 1,
          completed_lessons: [],
          quiz_results: [],
          payment_status: 'paid',
          payment_id: paymentId,
          amount_paid: amountPaid,
          enrolled_at: enrolledAt,
          delivery_method: effectiveDeliveryMethod,
          is_test: false,
          source: 'migrated',
        })
        // A collision here means another row (or a previous import run)
        // already claimed this exact phone/course pair or payment_id —
        // treat as a clean skip rather than a hard failure.
        if (insertEnrollErr) {
          if (insertEnrollErr.code === '23505') {
            return {
              row: rowNum,
              status: 'skipped',
              reason: 'Already imported (duplicate phone/email in this course)',
              name: name || undefined,
              identifier: phoneOrEmail,
            }
          }
          throw insertEnrollErr
        }

        if (email && sendWebInvite) {
          await provisionWebAccountAndNotify({
            email, name: name || '', phone: normalizedPhone, courseId,
            courseName, creatorId, creatorName,
          }).catch(() => null)
        }

        return { row: rowNum, status: 'created', name: name || undefined, identifier: phoneOrEmail }
      } catch (err: any) {
        console.error(`[creator/students/import] row ${rowNum} failed:`, err)
        return { row: rowNum, status: 'failed', reason: err.message || 'Unknown error' }
      }
    }

    const results: RowResult[] = new Array(rows.length)
    for (let i = 0; i < rows.length; i += BATCH_CONCURRENCY) {
      const batch = rows.slice(i, i + BATCH_CONCURRENCY)
      const batchResults = await Promise.all(batch.map((r, j) => processRow(r, i + j)))
      batchResults.forEach((r, j) => { results[i + j] = r })
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
    }

    return NextResponse.json({ summary, results })
  } catch (err: any) {
    console.error('[creator/students/import] POST failed:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
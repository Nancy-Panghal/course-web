/**
 * app/api/pdf/view/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Secure PDF proxy with server-side watermarking.
 * - Verifies signed URL
 * - Verifies enrollment
 * - Burns student identity into PDF using pdf-lib before serving
 * - Sets headers to prevent download (inline display only)
 * - Storage URL never reaches client
 *
 * Install: npm install pdf-lib
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { verifyPdfUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyEnrollment(lessonId: string, identity: string): Promise<boolean> {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id, order_num')
    .eq('id', lessonId)
    .single()

  if (!lesson) return false

  // 1. Free preview check first
  const { data: course } = await supabase
    .from('courses')
    .select('free_preview_config')
    .eq('id', lesson.course_id)
    .single()

  const config = course?.free_preview_config || 'nothing free'
  const maxFree: Record<string, number> = {
    'lesson 1 free': 1, '2 lessons free': 2, '3 lessons free': 3,
    'module 1 free': 3, '2 modules free': 6,
  }
  const isFree = lesson.order_num <= (maxFree[config] ?? 0)
  if (isFree) return true

  // 2. If it's guest 'web' access and not free, deny
  if (identity === 'web') return false

  // 3. Check if identity is a UUID (website user ID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)

  if (isUuid) {
    // Look up the student record by auth_id (user.id)
    const { data: student } = await supabase
      .from('students')
      .select('id, email, phone')
      .eq('auth_id', identity)
      .limit(1)
      .single()

    // Query enrollments using student_id
    if (student?.id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', lesson.course_id)
        .eq('payment_status', 'paid')
        .limit(1)
        .single()
      
      if (enrollment) return true
    }

    // Fallback: look up by student's email/phone on the enrollment
    if (student) {
      const identifiers: string[] = []
      if (student.phone) identifiers.push(student.phone)
      if (student.email) identifiers.push(student.email)

      if (identifiers.length > 0) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_uuid', lesson.course_id)
          .eq('payment_status', 'paid')
          .in('phone', identifiers)
          .limit(1)
          .single()
        
        if (enrollment) return true
      }
    }

    // Additional check: fetch from auth to check phone/email
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(identity)
      if (user) {
        const phone = user.phone || user.user_metadata?.phone
        const email = user.email
        const fallbackIdentifiers = [phone, email].filter(Boolean) as string[]

        if (fallbackIdentifiers.length > 0) {
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('course_uuid', lesson.course_id)
            .eq('payment_status', 'paid')
            .in('phone', fallbackIdentifiers)
            .limit(1)
            .single()
          
          if (enrollment) return true
        }
      }
    } catch (e) {
      console.warn('[verifyEnrollment] admin auth user lookup failed:', e)
    }

    return false
  }

  // 4. Otherwise, look up by Telegram chat ID (numeric string)
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('payment_status')
    .eq('telegram_chat_id', identity)
    .eq('course_uuid', lesson.course_id)
    .limit(1)
    .single()

  if (enrollment && enrollment.payment_status === 'paid') return true

  return false
}

async function getPdfBytes(lessonId: string): Promise<{ bytes: ArrayBuffer; filename: string } | null> {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('content_url, pdf_storage_path, content_type, title, is_published')
    .eq('id', lessonId)
    .single()

  if (!lesson || !lesson.is_published || lesson.content_type !== 'pdf') return null

  let url = lesson.content_url

  // If PDF is stored in Supabase, get a signed URL (server-side only)
  if (lesson.pdf_storage_path) {
    const { data, error } = await supabase.storage
      .from('lessons')
      .createSignedUrl(lesson.pdf_storage_path, 60) // 60s — server only
    if (error || !data?.signedUrl) {
      console.error('[PDF storage] Signed URL error:', error)
      return null
    }
    url = data.signedUrl
  }

  if (!url) return null

  const res = await fetch(url)
  if (!res.ok) return null

  return {
    bytes: await res.arrayBuffer(),
    filename: lesson.title || 'lesson',
  }
}

async function watermarkPdf(
  pdfBytes: ArrayBuffer,
  studentName: string,
  identity: string,
  lessonTitle: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const watermarkText = `Licensed to: ${studentName} · ID: ${identity.slice(-8)} · AcademyKit`
  const diagonalText = `${studentName} · AcademyKit`

  pages.forEach(page => {
    const { width, height } = page.getSize()

    // Bottom strip watermark - intentionally visible. Tiny/faint marks are easy to crop or erase.
    page.drawText(watermarkText, {
      x: 20,
      y: 12,
      size: 10,
      font,
      color: rgb(0.18, 0.18, 0.18),
      opacity: 0.82,
    })

    // Top strip
    page.drawText(`AcademyKit — Protected Content — ${new Date().toLocaleDateString('en-IN')}`, {
      x: 20,
      y: height - 16,
      size: 8,
      font,
      color: rgb(0.22, 0.22, 0.22),
      opacity: 0.62,
    })

    // Diagonal tiled watermark across the page. It is deliberately visible enough
    // to make clean removal expensive while keeping the PDF readable.
    const step = 130
    for (let x = -step; x < width + step; x += step) {
      for (let y = 0; y < height + step; y += step) {
        page.drawText(diagonalText, {
          x,
          y,
          size: 13,
          font,
          color: rgb(0.32, 0.32, 0.32),
          opacity: 0.16,
          rotate: degrees(35),
        })
      }
    }

    page.drawText(`LICENSED COPY - ${studentName} - ${identity.slice(-8)}`, {
      x: width * 0.12,
      y: height * 0.5,
      size: Math.max(18, width * 0.035),
      font,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.18,
      rotate: degrees(35),
    })
  })

  return pdf.save()
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  // 1. Verify signature
  const { valid, lessonId, identity } = verifyPdfUrl(params)
  if (!valid) {
    return new NextResponse('PDF link expired or invalid. Please request a fresh link.', { status: 401 })
  }

  // 2. Enrollment check
  const allowed = await verifyEnrollment(lessonId, identity)
  if (!allowed) {
    return new NextResponse('Not enrolled in this course.', { status: 403 })
  }

  // 3. Get PDF bytes
  const result = await getPdfBytes(lessonId)
  if (!result) {
    return new NextResponse('PDF not found or not published.', { status: 404 })
  }

  // 4. Get student name for watermark
  let studentName = `Student ${identity.slice(-6)}`
  if (identity !== 'web') {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)
    if (isUuid) {
      const { data: student } = await supabase
        .from('students')
        .select('name, phone, email')
        .eq('auth_id', identity)
        .limit(1)
        .single()
      if (student?.name) studentName = student.name
      else if (student?.phone) studentName = student.phone
      else if (student?.email) studentName = student.email
    } else {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('phone')
        .eq('telegram_chat_id', identity)
        .limit(1)
        .single()
      if (enrollment?.phone) studentName = enrollment.phone
    }
  }

  // 5. Watermark the PDF server-side
  let finalBytes: Uint8Array
  try {
    finalBytes = await watermarkPdf(result.bytes, studentName, identity, result.filename)
  } catch (err) {
    console.error('[pdf/view] Watermark failed, serving raw:', err)
    finalBytes = new Uint8Array(result.bytes)
  }

  // 6. Serve — inline only, no download
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${result.filename}.pdf"`,
    'Cache-Control': 'no-store, no-cache, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(finalBytes.byteLength),
  })

  return new NextResponse(finalBytes as any, { status: 200, headers })
}

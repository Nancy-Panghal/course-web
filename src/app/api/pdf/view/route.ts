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
  if (identity === 'web') return true

  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id, order_num')
    .eq('id', lessonId)
    .single()

  if (!lesson) return false

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('payment_status, courses:course_uuid(free_preview_config)')
    .eq('telegram_chat_id', identity)
    .eq('course_uuid', lesson.course_id)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .single()

  if (!enrollment) return false
  if (enrollment.payment_status === 'paid') return true

  const config = (enrollment.courses as any)?.free_preview_config || 'nothing free'
  const maxFree: Record<string, number> = {
    'lesson 1 free': 1, '2 lessons free': 2, '3 lessons free': 3,
    'module 1 free': 3, '2 modules free': 6,
  }
  return lesson.order_num <= (maxFree[config] ?? 0)
}

async function getPdfBytes(lessonId: string): Promise<{ bytes: ArrayBuffer; filename: string } | null> {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('content_url, content_type, title, is_published')
    .eq('id', lessonId)
    .single()

  if (!lesson || !lesson.is_published || lesson.content_type !== 'pdf') return null

  const url = lesson.content_url
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

    // Bottom strip watermark — always visible
    page.drawText(watermarkText, {
      x: 20,
      y: 12,
      size: 7,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: 0.5,
    })

    // Top strip
    page.drawText(`AcademyKit — Protected Content — ${new Date().toLocaleDateString('en-IN')}`, {
      x: 20,
      y: height - 16,
      size: 6,
      font,
      color: rgb(0.65, 0.65, 0.65),
      opacity: 0.35,
    })

    // Diagonal tiled watermark — subtle, survives crop
    const step = 160
    for (let x = -step; x < width + step; x += step) {
      for (let y = 0; y < height + step; y += step) {
        page.drawText(diagonalText, {
          x,
          y,
          size: 10,
          font,
          color: rgb(0.75, 0.75, 0.75),
          opacity: 0.06,
          rotate: degrees(35),
        })
      }
    }
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
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('phone')
      .eq('telegram_chat_id', identity)
      .limit(1)
      .single()
    if (enrollment?.phone) studentName = enrollment.phone
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

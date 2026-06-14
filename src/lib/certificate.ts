/**
 * Certificate generation library.
 * Generates PDF certificates using pdf-lib (A4 landscape).
 * Five distinct templates: classic | modern | gold | minimal | royal
 *
 * Usage:
 *   import { issueCertificate } from './certificate'
 *   const { certificateId, pdfUrl } = await issueCertificate(supabase, params)
 */

import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CertTemplate = 'classic' | 'modern' | 'gold' | 'minimal' | 'royal'

export const CERT_TEMPLATES: { id: CertTemplate; label: string; preview: string }[] = [
  { id: 'classic', label: 'Classic',  preview: 'White · Navy border · Gold accents · Times-Roman' },
  { id: 'modern',  label: 'Modern',   preview: 'Dark background · Violet accents · Helvetica' },
  { id: 'gold',    label: 'Gold',     preview: 'Ivory · Ornate gold borders · Warm palette' },
  { id: 'minimal', label: 'Minimal',  preview: 'Pure white · Single violet bar · Ultra clean' },
  { id: 'royal',   label: 'Royal',    preview: 'Deep navy · Gold typography · Premium feel' },
]

interface DrawData {
  studentName: string
  courseName:  string
  creatorName: string
  certificateId: string
  issuedAt: Date
  customMessage?: string
  courseDuration?: string
  totalHours?: string
  instructorName?: string
  instructorTitle?: string
  skills?: string[]
  verificationUrl?: string
}

// ─── Page dimensions (A4 landscape, in points) ───────────────────────────────
const W = 841.89
const H = 595.28

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** X offset to horizontally centre text on the page */
function cx(text: string, font: PDFFont, size: number): number {
  return (W - font.widthOfTextAtSize(text, size)) / 2
}

/** Hex colour → pdf-lib RGB (0–1 range) */
function hx(hex: string): RGB {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  )
}

/** Format date as "12 June 2025" */
function fmt(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Trim text so it never overflows maxWidth (in points) */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 4 && font.widthOfTextAtSize(t + '…', size) > maxWidth) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

// ─── Template 1: CLASSIC ─────────────────────────────────────────────────────
// White bg · navy double border · Times-Roman · navy/gold palette
function drawClassic(page: PDFPage, d: DrawData, tb: PDFFont, tr: PDFFont, ti: PDFFont) {
  const navy  = hx('#1a2744')
  const gold  = hx('#c9a227')
  const dkGld = hx('#8b6914')

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })

  // Outer navy border
  page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: navy, borderWidth: 3 })
  // Inner gold border
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: gold, borderWidth: 1.5 })
  // Innermost hair line
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: dkGld, borderWidth: 0.5 })

  // Corner gold squares
  for (const [bx, by] of [[28, 28], [W - 40, 28], [28, H - 40], [W - 40, H - 40]] as [number, number][]) {
    page.drawRectangle({ x: bx, y: by, width: 12, height: 12, color: gold })
  }

  // Top separator line
  page.drawRectangle({ x: 40, y: H - 96, width: W - 80, height: 2, color: gold })

  // CERTIFICATE OF COMPLETION
  const hdr = 'CERTIFICATE OF COMPLETION'
  page.drawText(hdr, { x: cx(hdr, tb, 27), y: H - 84, size: 27, font: tb, color: navy })

  // "This is to certify that"
  const sub = 'This is to certify that'
  page.drawText(sub, { x: cx(sub, ti, 16), y: H - 156, size: 16, font: ti, color: hx('#555555') })

  // Student name
  const name = fit(d.studentName, tb, 38, W - 120)
  page.drawText(name, { x: cx(name, tb, 38), y: H - 212, size: 38, font: tb, color: navy })

  // Underline
  const nw = tb.widthOfTextAtSize(name, 38)
  page.drawLine({ start: { x: (W - nw) / 2 - 12, y: H - 224 }, end: { x: (W + nw) / 2 + 12, y: H - 224 }, color: gold, thickness: 1.5 })

  // "has successfully completed"
  const comp = 'has successfully completed'
  page.drawText(comp, { x: cx(comp, ti, 16), y: H - 268, size: 16, font: ti, color: hx('#555555') })

  // Course name
  const course = fit(d.courseName, tb, 22, W - 120)
  page.drawText(course, { x: cx(course, tb, 22), y: H - 306, size: 22, font: tb, color: navy })

  // Custom message
  if (d.customMessage) {
    const msg = fit(d.customMessage, ti, 13, W - 120)
    page.drawText(msg, { x: cx(msg, ti, 13), y: H - 344, size: 13, font: ti, color: hx('#777777') })
  }

  // Creator
  const creator = `Presented by ${d.creatorName}`
  page.drawText(creator, { x: cx(creator, tr, 14), y: H - 378, size: 14, font: tr, color: hx('#444444') })

  // Course duration and hours (if available)
  if (d.courseDuration || d.totalHours) {
    const durationInfo = [d.courseDuration, d.totalHours].filter(Boolean).join(' · ')
    page.drawText(durationInfo, { x: cx(durationInfo, ti, 11), y: H - 358, size: 11, font: ti, color: hx('#666666') })
  }

  // Skills (if available)
  if (d.skills && d.skills.length > 0) {
    const skillsText = `Skills: ${d.skills.slice(0, 4).join(', ')}${d.skills.length > 4 ? '...' : ''}`
    page.drawText(skillsText, { x: cx(skillsText, ti, 10), y: H - 342, size: 10, font: ti, color: hx('#777777') })
  }

  // Bottom divider
  page.drawRectangle({ x: 40, y: 112, width: W - 80, height: 1.5, color: gold })

  // Date (left)
  page.drawText('Date of Completion', { x: 60, y: 94, size: 10, font: tb, color: navy })
  page.drawText(fmt(d.issuedAt),      { x: 60, y: 74, size: 13, font: tr, color: hx('#222222') })

  // Cert ID (right)
  page.drawText('Certificate ID',  { x: W - 210, y: 94, size: 10, font: tb, color: navy })
  page.drawText(d.certificateId,   { x: W - 210, y: 74, size: 13, font: tr, color: hx('#222222') })

  // AcademyKit centre branding
  const brand = 'Verified by AcademyKit'
  page.drawText(brand, { x: cx(brand, ti, 11), y: 74, size: 11, font: ti, color: gold })
}

// ─── Template 2: MODERN ──────────────────────────────────────────────────────
// Near-black bg · violet accent bars · Helvetica · clean layout
function drawModern(page: PDFPage, d: DrawData, bold: PDFFont, regular: PDFFont) {
  const bg     = hx('#0f0f1a')
  const violet = hx('#7c3aed')
  const lilac  = hx('#a78bfa')
  const muted  = hx('#9ca3af')
  const frame  = hx('#2d2d4e')

  // Dark background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg })

  // Left + right violet side bars
  page.drawRectangle({ x: 0,     y: 0, width: 8, height: H, color: violet })
  page.drawRectangle({ x: W - 8, y: 0, width: 8, height: H, color: violet })

  // Top + bottom violet bars
  page.drawRectangle({ x: 8, y: H - 6,  width: W - 16, height: 6, color: violet })
  page.drawRectangle({ x: 8, y: 0,       width: W - 16, height: 6, color: violet })

  // Inner subtle frame
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: frame, borderWidth: 1 })

  // CERTIFICATE OF COMPLETION
  const hdr = 'CERTIFICATE OF COMPLETION'
  page.drawText(hdr, { x: cx(hdr, bold, 21), y: H - 76, size: 21, font: bold, color: lilac })

  // Thin divider
  page.drawRectangle({ x: 120, y: H - 92, width: W - 240, height: 1, color: frame })

  // "THIS CERTIFIES THAT"
  const sub = 'THIS CERTIFIES THAT'
  page.drawText(sub, { x: cx(sub, regular, 11), y: H - 150, size: 11, font: regular, color: muted })

  // Student name
  const name = fit(d.studentName, bold, 40, W - 100)
  page.drawText(name, { x: cx(name, bold, 40), y: H - 208, size: 40, font: bold, color: rgb(1, 1, 1) })

  // Violet underline bar (centred, fixed width)
  page.drawRectangle({ x: (W - 140) / 2, y: H - 222, width: 140, height: 3, color: violet })

  // "HAS SUCCESSFULLY COMPLETED"
  const comp = 'HAS SUCCESSFULLY COMPLETED'
  page.drawText(comp, { x: cx(comp, regular, 11), y: H - 264, size: 11, font: regular, color: muted })

  // Course name
  const course = fit(d.courseName, bold, 24, W - 100)
  page.drawText(course, { x: cx(course, bold, 24), y: H - 304, size: 24, font: bold, color: lilac })

  // Custom message
  if (d.customMessage) {
    const msg = fit(d.customMessage, regular, 12, W - 100)
    page.drawText(msg, { x: cx(msg, regular, 12), y: H - 344, size: 12, font: regular, color: muted })
  }

  // Creator
  const creator = `Presented by ${d.creatorName}`
  page.drawText(creator, { x: cx(creator, regular, 13), y: H - 378, size: 13, font: regular, color: hx('#d1d5db') })

  // Course duration and hours (if available)
  if (d.courseDuration || d.totalHours) {
    const durationInfo = [d.courseDuration, d.totalHours].filter(Boolean).join(' · ')
    page.drawText(durationInfo, { x: cx(durationInfo, regular, 10), y: H - 358, size: 10, font: regular, color: muted })
  }

  // Skills (if available)
  if (d.skills && d.skills.length > 0) {
    const skillsText = `Skills: ${d.skills.slice(0, 4).join(', ')}${d.skills.length > 4 ? '...' : ''}`
    page.drawText(skillsText, { x: cx(skillsText, regular, 9), y: H - 342, size: 9, font: regular, color: muted })
  }

  // Bottom labels
  page.drawText('DATE',           { x: 60, y: 86, size: 9,  font: bold,    color: muted })
  page.drawText(fmt(d.issuedAt),  { x: 60, y: 68, size: 13, font: bold,    color: rgb(1, 1, 1) })
  page.drawText('CERTIFICATE ID', { x: W - 230, y: 86, size: 9,  font: bold, color: muted })
  page.drawText(d.certificateId,  { x: W - 230, y: 68, size: 13, font: bold, color: rgb(1, 1, 1) })

  const brand = 'academykit.in'
  page.drawText(brand, { x: cx(brand, regular, 11), y: 68, size: 11, font: regular, color: violet })
}

// ─── Template 3: GOLD ────────────────────────────────────────────────────────
// Ivory bg · ornate gold double border · Times-Roman · warm palette
function drawGold(page: PDFPage, d: DrawData, tb: PDFFont, tr: PDFFont, ti: PDFFont) {
  const cream = hx('#fdf8ed')
  const gold  = hx('#c9a227')
  const dkGld = hx('#8b6914')
  const brown = hx('#3d2b1f')

  // Cream background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: cream })

  // Thick gold outer border
  page.drawRectangle({ x: 12, y: 12, width: W - 24, height: H - 24, borderColor: gold,  borderWidth: 4 })
  // Medium inner
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: dkGld, borderWidth: 1.5 })
  // Hair line innermost
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: gold,  borderWidth: 0.5 })

  // Corner accent diamonds (small rotated squares approximated as small rects)
  for (const [bx, by] of [[28, H - 46], [W - 44, H - 46], [28, 34], [W - 44, 34]] as [number, number][]) {
    page.drawRectangle({ x: bx,     y: by,     width: 16, height: 2, color: gold })
    page.drawRectangle({ x: bx + 7, y: by - 7, width: 2,  height: 16, color: gold })
  }

  // Top separator
  page.drawRectangle({ x: 40, y: H - 94,  width: W - 80, height: 2.5, color: gold })
  page.drawRectangle({ x: 40, y: H - 100, width: W - 80, height: 0.8, color: dkGld })

  // CERTIFICATE OF COMPLETION
  const hdr = 'CERTIFICATE OF COMPLETION'
  page.drawText(hdr, { x: cx(hdr, tb, 26), y: H - 82, size: 26, font: tb, color: dkGld })

  // Subtitle
  const sub = '~ This is to certify that ~'
  page.drawText(sub, { x: cx(sub, ti, 15), y: H - 154, size: 15, font: ti, color: gold })

  // Student name
  const name = fit(d.studentName, tb, 38, W - 120)
  page.drawText(name, { x: cx(name, tb, 38), y: H - 210, size: 38, font: tb, color: brown })

  // Double underline
  const nw = tb.widthOfTextAtSize(name, 38)
  page.drawLine({ start: { x: (W - nw) / 2 - 20, y: H - 222 }, end: { x: (W + nw) / 2 + 20, y: H - 222 }, color: gold,  thickness: 1.2 })
  page.drawLine({ start: { x: (W - nw) / 2 - 6,  y: H - 226 }, end: { x: (W + nw) / 2 + 6,  y: H - 226 }, color: dkGld, thickness: 0.5 })

  // "has successfully completed the course"
  const comp = 'has successfully completed the course'
  page.drawText(comp, { x: cx(comp, ti, 15), y: H - 268, size: 15, font: ti, color: hx('#666666') })

  // Course name
  const course = fit(d.courseName, tb, 22, W - 120)
  page.drawText(course, { x: cx(course, tb, 22), y: H - 306, size: 22, font: tb, color: dkGld })

  // Custom message
  if (d.customMessage) {
    const msg = fit(d.customMessage, ti, 13, W - 120)
    page.drawText(msg, { x: cx(msg, ti, 13), y: H - 344, size: 13, font: ti, color: hx('#777777') })
  }

  // Creator
  const creator = `Awarded by ${d.creatorName}`
  page.drawText(creator, { x: cx(creator, tr, 14), y: H - 378, size: 14, font: tr, color: brown })

  // Course duration and hours (if available)
  if (d.courseDuration || d.totalHours) {
    const durationInfo = [d.courseDuration, d.totalHours].filter(Boolean).join(' · ')
    page.drawText(durationInfo, { x: cx(durationInfo, ti, 11), y: H - 358, size: 11, font: ti, color: hx('#666666') })
  }

  // Skills (if available)
  if (d.skills && d.skills.length > 0) {
    const skillsText = `Skills: ${d.skills.slice(0, 4).join(', ')}${d.skills.length > 4 ? '...' : ''}`
    page.drawText(skillsText, { x: cx(skillsText, ti, 10), y: H - 342, size: 10, font: ti, color: hx('#777777') })
  }

  // Bottom dividers
  page.drawRectangle({ x: 40, y: 112, width: W - 80, height: 1.5, color: gold })
  page.drawRectangle({ x: 40, y: 108, width: W - 80, height: 0.5, color: dkGld })

  // Date
  page.drawText('Date of Award',  { x: 60, y: 93, size: 10, font: tb, color: dkGld })
  page.drawText(fmt(d.issuedAt),  { x: 60, y: 73, size: 13, font: tr, color: brown })

  // Cert ID
  page.drawText('Certificate Number', { x: W - 220, y: 93, size: 10, font: tb, color: dkGld })
  page.drawText(d.certificateId,      { x: W - 220, y: 73, size: 13, font: tr, color: brown })

  // Centre branding
  const brand = '— AcademyKit —'
  page.drawText(brand, { x: cx(brand, ti, 12), y: 73, size: 12, font: ti, color: gold })
}

// ─── Template 4: MINIMAL ─────────────────────────────────────────────────────
// Pure white · left-aligned layout · single violet top bar · Helvetica
function drawMinimal(page: PDFPage, d: DrawData, bold: PDFFont, regular: PDFFont) {
  const violet = hx('#7c3aed')
  const mid    = hx('#6b7280')
  const faint  = hx('#e5e7eb')

  // White background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })

  // Top violet strip
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: violet })

  // Left edge accent
  page.drawRectangle({ x: 0, y: 0, width: 4, height: H - 8, color: violet })

  // CERTIFICATE label (small, left)
  page.drawText('CERTIFICATE OF COMPLETION', { x: 60, y: H - 58, size: 12, font: bold, color: violet })

  // Big student name (left-aligned)
  const name = fit(d.studentName, bold, 44, W - 120)
  page.drawText(name, { x: 60, y: H - 148, size: 44, font: bold, color: rgb(0, 0, 0) })

  // Accent rule under name
  page.drawRectangle({ x: 60, y: H - 163, width: 240, height: 2, color: violet })

  // "has successfully completed" (left)
  page.drawText('has successfully completed', { x: 60, y: H - 202, size: 14, font: regular, color: mid })

  // Course name (left)
  const course = fit(d.courseName, bold, 22, W - 120)
  page.drawText(course, { x: 60, y: H - 240, size: 22, font: bold, color: rgb(0, 0, 0) })

  // Custom message
  if (d.customMessage) {
    const msg = fit(d.customMessage, regular, 12, W - 120)
    page.drawText(msg, { x: 60, y: H - 278, size: 12, font: regular, color: mid })
  }

  // Creator
  page.drawText(`by ${d.creatorName}`, { x: 60, y: H - 310, size: 14, font: regular, color: mid })

  // Course duration and hours (if available)
  if (d.courseDuration || d.totalHours) {
    const durationInfo = [d.courseDuration, d.totalHours].filter(Boolean).join(' · ')
    page.drawText(durationInfo, { x: 60, y: H - 290, size: 11, font: regular, color: mid })
  }

  // Skills (if available)
  if (d.skills && d.skills.length > 0) {
    const skillsText = `Skills: ${d.skills.slice(0, 4).join(', ')}${d.skills.length > 4 ? '...' : ''}`
    page.drawText(skillsText, { x: 60, y: H - 274, size: 10, font: regular, color: mid })
  }

  // Bottom hairline
  page.drawRectangle({ x: 60, y: 104, width: W - 120, height: 0.8, color: faint })

  // Date (left)
  page.drawText('Date',           { x: 60, y: 88, size: 9,  font: bold,    color: mid })
  page.drawText(fmt(d.issuedAt),  { x: 60, y: 70, size: 13, font: regular, color: rgb(0, 0, 0) })

  // Cert ID (right)
  page.drawText('Certificate ID', { x: W - 220, y: 88, size: 9,  font: bold,    color: mid })
  page.drawText(d.certificateId,  { x: W - 220, y: 70, size: 13, font: regular, color: rgb(0, 0, 0) })

  // Centre branding
  const brand = 'AcademyKit'
  page.drawText(brand, { x: cx(brand, bold, 12), y: 70, size: 12, font: bold, color: violet })
}

// ─── Template 5: ROYAL ───────────────────────────────────────────────────────
// Deep navy bg · gold borders · Times-Roman · premium feel
function drawRoyal(page: PDFPage, d: DrawData, tb: PDFFont, tr: PDFFont, ti: PDFFont) {
  const navy   = hx('#060d2e')
  const gold   = hx('#d4af37')
  const ltGold = hx('#f0d060')
  const dkGld  = hx('#8b6914')
  const muted  = hx('#9ca3af')

  // Navy background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: navy })

  // Outer gold border
  page.drawRectangle({ x: 14, y: 14, width: W - 28, height: H - 28, borderColor: gold,  borderWidth: 2.5 })
  // Inner hair
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: dkGld, borderWidth: 0.5 })

  // Corner cross ornaments (two perpendicular rects)
  for (const [bx, by] of [[28, H - 46], [W - 48, H - 46], [28, 32], [W - 48, 32]] as [number, number][]) {
    page.drawRectangle({ x: bx,     y: by + 5,  width: 20, height: 2, color: gold })
    page.drawRectangle({ x: bx + 9, y: by,       width: 2,  height: 12, color: gold })
  }

  // Small ACADEMYKIT label at very top
  const ak = 'ACADEMYKIT'
  page.drawText(ak, { x: cx(ak, tb, 11), y: H - 52, size: 11, font: tb, color: gold })

  // Top gold divider
  page.drawRectangle({ x: 36, y: H - 96, width: W - 72, height: 1.5, color: gold })

  // CERTIFICATE OF COMPLETION
  const hdr = 'CERTIFICATE OF COMPLETION'
  page.drawText(hdr, { x: cx(hdr, tb, 25), y: H - 84, size: 25, font: tb, color: ltGold })

  // "This is to proudly certify that"
  const sub = 'This is to proudly certify that'
  page.drawText(sub, { x: cx(sub, ti, 15), y: H - 154, size: 15, font: ti, color: muted })

  // Student name
  const name = fit(d.studentName, tb, 38, W - 120)
  page.drawText(name, { x: cx(name, tb, 38), y: H - 210, size: 38, font: tb, color: ltGold })

  // Double underline
  const nw = tb.widthOfTextAtSize(name, 38)
  page.drawLine({ start: { x: (W - nw) / 2 - 14, y: H - 223 }, end: { x: (W + nw) / 2 + 14, y: H - 223 }, color: gold,  thickness: 1.5 })
  page.drawLine({ start: { x: (W - nw) / 2 - 4,  y: H - 228 }, end: { x: (W + nw) / 2 + 4,  y: H - 228 }, color: dkGld, thickness: 0.5 })

  // "has successfully completed"
  const comp = 'has successfully completed'
  page.drawText(comp, { x: cx(comp, ti, 15), y: H - 268, size: 15, font: ti, color: muted })

  // Course name
  const course = fit(d.courseName, tb, 22, W - 120)
  page.drawText(course, { x: cx(course, tb, 22), y: H - 306, size: 22, font: tb, color: gold })

  // Custom message
  if (d.customMessage) {
    const msg = fit(d.customMessage, ti, 13, W - 120)
    page.drawText(msg, { x: cx(msg, ti, 13), y: H - 344, size: 13, font: ti, color: muted })
  }

  // Creator
  const creator = `Presented by ${d.creatorName}`
  page.drawText(creator, { x: cx(creator, tr, 14), y: H - 378, size: 14, font: tr, color: rgb(1, 1, 1) })

  // Course duration and hours (if available)
  if (d.courseDuration || d.totalHours) {
    const durationInfo = [d.courseDuration, d.totalHours].filter(Boolean).join(' · ')
    page.drawText(durationInfo, { x: cx(durationInfo, ti, 11), y: H - 358, size: 11, font: ti, color: muted })
  }

  // Skills (if available)
  if (d.skills && d.skills.length > 0) {
    const skillsText = `Skills: ${d.skills.slice(0, 4).join(', ')}${d.skills.length > 4 ? '...' : ''}`
    page.drawText(skillsText, { x: cx(skillsText, ti, 10), y: H - 342, size: 10, font: ti, color: muted })
  }

  // Bottom divider
  page.drawRectangle({ x: 36, y: 112, width: W - 72, height: 1.5, color: gold })

  // Date
  page.drawText('Date of Completion', { x: 60, y: 93, size: 10, font: tb, color: gold })
  page.drawText(fmt(d.issuedAt),      { x: 60, y: 73, size: 13, font: tr, color: rgb(1, 1, 1) })

  // Cert ID
  page.drawText('Certificate ID', { x: W - 208, y: 93, size: 10, font: tb, color: gold })
  page.drawText(d.certificateId,  { x: W - 208, y: 73, size: 13, font: tr, color: rgb(1, 1, 1) })

  // Centre branding
  const brand = '~ Verified by AcademyKit ~'
  page.drawText(brand, { x: cx(brand, ti, 11), y: 73, size: 11, font: ti, color: gold })
}

// ─── Main: generate PDF bytes ─────────────────────────────────────────────────

export async function generateCertificatePDF(data: {
  studentName:   string
  courseName:    string
  creatorName:   string
  certificateId: string
  issuedAt:      Date
  template:      CertTemplate
  customMessage?: string
  courseDuration?: string
  totalHours?: string
  instructorName?: string
  instructorTitle?: string
  skills?: string[]
  verificationUrl?: string
}): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([W, H])

  // Embed all fonts upfront (only used fonts matter for file size)
  const bold         = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular      = await doc.embedFont(StandardFonts.Helvetica)
  const timesBold    = await doc.embedFont(StandardFonts.TimesRomanBold)
  const timesRegular = await doc.embedFont(StandardFonts.TimesRoman)
  const timesItalic  = await doc.embedFont(StandardFonts.TimesRomanItalic)

  switch (data.template) {
    case 'modern':  drawModern(page, data, bold, regular); break
    case 'gold':    drawGold  (page, data, timesBold, timesRegular, timesItalic); break
    case 'minimal': drawMinimal(page, data, bold, regular); break
    case 'royal':   drawRoyal (page, data, timesBold, timesRegular, timesItalic); break
    default:        drawClassic(page, data, timesBold, timesRegular, timesItalic); break
  }

  return doc.save()
}

// ─── Main: issue (generate + store + record) ──────────────────────────────────

export async function issueCertificate(
  supabase: SupabaseClient,
  params: {
    enrollmentId:  string
    courseId:      string
    studentId:     string | null
    studentName:   string
    courseName:    string
    creatorName:   string
    template:      CertTemplate
    customMessage?: string
    courseDuration?: string
    totalHours?: string
    instructorName?: string
    instructorTitle?: string
    skills?: string[]
  },
): Promise<{ certificateId: string; pdfUrl: string }> {

  // ── Idempotent: return if already issued with same name ────────────────────
  const { data: existing } = await supabase
    .from('certificates')
    .select('certificate_id, pdf_url, student_name')
    .eq('enrollment_id', params.enrollmentId)
    .maybeSingle()

  // Only return existing if student name matches - otherwise regenerate
  if (existing?.certificate_id && existing.student_name === params.studentName) {
    return { certificateId: existing.certificate_id, pdfUrl: existing.pdf_url }
  }

  // ── Generate unique certificate ID (reuse existing if name changed) ─────────
  const certId = existing?.certificate_id || `AK-${new Date().getFullYear()}-${Math.floor(Math.random() * 100_000_000).toString().padStart(8, '0')}`
  const issuedAt = new Date()

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const pdfBytes = await generateCertificatePDF({
    studentName:   params.studentName,
    courseName:    params.courseName,
    creatorName:   params.creatorName,
    certificateId: certId,
    issuedAt,
    template:      params.template,
    customMessage: params.customMessage,
    courseDuration: params.courseDuration,
    totalHours: params.totalHours,
    instructorName: params.instructorName,
    instructorTitle: params.instructorTitle,
    skills: params.skills,
    verificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://academykit.in'}/certificate/${certId}`,
  })

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const storagePath = `${params.courseId}/${params.studentId ?? params.enrollmentId}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('certificates')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) throw new Error(`Certificate upload failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('certificates')
    .getPublicUrl(storagePath)

  // ── Insert or update certificates table ────────────────────────────────────
  if (existing?.certificate_id) {
    // Update existing record
    const { error: updateError } = await supabase.from('certificates').update({
      student_name:   params.studentName,
      issued_at:      issuedAt.toISOString(),
      pdf_url:        publicUrl,
    }).eq('certificate_id', existing.certificate_id)
    if (updateError) throw new Error(`Certificate update failed: ${updateError.message}`)
  } else {
    // Insert new record
    const { error: insertError } = await supabase.from('certificates').insert({
      enrollment_id:  params.enrollmentId,
      course_id:      params.courseId,
      student_id:     params.studentId,
      certificate_id: certId,
      student_name:   params.studentName,
      course_name:    params.courseName,
      creator_name:   params.creatorName,
      issued_at:      issuedAt.toISOString(),
      pdf_url:        publicUrl,
    })
    if (insertError) throw new Error(`Certificate record failed: ${insertError.message}`)
  }

  // ── Update enrollment row ─────────────────────────────────────────────────
  await supabase.from('enrollments').update({
    certificate_id:        certId,
    certificate_issued_at: issuedAt.toISOString(),
    certificate_url:       publicUrl,
  }).eq('id', params.enrollmentId)

  return { certificateId: certId, pdfUrl: publicUrl }
}

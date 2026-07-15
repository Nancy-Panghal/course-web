import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface InvoiceData {
  invoiceNumber: string
  createdAt: string
  creatorName: string
  creatorBusinessAddress: string | null
  creatorGstin: string | null
  studentName: string
  studentEmail: string | null
  courseName: string
  amount: number
  discountAmount: number
  paymentStatus: string // 'paid' | 'refunded' | 'partially_refunded'
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4 portrait

  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const isTaxInvoice = !!data.creatorGstin
  const netAmount = data.amount - (data.discountAmount || 0)

  // Header (right aligned)
  page.drawText(isTaxInvoice ? 'TAX INVOICE' : 'INVOICE', { x: 350, y: 780, size: 18, font: helveticaBold, color: rgb(0, 0, 0) })
  page.drawText(`Invoice #: ${data.invoiceNumber}`, { x: 350, y: 764, size: 10, font: helvetica, color: rgb(0.33, 0.33, 0.33) })
  page.drawText(new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), { x: 350, y: 750, size: 10, font: helvetica, color: rgb(0.33, 0.33, 0.33) })

  // Seller
  let y = 710
  page.drawText(data.creatorName, { x: 50, y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) })
  y -= 16
  if (data.creatorBusinessAddress) {
    page.drawText(data.creatorBusinessAddress, { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
    y -= 12
  }
  if (data.creatorGstin) {
    page.drawText(`GSTIN: ${data.creatorGstin}`, { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
    y -= 16
  }

  // Buyer
  y -= 8
  page.drawText('Billed to:', { x: 50, y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) })
  y -= 14
  page.drawText(data.studentName || 'Student', { x: 50, y, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) })
  if (data.studentEmail) page.drawText(data.studentEmail, { x: 50, y: y - 12, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) })

  // Table header
  const tableTop = 520
  page.drawText('Description', { x: 50, y: tableTop + 20, size: 10, font: helveticaBold })
  page.drawText('Amount', { x: 450, y: tableTop + 20, size: 10, font: helveticaBold })

  // Line item
  page.drawText(data.courseName, { x: 50, y: tableTop - 2, size: 10, font: helvetica })
  page.drawText(`Rs. ${(data.amount + (data.discountAmount || 0)).toLocaleString('en-IN')}`, { x: 450, y: tableTop - 2, size: 10, font: helvetica })

  let currentY = tableTop - 28
  if (data.discountAmount > 0) {
    page.drawText('Discount', { x: 50, y: currentY, size: 10, font: helvetica, color: rgb(0.33, 0.33, 0.33) })
    page.drawText(`- Rs. ${data.discountAmount.toLocaleString('en-IN')}`, { x: 450, y: currentY, size: 10, font: helvetica, color: rgb(0.33, 0.33, 0.33) })
    currentY -= 20
  }

  // Total
  page.drawText('Total', { x: 350, y: currentY - 6, size: 11, font: helveticaBold })
  page.drawText(`Rs. ${netAmount.toLocaleString('en-IN')}`, { x: 450, y: currentY - 6, size: 11, font: helveticaBold })

  if (data.paymentStatus === 'refunded') {
    page.drawText('This payment was fully refunded.', { x: 50, y: currentY - 40, size: 11, font: helveticaBold, color: rgb(0.75, 0.09, 0.16) })
  } else if (data.paymentStatus === 'partially_refunded') {
    page.drawText('This payment was partially refunded.', { x: 50, y: currentY - 40, size: 11, font: helveticaBold, color: rgb(0.75, 0.09, 0.16) })
  }

  // Footer
  page.drawText(`This invoice is issued by ${data.creatorName}. Kurso is the technology platform used to process this payment and is not the seller of this course.`, { x: 50, y: 40, size: 8, font: helvetica, color: rgb(0.55, 0.55, 0.55) })

  return doc.save()
}
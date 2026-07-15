import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface KursoInvoiceData {
  invoiceNumber: string
  createdAt: string
  creatorName: string
  creatorEmail: string | null
  planName: string
  amount: number
}

export async function generateKursoInvoicePdf(data: KursoInvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])

  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)

  page.drawText('INVOICE', { x: 350, y: 780, size: 18, font: helveticaBold })
  page.drawText(`Invoice #: ${data.invoiceNumber}`, { x: 350, y: 764, size: 10, font: helvetica, color: rgb(0.33,0.33,0.33) })
  page.drawText(new Date(data.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), { x: 350, y: 750, size: 10, font: helvetica, color: rgb(0.33,0.33,0.33) })

  let y = 710
  page.drawText('Kurso', { x: 50, y, size: 12, font: helveticaBold })
  y -= 16
  page.drawText('Course delivery platform for Telegram & WhatsApp', { x: 50, y, size: 10, font: helvetica, color: rgb(0.2,0.2,0.2) })

  y -= 28
  page.drawText('Billed to:', { x: 50, y, size: 10, font: helveticaBold })
  y -= 14
  page.drawText(data.creatorName, { x: 50, y, size: 10, font: helvetica })
  if (data.creatorEmail) page.drawText(data.creatorEmail, { x: 50, y: y - 12, size: 10, font: helvetica })

  const tableTop = 520
  page.drawText('Description', { x: 50, y: tableTop + 20, size: 10, font: helveticaBold })
  page.drawText('Amount', { x: 450, y: tableTop + 20, size: 10, font: helveticaBold })

  page.drawText(`Kurso ${data.planName} plan — monthly subscription`, { x: 50, y: tableTop - 2, size: 10, font: helvetica })
  page.drawText(`Rs. ${data.amount.toLocaleString('en-IN')}`, { x: 450, y: tableTop - 2, size: 10, font: helvetica })

  page.drawText('Total', { x: 350, y: tableTop - 48, size: 11, font: helveticaBold })
  page.drawText(`Rs. ${data.amount.toLocaleString('en-IN')}`, { x: 450, y: tableTop - 48, size: 11, font: helveticaBold })

  page.drawText('This invoice is issued by Kurso for platform subscription services.', { x: 50, y: 40, size: 8, font: helvetica, color: rgb(0.55,0.55,0.55) })

  return doc.save()
}
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function stampEbookPdf(sourceBytes: Uint8Array, opts: { buyerName: string; buyerEmail: string; orderId: string }): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const stamp = `Licensed to ${opts.buyerName} (${opts.buyerEmail}) · Order ${opts.orderId} · Do not redistribute`

  for (const page of pdfDoc.getPages()) {
    page.drawText(stamp, { x: 24, y: 14, size: 7, font, color: rgb(0.6, 0.6, 0.6), opacity: 0.75 })
  }

  return pdfDoc.save()
}
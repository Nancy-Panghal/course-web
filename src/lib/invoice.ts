import { SupabaseClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

export async function getOrCreateInvoice(supabase: SupabaseClient, paymentId: string) {
  const existing = await supabase.from('invoices').select('*').eq('payment_id', paymentId).maybeSingle().then(r => r.data)
  if (existing) return existing

  const { data: payment } = await supabase
    .from('payments')
    .select('id, enrollment_id, creator_id, course_id, ebook_id, product_type, gross_amount, discount_amount, net_amount, buyer_name, buyer_email')
    .eq('id', paymentId)
    .maybeSingle()
  if (!payment) throw new Error('Payment not found for invoice generation')

  let itemName = 'Course'
  if (payment.product_type === 'ebook') {
    const { data: ebook } = await supabase.from('ebooks').select('title').eq('id', payment.ebook_id).maybeSingle()
    itemName = ebook?.title || 'Ebook'
  } else {
    const { data: course } = await supabase.from('courses').select('name').eq('id', payment.course_id).maybeSingle()
    itemName = course?.name || 'Course'
  }

  const { data: creator } = await supabase.from('creators').select('id, creator_gstin').eq('id', payment.creator_id).maybeSingle()

  const { data: seqResult, error: seqError } = await supabase.rpc('next_invoice_sequence', { p_creator_id: payment.creator_id })
  if (seqError) throw seqError

  const invoiceNumber = `INV-${String(seqResult).padStart(4, '0')}`

  const { data: inserted, error: insertError } = await supabase
    .from('invoices')
    .insert({
      creator_id: payment.creator_id,
      payment_id: payment.id,
      enrollment_id: payment.enrollment_id || null,
      product_type: payment.product_type || 'course',
      ebook_id: payment.ebook_id || null,
      invoice_number: invoiceNumber,
      invoice_sequence_num: seqResult,
      student_name: payment.buyer_name || 'Student',
      student_email: payment.buyer_email || null,
      course_name: itemName,
      amount: payment.net_amount,
      discount_amount: payment.discount_amount || 0,
      gstin_shown: creator?.creator_gstin || null,
    })
    .select('*')
    .single()
  if (insertError) throw insertError
  return inserted
}

export async function generateInvoicePdfForPayment(supabase: SupabaseClient, paymentId: string) {
  const invoiceRow = await getOrCreateInvoice(supabase, paymentId)
  const { data: creator } = await supabase
    .from('creators')
    .select('name, creator_business_address, creator_gstin')
    .eq('id', invoiceRow.creator_id)
    .maybeSingle()

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber: invoiceRow.invoice_number,
    createdAt: invoiceRow.created_at,
    creatorName: creator?.name,
    creatorBusinessAddress: creator?.creator_business_address,
    creatorGstin: creator?.creator_gstin,
    studentName: invoiceRow.student_name,
    studentEmail: invoiceRow.student_email,
    courseName: invoiceRow.course_name,
    amount: invoiceRow.amount,
    discountAmount: invoiceRow.discount_amount,
    paymentStatus: 'paid',
  })
  return { invoiceRow, pdfBuffer }
}
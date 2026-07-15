import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })

    // Resolve the student row for the logged-in user, then confirm this
    // enrollment actually belongs to them — never trust enrollmentId alone.
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, phone, email, name')
      .eq('auth_id', authData.user.id)
      .maybeSingle()

    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('id, student_id, phone, course_uuid, creator_id, amount_paid')
      .eq('id', enrollmentId)
      .maybeSingle()

    if (enrollError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const belongsToUser =
      (studentRow && enrollment.student_id === studentRow.id) ||
      (authData.user.email && enrollment.phone === authData.user.email) ||
      (studentRow?.phone && enrollment.phone === studentRow.phone)

    if (!belongsToUser) {
      return NextResponse.json({ error: 'You do not have access to this invoice.' }, { status: 403 })
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('id, gross_amount, discount_amount, net_amount, status, buyer_name, buyer_email')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'No payment record found for this course.' }, { status: 404 })
    }

    const { data: course } = await supabase
      .from('courses')
      .select('name, creator_id')
      .eq('id', enrollment.course_uuid)
      .maybeSingle()

    const { data: creator } = await supabase
      .from('creators')
      .select('id, name, creator_gstin, creator_business_address, invoice_sequence')
      .eq('id', enrollment.creator_id)
      .maybeSingle()

    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    // Reuse an existing invoice if this payment already has one (idempotent —
    // clicking "Download" twice must not burn two sequence numbers).
    let invoiceRow = await supabase
      .from('invoices')
      .select('*')
      .eq('payment_id', payment.id)
      .maybeSingle()
      .then((r) => r.data)

    if (!invoiceRow) {
      const { data: seqResult, error: seqError } = await supabase.rpc('next_invoice_sequence', {
        p_creator_id: creator.id,
      })
      if (seqError) throw seqError

      const invoiceNumber = `INV-${String(seqResult).padStart(4, '0')}`

      const { data: inserted, error: insertError } = await supabase
        .from('invoices')
        .insert({
          creator_id: creator.id,
          payment_id: payment.id,
          enrollment_id: enrollment.id,
          invoice_number: invoiceNumber,
          invoice_sequence_num: seqResult,
          student_name: payment.buyer_name || studentRow?.name || 'Student',
          student_email: payment.buyer_email || studentRow?.email || null,
          course_name: course?.name || 'Course',
          amount: payment.net_amount,
          discount_amount: payment.discount_amount || 0,
          gstin_shown: creator.creator_gstin || null,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      invoiceRow = inserted
    }

    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoiceRow.invoice_number,
      createdAt: invoiceRow.created_at,
      creatorName: creator.name,
      creatorBusinessAddress: creator.creator_business_address,
      creatorGstin: creator.creator_gstin,
      studentName: invoiceRow.student_name,
      studentEmail: invoiceRow.student_email,
      courseName: invoiceRow.course_name,
      amount: invoiceRow.amount,
      discountAmount: invoiceRow.discount_amount,
      paymentStatus: payment.status,
    })

    // `generateInvoicePdf` returns a Uint8Array (BodyInit compatible).
    // Cast to BodyInit to satisfy TypeScript's union checks in this environment.
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceRow.invoice_number}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('[student/invoice]', err)
    return NextResponse.json({ error: 'Could not generate invoice. Please try again.' }, { status: 500 })
  }
}
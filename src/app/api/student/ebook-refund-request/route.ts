import { NextRequest, NextResponse } from 'next/server'
import { checkEbookRefundEligibility, createEbookRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

export async function GET(req: NextRequest) {
  try {
    const purchaseId = req.nextUrl.searchParams.get('purchaseId')
    if (!purchaseId) return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 })
    const result = await checkEbookRefundEligibility(purchaseId)
    return NextResponse.json(result)
  } catch (err: any) {
    return friendlyErrorResponse(err, 'student/ebook-refund-request GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { purchaseId, reason } = await req.json()
    if (!purchaseId) return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 })
    const result = await createEbookRefundRequest({ purchaseId, reason })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'student/ebook-refund-request POST')
  }
}
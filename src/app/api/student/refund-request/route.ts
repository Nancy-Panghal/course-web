import { NextRequest, NextResponse } from 'next/server'
import { checkCourseRefundEligibility, createCourseRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

export async function GET(req: NextRequest) {
  try {
    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })
    const result = await checkCourseRefundEligibility(enrollmentId)
    return NextResponse.json(result)
  } catch (err: any) {
    return friendlyErrorResponse(err, 'student/refund-request GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { enrollmentId, reason } = await req.json()
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })
    const result = await createCourseRefundRequest({ enrollmentId, reason })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'student/refund-request POST')
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { createSubscriptionRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

export async function POST(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { reason } = await req.json().catch(() => ({ reason: undefined }))
    const result = await createSubscriptionRefundRequest({ creatorId: creator.id, reason })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/subscription-refund-request POST')
  }
}
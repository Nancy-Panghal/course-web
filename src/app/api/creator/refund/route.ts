import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { initiateRefund } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { enrollmentId } = await req.json()
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })

    const result = await initiateRefund({ enrollmentId, requireCreatorId: data.user.id, initiatedBy: 'creator' })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund POST')
  }
}
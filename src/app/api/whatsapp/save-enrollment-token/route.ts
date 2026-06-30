import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { enrollmentId, token, expiresAt } = await req.json()

    if (!enrollmentId || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error, data, count } = await supabase
      .from('enrollments')
      .update({
        whatsapp_start_token: token,
        whatsapp_start_token_expires_at:
          expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', enrollmentId)
      .select('id')

    if (error) {
      console.error('[save-enrollment-token:whatsapp] update failed for enrollmentId', enrollmentId, error.message)
      throw error
    }
    if (!data || data.length === 0) {
      // The update ran but matched zero rows — wrong/stale enrollmentId.
      console.error('[save-enrollment-token:whatsapp] no enrollment row matched id', enrollmentId, '— token was NOT saved')
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
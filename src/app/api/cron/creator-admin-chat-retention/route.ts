/**
 * src/app/api/cron/creator-admin-chat-retention/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Daily job: hard-deletes any creator_admin_messages row older than
 * 14 days. Follows the same pattern as the other cron routes in this
 * folder (Bearer CRON_SECRET check). Register it in vercel.json (see
 * below) so Vercel actually calls it once a day.
 * ─────────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RETENTION_DAYS = 14

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { error, count } = await supabase
      .from('creator_admin_messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)

    if (error) {
      console.error('[cron/creator-admin-chat-retention]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: count ?? 0 })
  } catch (err: any) {
    console.error('[cron/creator-admin-chat-retention]', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
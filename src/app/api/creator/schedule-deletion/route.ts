import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('creators')
      .update({ scheduled_deletion_at: deletionDate })
      .eq('id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true, deletionDate })
  } catch (err: any) {
    console.error('[schedule-deletion]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to schedule deletion' },
      { status: 500 }
    )
  }
}
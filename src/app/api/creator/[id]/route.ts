import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params

    if (!id) {
      return NextResponse.json({ error: 'Missing creator ID' }, { status: 400 })
    }

    const { data: creator, error } = await supabase
      .from('creators')
      .select('id, name, telegram_bot_username')
      .eq('id', id)
      .limit(1)
      .single()

    if (error || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    return NextResponse.json(creator)
  } catch (err: any) {
    console.error('[api/creator/[id]] error:', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

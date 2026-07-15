/**
 * Public endpoint — called directly from the lesson page's inline script
 * (no login session exists there; the signed lesson link is the only
 * proof of identity a student has at that point).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePhone(raw: string): string {
  return String(raw).replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { identity, channel } = await req.json()
    if (!identity || !['whatsapp', 'telegram', 'none'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const phone = normalizePhone(identity)
    const { error } = await supabase
      .from('students')
      .update({ reminder_channel: channel })
      .eq('phone', phone)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reminder-preference]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
/**
 * GET /api/certificate/[id]
 * ─────────────────────────────────────────────────────────────────────────────
 * Public, no-auth required.
 * Returns certificate metadata for the public verification page (Step 4).
 * Anyone with a certificate ID can verify it's real.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params
    const certificateId = id?.trim()

    if (!certificateId) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    const { data: cert, error } = await supabase
      .from('certificates')
      .select('certificate_id, student_name, course_name, creator_name, issued_at, pdf_url')
      .eq('certificate_id', certificateId)
      .maybeSingle()

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    return NextResponse.json(cert)

  } catch (err: any) {
    console.error('[certificate/get]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  feedback: 'General Feedback',
  feature_request: 'Feature Request',
  bug: 'Bug Report',
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Both tables are read-only here — this just renders what /contact and
    // /feedback already write. No new columns, no "mark as read" state.
    const [{ data: contactRows, error: contactError }, { data: feedbackRows, error: feedbackError }] = await Promise.all([
      supabase.from('contact').select('id, name, email, subject, type, message, created_at').order('created_at', { ascending: false }),
      supabase.from('feedback').select('id, email, type, message, created_at').order('created_at', { ascending: false }),
    ])
    if (contactError) throw contactError
    if (feedbackError) throw feedbackError

    const messages = [
      ...(contactRows || []).map((r) => ({
        id: r.id,
        source: 'contact' as const,
        name: r.name as string | null,
        email: r.email as string,
        label: (r.subject as string) || (r.type as string) || 'Other',
        message: r.message as string,
        createdAt: r.created_at as string,
      })),
      ...(feedbackRows || []).map((r) => ({
        id: r.id,
        source: 'feedback' as const,
        name: null as string | null,
        email: r.email as string,
        label: FEEDBACK_TYPE_LABELS[r.type as string] || (r.type as string) || 'Feedback',
        message: r.message as string,
        createdAt: r.created_at as string,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ messages })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/messages GET')
  }
}
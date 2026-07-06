import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('creators')
      .select('id, name, payout_account_status, payout_account_holder')
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ creators: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/creators GET')
  }
}
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthenticatedCreator(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return { creator: null, error: 'Please log in before upgrading.' }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  const user = authData?.user

  if (authError || !user) {
    return { creator: null, error: 'Your session expired. Please log in again.' }
  }

  const { data: creator, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('id, email, name, plan')
    .eq('id', user.id)
    .single()

  if (creatorError || !creator) {
    return { creator: null, error: 'Creator profile not found.' }
  }

  return { creator, error: null }
}

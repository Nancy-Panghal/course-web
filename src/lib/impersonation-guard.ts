import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * True if an admin is currently impersonating this creator. This is the
 * hard gate on money-movement and account-deletion routes — they must stay
 * blocked even though impersonation carries a fully real, valid Supabase
 * session for the creator (see /api/admin/impersonate/[creatorId] for why
 * a real session is used instead of a custom token). Checked server-side
 * against live state, never against anything the client sends, so it
 * can't be bypassed by omitting a header.
 */
export async function isImpersonationActive(creatorId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('admin_impersonation_sessions')
    .select('id')
    .eq('creator_id', creatorId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)

  if (error) {
    console.error('[isImpersonationActive]', error.message)
    // Fail closed: if we can't confirm impersonation is NOT active, block
    // the sensitive action rather than risk letting it through.
    return true
  }
  return !!data && data.length > 0
}

export const IMPERSONATION_BLOCK_MESSAGE =
  "This action isn't available while an admin is viewing this account. Ask them to exit impersonation and try again."
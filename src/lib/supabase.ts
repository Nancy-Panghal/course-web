import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Check your .env or Vercel Environment Variables.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    
  }
})

// getSession() can come back with { session: null, error } for reasons
// that have nothing to do with actually being logged out — a stale
// access token that needs refreshing, a transient network error talking
// to Supabase, etc. Every call site in this app used to only look at
// `session` and silently treat any failure the same as "not logged in",
// which is exactly the kind of failure that's invisible until a real
// user hits it in a freshly-opened tab. This wraps getSession() so a
// null session is only ever trusted after (a) confirming there was no
// error, or (b) an explicit refresh attempt has also failed — and logs
// what actually happened either way, instead of failing silently.
export async function getSessionOrRefresh() {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (session) return { session, error: null }

  if (error) {
    console.warn('[getSessionOrRefresh] getSession() returned an error, attempting refresh:', error.message)
    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.warn('[getSessionOrRefresh] refreshSession() also failed:', refreshError.message)
    }
    return { session: refreshed ?? null, error: refreshError ?? null }
  }

  // No session, no error — this is a genuine "not logged in", not a
  // hidden failure.
  return { session: null, error: null }
}
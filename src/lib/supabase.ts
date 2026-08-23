import { createClient, processLock } from '@supabase/supabase-js'

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
    // Supabase's default cross-tab lock uses the browser's Navigator
    // LockManager API to coordinate auth token refreshes between tabs.
    // It has a known, still-open bug (supabase/supabase-js#1594): if a
    // lock is left behind by a closed/crashed tab, a brand-new tab's
    // session check can hang or fail acquiring the lock, which leaves
    // that tab's app code believing there's no session — even though a
    // valid one exists in localStorage. That's exactly what "new tab
    // shows logged out" looks like. processLock is Supabase's own
    // documented, officially-exported alternative that coordinates
    // within a single tab/process instead of across tabs via the
    // browser lock, sidestepping this failure mode entirely.
    lock: processLock,
  }
})
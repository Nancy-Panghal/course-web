'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Strips the OAuth hash fragment (#access_token=...&refresh_token=...)
 * from the URL right after Supabase has consumed it.
 *
 * Why this matters: detectSessionInUrl processes that hash once, on the
 * page the OAuth provider redirects back to — but it never clears it
 * from the browser's address bar on its own. Supabase's refresh tokens
 * are single-use (rotating): once consumed, that exact token becomes
 * permanently invalid. If the hash is left sitting in the URL and the
 * person later duplicates that tab, copies the URL into a new tab, or
 * the browser restores it from history, the page reloads WITH the same
 * already-spent refresh token still in the hash — and Supabase tries to
 * use it again, throwing "Invalid Refresh Token: Refresh Token Not
 * Found". That failure is what was silently landing people back on a
 * logged-out CTA. Clearing the hash immediately after sign-in removes
 * the stale token from the address bar entirely, so there's nothing
 * left to accidentally reuse later.
 *
 * Mounted once, site-wide, in the root layout — not per-page — since
 * the OAuth redirect can land on any page depending on where sign-in
 * was initiated from.
 */
export default function AuthHashCleanup() {
  useEffect(() => {
    function stripHashIfPresent() {
      if (window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }

    // Covers the case where the hash is already present on first mount
    // (detectSessionInUrl may not have finished processing yet, but
    // clearing the visible URL doesn't affect that — Supabase reads the
    // hash value it captured on load, not a live reference to the URL).
    stripHashIfPresent()

    // Covers the moment sign-in actually completes, in case the hash
    // arrives slightly after this component's first render.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') stripHashIfPresent()
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
'use client'
/**
 * Persistent "Viewing as [Creator]" banner, mounted once in
 * src/app/dashboard/layout.tsx so it shows on every dashboard page
 * while an impersonation session is active. Reads its state from
 * sessionStorage (set by the admin creators page when impersonation
 * starts) rather than the Supabase session itself, since by design
 * the Supabase session while impersonating IS a real creator session
 * and carries no marker of its own.
 *
 * Also auto-exits when the session's expiry passes — necessary
 * because Supabase's autoRefreshToken would otherwise keep a
 * "short-lived" impersonation alive indefinitely via refresh tokens.
 */
import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ImpersonationState {
  creatorId: string
  creatorName: string
  sessionId: string
  expiresAt: string
}

const STORAGE_KEY = 'kurso_impersonation'
const RETURN_SESSION_KEY = 'kurso_admin_return_session'
const CHECK_INTERVAL_MS = 20000

export default function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null)
  const [exiting, setExiting] = useState(false)
  const bodyPaddingSet = useRef(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setState(JSON.parse(raw))
    } catch {
      // ignore malformed storage
    }
  }, [])

  useEffect(() => {
    if (!state) return
    document.body.style.paddingTop = '44px'
    document.documentElement.style.setProperty('--kurso-banner-offset', '44px')
    bodyPaddingSet.current = true
    return () => {
      if (bodyPaddingSet.current) {
        document.body.style.paddingTop = ''
        document.documentElement.style.setProperty('--kurso-banner-offset', '0px')
      }
    }
  }, [state])

  useEffect(() => {
    if (!state) return
    const check = () => {
      if (new Date(state.expiresAt).getTime() <= Date.now()) exit(true)
    }
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    check()
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  async function exit(expired = false) {
    if (!state || exiting) return
    setExiting(true)
    try {
      // Revoke first, independent of the admin session — this is what
      // was silently failing before: revoking used to happen only after
      // restoring the admin's session, using the admin's bearer token,
      // and a failed revoke was swallowed instead of surfaced, so the
      // impersonation session just sat active until its 45-minute expiry.
      try {
        const res = await fetch(`/api/admin/impersonate/${state.creatorId}?sessionId=${state.sessionId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error('[ImpersonationBanner] revoke failed', res.status, body)
        }
      } catch (revokeErr) {
        console.error('[ImpersonationBanner] revoke request failed', revokeErr)
      }

      const rawReturn = sessionStorage.getItem(RETURN_SESSION_KEY)
      if (rawReturn) {
        const { access_token, refresh_token } = JSON.parse(rawReturn)
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    } finally {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(RETURN_SESSION_KEY)
      window.location.href = expired
        ? '/dashboard/admin/creators?impersonation=expired'
        : '/dashboard/admin/creators'
    }
  }

  if (!state) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between gap-3 px-4 py-2.5"
      style={{ background: 'var(--kurso-primary)', minHeight: 44 }}
    >
      <p className="text-xs sm:text-sm font-semibold text-black truncate">
        Viewing as <span className="font-bold">{state.creatorName}</span>
      </p>
      <button
        onClick={() => exit(false)}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex-shrink-0 disabled:opacity-60"
        style={{ background: 'rgba(0,0,0,0.85)', color: '#fff' }}
      >
        <LogOut className="w-3.5 h-3.5" />
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  )
}
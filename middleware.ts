import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Scoped to /about-course/* only — see matcher at the bottom. Doesn't touch
// the dashboard, API routes, or any other page.
//
// IMPORTANT — read before relying on this in production:
// This CSP is a defense-in-depth layer on the PARENT page. It is NOT what
// contains a creator's custom raw HTML/JS (that's the iframe `sandbox`
// attribute in about-course/.../page.tsx, which needs no testing — it's a
// standard browser containment feature). This header instead limits what
// the Kurso-rendered page itself can load, as a second layer.
//
// 'unsafe-inline' is included in script-src because Next.js injects its own
// inline bootstrap data script (__NEXT_DATA__) on every page, and this repo
// doesn't have Next's nonce-based CSP wired up yet. Removing 'unsafe-inline'
// without wiring a nonce through next.config.ts WILL break page hydration.
// That's a real follow-up if you want script-src tightened further later —
// flagging it rather than guessing at the nonce setup, since getting it
// wrong breaks every page under this path, not just this feature.
//
// TEST THIS IN PREVIEW BEFORE TRUSTING IT IN PRODUCTION — specifically:
// Razorpay checkout still opens and completes a payment, YouTube promo
// videos still embed, and Google Fonts still load. CSP mistakes fail
// silently in ways that are easy to miss in a quick click-through.
export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host
    } catch {
      return ''
    }
  })()

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: https://${supabaseHost} https://img.youtube.com`,
    `frame-src 'self' https://www.youtube.com https://api.razorpay.com`,
    `connect-src 'self' https://${supabaseHost} https://api.razorpay.com`,
    "base-uri 'self'",
    "form-action 'self' https://checkout.razorpay.com",
  ].join('; ')

  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: '/about-course/:path*',
}
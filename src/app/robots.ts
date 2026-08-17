import { MetadataRoute } from 'next'

// Next.js auto-serves this at /robots.txt — no separate static file needed.
//
// Allowed: the homepage and every genuinely public, indexable page —
// course sales pages, creator storefronts, ebook pages, and the static
// legal/contact pages.
//
// Disallowed: the dashboard (private, behind login), all API routes
// (nothing for a search engine to show), the logged-in lesson viewer at
// /course/* (requires an active session — Google can't see anything
// there anyway, and indexing it would just be a dead end in search
// results), the checkout/enroll flow, auth pages, and the WhatsApp
// "my courses" view.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kurso.in').replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/dashboard/',
          '/api/',
          '/course/',
          '/enroll/',
          '/login',
          '/reset-password',
          '/wa/',
          '/my-courses',
          '/resource/',
          '/upgrade',
          '/c/',
          '/certificate/',    // ties a real person's name to a public URL
          '/ebook-download/', // a specific buyer's private download link
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
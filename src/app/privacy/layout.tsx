import type { Metadata } from 'next'

// privacy/page.tsx is a client component ('use client'), so it can't export
// its own `metadata` — Next.js only reads metadata exports from Server
// Components. Without this layout, the page silently inherited the root
// layout's homepage title/description verbatim, making it byte-identical
// to the homepage in Google's index.
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Kurso collects, uses, and protects creator and student data across the web dashboard, WhatsApp, and Telegram.',
  alternates: {
    canonical: '/privacy',
  },
  // Legal pages stay public (footer links, payment-gateway / Meta reviews)
  // but don't belong in search results. NOT blocked in robots.ts on purpose —
  // Google has to be able to crawl the page to see this tag.
  robots: {
    index: false,
    follow: true,
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
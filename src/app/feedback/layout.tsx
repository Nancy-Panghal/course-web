import type { Metadata } from 'next'

// See src/app/privacy/layout.tsx for why this wrapper exists —
// feedback/page.tsx is a client component and can't export metadata itself.
export const metadata: Metadata = {
  title: 'Share Feedback',
  description: 'Share feedback or feature requests to help shape Kurso.',
  alternates: {
    canonical: '/feedback',
  },
}

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
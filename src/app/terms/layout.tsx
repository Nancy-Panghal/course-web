import type { Metadata } from 'next'

// See src/app/privacy/layout.tsx for why this wrapper exists —
// terms/page.tsx is a client component and can't export metadata itself.
export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms and conditions for creators and students using Kurso to deliver and take courses over WhatsApp and Telegram.',
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
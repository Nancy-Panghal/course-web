import type { Metadata } from 'next'

// See src/app/privacy/layout.tsx for why this wrapper exists —
// refund-policy/page.tsx is a client component and can't export metadata itself.
export const metadata: Metadata = {
  title: 'Refund Policy',
  description: "Kurso's refund policy for creator subscriptions and Pay As You Earn charges.",
  alternates: {
    canonical: '/refund-policy',
  },
}

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children
}
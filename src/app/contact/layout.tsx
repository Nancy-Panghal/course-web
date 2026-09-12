import type { Metadata } from 'next'

// See src/app/privacy/layout.tsx for why this wrapper exists —
// contact/page.tsx is a client component and can't export metadata itself.
export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Kurso team — questions about pricing, setup, or delivering your course on WhatsApp and Telegram.',
  alternates: {
    canonical: '/contact',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
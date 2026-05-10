import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AcademyKit — Anti-Piracy WhatsApp Course Platform',
  description: 'Deliver courses through WhatsApp with automatic piracy protection. Higher completion rates, zero revenue leakage.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
'use client'

import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <div className="border-b px-6 py-4 flex items-center justify-between"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white">AcademyKit</span>
        </Link>
        <Link href="/"
          className="flex items-center gap-2 text-sm transition-colors"
          style={{color:'#a1a1aa'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-medium"
            style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
            Legal
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">
            Last updated: 10 May 2026 · Effective immediately
          </p>
        </div>

        <div className="prose-custom">

          <Section title="1. Introduction">
            AcademyKit ("we", "us", "our") is committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, store, and share your personal data when you use
            our platform at academykit.in.
            <br /><br />
            By using AcademyKit, you consent to the practices described in this policy. If you
            do not agree, please discontinue use of the Service.
          </Section>

          <Section title="2. Information We Collect">
            <strong style={{color:'#fff'}}>Information you provide directly:</strong>
            <ul>
              <li>Account information: name, email address, password</li>
              <li>Profile data: display name, course name, WhatsApp number</li>
              <li>Payment information: processed by Razorpay — we do not store card details</li>
              <li>Course content: videos, PDFs, and other materials you upload</li>
              <li>Student data: phone numbers and enrollment details you add</li>
            </ul>
            <br />
            <strong style={{color:'#fff'}}>Information collected automatically:</strong>
            <ul>
              <li>Usage data: pages visited, features used, time spent on platform</li>
              <li>Device information: browser type, operating system, IP address</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Log data: server logs including timestamps and error reports</li>
            </ul>
            <br />
            <strong style={{color:'#fff'}}>Information from third parties:</strong>
            <ul>
              <li>Google OAuth data when you sign in with Google (name, email, profile picture)</li>
              <li>Razorpay transaction confirmations (amount, transaction ID, status)</li>
              <li>WhatsApp message metadata via Meta WhatsApp Business API</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            We use your data to:
            <ul>
              <li>Provide, maintain, and improve the AcademyKit platform</li>
              <li>Process payments and manage your subscription</li>
              <li>Deliver course content to your enrolled students via WhatsApp and web portal</li>
              <li>Send transactional emails (receipts, security alerts, account notifications)</li>
              <li>Operate our anti-piracy scanning and takedown services on your behalf</li>
              <li>Monitor platform security and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Respond to your support requests</li>
            </ul>
            We do not sell your personal data to third parties. We do not use your data for
            advertising purposes.
          </Section>

          <Section title="4. Data Storage and Security">
            Your data is stored on secure servers provided by Supabase (PostgreSQL database)
            with encryption at rest. Course files are stored on Cloudflare R2 with access
            controls. All data transmission is encrypted via HTTPS/TLS.
            <br /><br />
            We implement industry-standard security measures including:
            <ul>
              <li>End-to-end encryption for sensitive data</li>
              <li>Role-based access controls limiting who can access your data</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Automatic session expiration and token rotation</li>
            </ul>
            Despite our best efforts, no security system is impenetrable. In the event of a
            data breach, we will notify affected users within 72 hours.
          </Section>

          <Section title="5. Data Sharing">
            We share your data only with:
            <ul>
              <li><strong style={{color:'#fff'}}>Supabase</strong> — database and authentication infrastructure</li>
              <li><strong style={{color:'#fff'}}>Cloudflare</strong> — file storage and CDN delivery</li>
              <li><strong style={{color:'#fff'}}>Razorpay</strong> — payment processing</li>
              <li><strong style={{color:'#fff'}}>Meta (WhatsApp)</strong> — message delivery via WhatsApp Business API</li>
              <li><strong style={{color:'#fff'}}>Resend</strong> — transactional email delivery</li>
              <li><strong style={{color:'#fff'}}>Legal authorities</strong> — when required by law or court order</li>
            </ul>
            All third-party providers are bound by their own privacy policies and data processing
            agreements.
          </Section>

          <Section title="6. Student Data">
            Creators who use AcademyKit to deliver courses to students act as independent data
            controllers for their students' data. AcademyKit acts as a data processor on behalf
            of Creators.
            <br /><br />
            Creators are responsible for:
            <ul>
              <li>Obtaining proper consent from students to collect and process their data</li>
              <li>Informing students about how their data is used</li>
              <li>Complying with applicable data protection laws in their jurisdiction</li>
            </ul>
            Student phone numbers and progress data are stored securely and used only to
            deliver course content.
          </Section>

          <Section title="7. Cookies">
            AcademyKit uses the following cookies:
            <ul>
              <li><strong style={{color:'#fff'}}>Essential cookies</strong> — required for authentication and session management</li>
              <li><strong style={{color:'#fff'}}>Preference cookies</strong> — remember your settings and preferences</li>
              <li><strong style={{color:'#fff'}}>Analytics cookies</strong> — help us understand how the platform is used (anonymized)</li>
            </ul>
            You can control cookie settings through your browser. Disabling essential cookies
            may affect platform functionality.
          </Section>

          <Section title="8. Data Retention">
            We retain your data for as long as your account is active. Upon account deletion:
            <ul>
              <li>A 7-day grace period begins where data is soft-deleted</li>
              <li>After 7 days, all account data is permanently and irreversibly deleted</li>
              <li>Payment records are retained for 7 years as required by financial regulations</li>
              <li>Anonymized usage analytics may be retained indefinitely</li>
            </ul>
          </Section>

          <Section title="9. Your Rights">
            You have the right to:
            <ul>
              <li><strong style={{color:'#fff'}}>Access</strong> — request a copy of all data we hold about you</li>
              <li><strong style={{color:'#fff'}}>Correction</strong> — update inaccurate or incomplete data</li>
              <li><strong style={{color:'#fff'}}>Deletion</strong> — request deletion of your account and data</li>
              <li><strong style={{color:'#fff'}}>Portability</strong> — receive your data in a machine-readable format</li>
              <li><strong style={{color:'#fff'}}>Objection</strong> — object to processing of your data for specific purposes</li>
              <li><strong style={{color:'#fff'}}>Withdrawal of consent</strong> — withdraw consent at any time where processing is consent-based</li>
            </ul>
            To exercise any of these rights, email privacy@academykit.in. We will respond within
            30 days.
          </Section>

          <Section title="10. Children's Privacy">
            AcademyKit is not intended for users under 18 years of age. We do not knowingly
            collect personal data from children. If you believe a child has provided us with
            personal data, please contact us immediately and we will delete it.
          </Section>

          <Section title="11. International Data Transfers">
            AcademyKit is operated from India. If you access the Service from outside India,
            your data may be transferred to and processed in India and other countries where
            our service providers operate. By using the Service, you consent to these transfers.
            <br /><br />
            For users in the European Economic Area (EEA), we ensure appropriate safeguards
            are in place for international data transfers in compliance with GDPR.
          </Section>

          <Section title="12. Changes to This Policy">
            We may update this Privacy Policy periodically. We will notify you of significant
            changes via email at least 14 days before they take effect. Your continued use of
            the Service after the effective date constitutes acceptance of the updated policy.
          </Section>

          <Section title="13. Contact Us">
            For privacy-related questions, data requests, or concerns:
            <br /><br />
            <strong style={{color:'#fff'}}>AcademyKit — Privacy Team</strong><br />
            Email: privacy@academykit.in<br />
            Support: support@academykit.in<br /><br />
            We aim to respond to all privacy requests within 30 days.
          </Section>

        </div>
      </div>

      <style jsx>{`
        .prose-custom { color: #a1a1aa; line-height: 1.8; font-size: 15px; }
        .prose-custom ul { margin: 12px 0 12px 20px; display: flex; flex-direction: column; gap: 6px; }
        .prose-custom li { list-style: disc; }
        .prose-custom strong { color: #e4e4e7; }
      `}</style>

      {/* Footer */}
      <div className="border-t px-6 py-8 text-center"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="flex items-center justify-center gap-6 text-sm">
          <Link href="/terms" style={{color:'#52525b'}} className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" style={{color:'#a1a1aa'}}>Privacy</Link>
          <Link href="/" style={{color:'#52525b'}} className="hover:text-white transition-colors">Home</Link>
        </div>
        <p className="text-xs mt-4" style={{color:'#3f3f46'}}>© 2026 AcademyKit. All rights reserved.</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10 pb-10" style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div>{children}</div>
    </div>
  )
}
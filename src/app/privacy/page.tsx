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
          <span className="font-semibold text-white">Kurso</span>
        </Link>
        <Link href="/"
          className="flex items-center gap-2 text-sm transition-colors"
          style={{color:'#a1a1aa'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-medium"
            style={{background:'rgba(var(--kurso-primary-rgb), 0.1)', color:'var(--kurso-primary-light)', border:'1px solid rgba(var(--kurso-primary-rgb), 0.2)'}}>
            Legal
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">Last updated: September 3, 2026 · Effective from the date of publication on this page</p>
        </div>

        <div className="prose-custom">
          <Section title="1. Scope and Data Fiduciary">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              This Privacy Policy describes how Kurso (&ldquo;<strong>Kurso</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;), operated as a sole proprietorship under the trade name KURSO (Udyam Registration No. UDYAM-HR-16-0051480), having its principal place of business at House No. 72, Parawar Road, Maina, Rohtak, Haryana &ndash; 124021, India, collects, uses, discloses, and protects personal data in connection with the Kurso platform (the &ldquo;<strong>Platform</strong>&rdquo;), including its website and its Telegram and WhatsApp bot integrations. For the purposes of the Digital Personal Data Protection Act, 2023 (&ldquo;<strong>DPDP Act</strong>&rdquo;), Kurso acts as the <strong>Data Fiduciary</strong> in respect of the personal data described in this Policy, and you, as a Creator or Student, are a <strong>Data Principal</strong>.
            </p>
          </Section>

          <Section title="2. Personal Data We Collect">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              <strong>From Creators:</strong> full name, email address, phone number, business/brand name, and, where a Creator connects a payment gateway, gateway account credentials (API keys and webhook secrets), which are encrypted at rest and used solely to process the Creator&rsquo;s own transactions with their Students.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              <strong>From Students:</strong> full name, email address, phone number, and, where a Student accesses a Product via our Telegram or WhatsApp integrations, their Telegram chat ID or WhatsApp-registered phone number. We also collect enrollment records, payment status (not full card or bank details, which are handled directly by the relevant payment gateway), quiz and assignment submissions, and certificate issuance records.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              <strong>Anti-piracy and access data:</strong> to protect Creator Content, we log which Student accessed which lesson and when, and embed an identifying watermark (the Student&rsquo;s name and/or identifier) into video playback. This data is used solely to trace unauthorised redistribution of Content and to enforce Section 8 of our Terms &amp; Conditions.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              <strong>Technical data:</strong> IP address, browser and device information, and session identifiers (via a session cookie used to maintain a logged-in state after accessing the Platform through a Telegram or WhatsApp link), collected automatically for security, fraud prevention, and to keep the Platform functioning correctly.
            </p>
          </Section>

          <Section title="3. How We Use Personal Data">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We use personal data to: (a) create and manage Creator and Student accounts; (b) deliver purchased Content to the correct, authorised Student, including via our anti-piracy and watermarking measures; (c) process Creator Subscription Fee payments; (d) issue completion certificates; (e) send transactional communications (enrollment confirmations, lesson notifications, payment receipts, and support responses); (f) investigate and respond to suspected unauthorised redistribution of Content; (g) comply with applicable law and respond to lawful requests from authorities; and (h) improve and maintain the security of the Platform.
            </p>
          </Section>

          <Section title="4. Third-Party Processors">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              We rely on the following categories of third-party service providers to operate the Platform, each of which processes personal data on our behalf and is contractually or by policy restricted from using it for their own purposes:
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              <strong>Supabase</strong> (database, authentication, and file storage); <strong>Cloudflare</strong> (video and ebook file storage and delivery); <strong>Upstash</strong> (short-lived rate-limiting data, hosted in the Mumbai, India region); <strong>Vercel</strong> (application hosting); and, where a Creator connects them, <strong>Razorpay</strong>, <strong>Cashfree</strong>, or <strong>Stripe</strong> (payment processing for that Creator&rsquo;s own transactions). Kurso itself uses Cashfree to process Creator Subscription Fee payments.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
                            Our database, authentication, and file storage (Supabase) and our video/ebook storage (Cloudflare R2) are both hosted in the Asia-Pacific (Mumbai, India) region. Where any other service provider processes personal data outside India, we rely on that provider&rsquo;s own data protection commitments and take reasonable steps consistent with the DPDP Act.
            </p>
          </Section>

          <Section title="5. Children&rsquo;s Data">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Some Students on the Platform are under 18 years of age. Where we have actual knowledge that a Data Principal is a child, we do not use their personal data for behavioural monitoring or targeted advertising, in accordance with the DPDP Act. Processing of a child&rsquo;s personal data is intended to be undertaken only with the verifiable consent of a parent or lawful guardian, obtained at the time of purchase or enrollment.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              <strong>We are in the process of implementing a dedicated, verifiable parental-consent mechanism as required by the DPDP Act.</strong> Until that mechanism is live, the individual completing a purchase or enrollment on behalf of a minor Student is required, under our Terms &amp; Conditions, to confirm that they are the Student&rsquo;s parent or lawful guardian or are otherwise authorised to act on the guardian&rsquo;s behalf.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We retain personal data for as long as the relevant account remains active, and thereafter for as long as necessary to comply with our legal obligations (including tax and accounting requirements), resolve disputes, and enforce our agreements. Anti-piracy access logs are retained for a limited period sufficient to investigate reported unauthorised redistribution of Content. A Data Principal may request earlier erasure as described in Section 8, subject to our right to retain data where required by law.
            </p>
          </Section>

          <Section title="7. Security Measures">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We apply reasonable technical and organisational measures to protect personal data, including encryption of Creator payment gateway credentials at rest, time-limited signed access links for Content (rather than permanent public links), and access controls restricting who can view Student and Creator data. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="8. Your Rights as a Data Principal">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Subject to the DPDP Act, you have the right to: (a) obtain a summary of the personal data we hold about you and the processing activities undertaken; (b) request correction, completion, or updating of your personal data; (c) request erasure of your personal data, unless retention is required for a legal purpose; (d) withdraw any consent previously given, without affecting the lawfulness of processing carried out before withdrawal; (e) nominate another individual to exercise these rights on your behalf in the event of your death or incapacity; and (f) file a grievance with us in the first instance, and thereafter with the Data Protection Board of India if unresolved.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              To exercise any of these rights, contact us using the details in Section 11 below.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We use a strictly necessary session cookie to keep you signed in after accessing the Platform through a Telegram or WhatsApp link, and standard authentication cookies for account login on the website. We do not use these cookies for advertising or cross-site tracking.
            </p>
          </Section>

          <Section title="10. Data Breach Notification">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              In the event of a personal data breach, we will notify the Data Protection Board of India and affected Data Principals as required under the DPDP Act and rules made thereunder.
            </p>
          </Section>

          <Section title="11. Grievance Officer and Contact">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              For any question about this Policy, or to exercise a right described in Section 8, contact our Grievance Officer at <a href="mailto:support@kurso.in" style={{color:'var(--kurso-primary-light)'}}>support@kurso.in</a>. All requests are personally reviewed by the Platform&rsquo;s proprietor. See also our{' '}
              <Link href="/contact" style={{color:'var(--kurso-primary-light)'}}>Contact page</Link>.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We may revise this Policy from time to time to reflect changes in our practices or legal requirements. The &ldquo;Last updated&rdquo; date above will be revised accordingly, and material changes will be notified through the Platform.
            </p>
          </Section>
        </div>
      </div>

      <div className="border-t px-6 py-10 text-center" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="flex items-center justify-center gap-6 text-sm" style={{color:'#52525b'}}>
          <Link href="/terms" style={{color:'#52525b'}} className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" style={{color:'#a1a1aa'}}>Privacy</Link>
          <Link href="/refund-policy" style={{color:'#52525b'}} className="hover:text-white transition-colors">Refund Policy</Link>
          <Link href="/" style={{color:'#52525b'}} className="hover:text-white transition-colors">Home</Link>
        </div>
        <p className="text-xs mt-4" style={{color:'#3f3f46'}}>© 2026 Kurso. All rights reserved.</p>
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
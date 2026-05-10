'use client'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">
            Last updated: 10 May 2026 · Effective immediately
          </p>
        </div>

        {/* Content */}
        <div className="prose-custom">

          <Section title="1. Acceptance of Terms">
            By accessing or using AcademyKit ("the Service"), you agree to be bound by these Terms
            of Service. If you do not agree to these terms, please do not use the Service. These
            terms apply to all users including content creators ("Creators") and students ("Students").
          </Section>

          <Section title="2. Description of Service">
            AcademyKit is a Software-as-a-Service (SaaS) platform that enables Creators to:
            <ul>
              <li>Upload and deliver digital course content to enrolled students</li>
              <li>Automate course delivery via WhatsApp and web portal</li>
              <li>Monitor and file takedown notices for unauthorized distribution of their content</li>
              <li>Manage student enrollments, progress tracking, and certifications</li>
            </ul>
            AcademyKit acts as a technology provider and is not responsible for the content
            created or distributed by Creators.
          </Section>

          <Section title="3. Account Registration">
            To use AcademyKit, you must create an account with a valid email address. You are
            responsible for maintaining the confidentiality of your account credentials and for
            all activities that occur under your account. You must notify us immediately at
            support@academykit.in of any unauthorized use of your account.
            <br /><br />
            You must be at least 18 years of age to create an account. By registering, you
            represent that all information you provide is accurate and current.
          </Section>

          <Section title="4. Subscription Plans and Billing">
            AcademyKit offers three subscription tiers: Starter (₹1,999/month), Growth
            (₹4,999/month), and Agency (₹12,999/month). All plans are billed monthly in advance.
            <br /><br />
            Payments are processed securely via Razorpay. By subscribing, you authorize AcademyKit
            to charge your payment method on a recurring monthly basis until you cancel. Prices
            are exclusive of applicable taxes including GST where applicable.
            <br /><br />
            We reserve the right to modify pricing with 30 days notice to existing subscribers.
          </Section>

          <Section title="5. Cancellation and Refunds">
            You may cancel your subscription at any time from your account settings. Cancellation
            takes effect at the end of your current billing period — you retain access until then.
            <br /><br />
            Refunds are issued only in the following cases:
            <ul>
              <li>Technical failure on our end that prevented service delivery for more than 48 hours</li>
              <li>Duplicate charges due to billing errors</li>
              <li>Cancellation within 7 days of initial subscription if no course has been created</li>
            </ul>
            Refund requests must be submitted to support@academykit.in within 14 days of the charge.
          </Section>

          <Section title="6. Content and Intellectual Property">
            Creators retain full ownership of all course content they upload to AcademyKit.
            By uploading content, you grant AcademyKit a limited, non-exclusive license to
            store, process, and deliver that content solely for the purpose of providing the Service.
            <br /><br />
            You represent and warrant that:
            <ul>
              <li>You own or have the necessary rights to all content you upload</li>
              <li>Your content does not infringe any third-party intellectual property rights</li>
              <li>Your content does not violate any applicable laws or regulations</li>
              <li>Your content is not harmful, defamatory, obscene, or otherwise objectionable</li>
            </ul>
            AcademyKit reserves the right to remove content that violates these terms without notice.
          </Section>

          <Section title="7. Prohibited Uses">
            You agree not to use AcademyKit to:
            <ul>
              <li>Upload, distribute, or sell content that infringes third-party copyrights</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Engage in fraudulent transactions or misrepresent your identity</li>
              <li>Attempt to reverse-engineer, hack, or compromise the platform</li>
              <li>Use automated scripts to abuse the platform beyond normal usage</li>
              <li>Resell access to the platform without written authorization</li>
              <li>Violate any applicable local, national, or international laws</li>
            </ul>
            Violation of these terms may result in immediate account termination without refund.
          </Section>

          <Section title="8. Anti-Piracy Services">
            AcademyKit provides automated tools to detect and report unauthorized distribution
            of Creator content. While we make reasonable efforts to identify and file takedown
            notices for infringing content, we do not guarantee that all infringing copies will
            be identified or removed.
            <br /><br />
            Takedown notices are filed in good faith under applicable copyright laws including
            the Information Technology (Amendment) Rules 2026 for content on Indian platforms.
            AcademyKit is not a law firm and does not provide legal advice. For formal legal
            action, Creators should consult a qualified attorney.
          </Section>

          <Section title="9. Account Deletion">
            You may request account deletion from Settings → Danger Zone. Upon requesting deletion,
            a 7-day grace period begins during which you may cancel the deletion request. After
            7 days, your account and all associated data including lessons, student enrollments,
            and piracy logs will be permanently deleted and cannot be recovered.
            <br /><br />
            Active subscription fees are not refunded upon account deletion.
          </Section>

          <Section title="10. Limitation of Liability">
            To the maximum extent permitted by law, AcademyKit shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your
            use of the Service. Our total liability shall not exceed the amount you paid to
            AcademyKit in the 3 months preceding the claim.
          </Section>

          <Section title="11. Governing Law">
            These Terms are governed by the laws of India. Any disputes arising from these Terms
            shall be subject to the exclusive jurisdiction of the courts in Haryana, India.
          </Section>

          <Section title="12. Changes to Terms">
            We may update these Terms at any time. We will notify you of material changes via
            email. Continued use of the Service after changes constitutes acceptance of the
            updated Terms.
          </Section>

          <Section title="13. Contact">
            For questions about these Terms, contact us at:
            <br /><br />
            <strong style={{color:'#fff'}}>AcademyKit</strong><br />
            Email: legal@academykit.in<br />
            Support: support@academykit.in
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
        <div className="flex items-center justify-center gap-6 text-sm" style={{color:'#52525b'}}>
          <Link href="/terms" style={{color:'#a1a1aa'}}>Terms</Link>
          <Link href="/privacy" style={{color:'#52525b'}} className="hover:text-white transition-colors">Privacy</Link>
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
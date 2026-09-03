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
          <h1 className="text-4xl font-bold text-white mb-3">Terms &amp; Conditions</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">Last updated: September 3, 2026 · Effective from the date of publication on this page</p>
        </div>

        <div className="prose-custom">
          <Section title="1. Acceptance of These Terms">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              These Terms &amp; Conditions (&ldquo;<strong>Terms</strong>&rdquo;) constitute a legally binding agreement between you and Kurso (&ldquo;<strong>Kurso</strong>&rdquo;, &ldquo;<strong>the Platform</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;), operated as a sole proprietorship under the trade name KURSO (Udyam Registration No. UDYAM-HR-16-0051480), having its principal place of business at House No. 72, Parawar Road, Maina, Rohtak, Haryana &ndash; 124021, India. By creating an account, accessing, or using the Platform in any capacity &mdash; as a Creator or as a Student &mdash; you agree to be bound by these Terms, our Privacy Policy, and our Refund Policy, each of which is incorporated herein by reference. If you do not agree, you must not use the Platform.
            </p>
          </Section>

          <Section title="2. Definitions">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              &ldquo;<strong>Creator</strong>&rdquo; means any individual or entity who registers on the Platform to create, list, price, and sell courses, live cohorts, or ebooks (each, a &ldquo;<strong>Product</strong>&rdquo;). &ldquo;<strong>Student</strong>&rdquo; means any individual who enrolls in or purchases a Product. &ldquo;<strong>Content</strong>&rdquo; means all video, audio, text, images, documents, assessments, and other material a Creator uploads, links, or otherwise makes available through the Platform. &ldquo;<strong>Services</strong>&rdquo; means the software, storage, content-delivery, payment-integration, and anti-piracy infrastructure Kurso makes available to Creators and Students, delivered via the Platform&rsquo;s website and its Telegram and WhatsApp bot integrations.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              A Creator must be at least 18 years of age and legally capable of entering into a binding contract under the Indian Contract Act, 1872, to register on the Platform.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              A Student may be under 18 years of age. Where a Student is a minor, any purchase, enrollment, or acceptance of these Terms on the Student&rsquo;s behalf must be made by, or with the verifiable consent of, the Student&rsquo;s parent or lawful guardian, who shall be responsible for the minor&rsquo;s use of the Platform and any Product purchased. Kurso does not independently verify the age or guardianship status of any user and disclaims liability arising from a breach of this Section by any party.
            </p>
          </Section>

          <Section title="4. What Kurso Is &mdash; and Is Not">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Kurso is a technology platform that provides Creators with the infrastructure to host, deliver, protect, and sell their own Content to Students, including delivery via a website interface and via Telegram and WhatsApp bot integrations, together with anti-piracy measures such as signed, time-limited access links and visible watermarking.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              <strong>Kurso is not a publisher, co-creator, instructor, or seller of any Product.</strong> Each Creator is solely responsible for the Content they upload, its accuracy, legality, and quality, and for fulfilling any promise made to a Student in connection with a Product. Kurso does not review, endorse, or guarantee any Content prior to its publication on the Platform, though Kurso reserves the right to remove Content that violates these Terms or applicable law.
            </p>
          </Section>

          <Section title="5. Creator Accounts and Obligations">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              A Creator represents and warrants that: (a) all information provided during registration is accurate and kept up to date; (b) the Creator owns, or holds all necessary rights and licenses in, the Content they upload, and that such Content does not infringe any third party&rsquo;s intellectual property, privacy, or other rights; (c) the Content and the Creator&rsquo;s conduct on the Platform comply with all applicable Indian laws, including without limitation the Information Technology Act, 2000 and rules made thereunder; and (d) the Creator is solely responsible for determining, collecting, and remitting any applicable taxes, including GST, arising from the sale of their Products.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              A Creator is solely responsible for connecting and maintaining their own payment gateway account (Razorpay, Cashfree, or Stripe) in order to receive payment from Students, and for complying with that payment gateway&rsquo;s own terms of service, KYC requirements, and applicable Reserve Bank of India regulations governing payment aggregation.
            </p>
          </Section>

          <Section title="6. Student Purchases">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              When a Student purchases a Product, the Student enters into a contract of sale directly with the Creator. <strong>Kurso is not a party to that contract, does not collect or hold the payment, and the funds are settled directly into the Creator&rsquo;s own connected payment gateway account.</strong> Refund eligibility for any purchase is governed by our Refund Policy.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              A Student&rsquo;s access to a Product is personal to that Student and is granted subject to the anti-piracy and content-protection provisions of Section 8 below.
            </p>
          </Section>

          <Section title="7. Content Ownership and License to Kurso">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              As between a Creator and Kurso, the Creator retains all ownership and intellectual property rights in their Content. By uploading Content to the Platform, the Creator grants Kurso a non-exclusive, worldwide, royalty-free license to store, encode, transmit, watermark, and otherwise process that Content solely for the purpose of operating the Services &mdash; including delivering it to enrolled Students and applying anti-piracy protections &mdash; for as long as the Content remains on the Platform.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Kurso&rsquo;s own software, branding, website design, and platform infrastructure remain the exclusive property of Kurso and are not licensed to any Creator or Student by virtue of these Terms.
            </p>
          </Section>

          <Section title="8. Anti-Piracy Measures and Prohibited Conduct">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Kurso applies technical measures intended to deter and help trace unauthorised redistribution of Content, including time-limited signed access links and visible watermarking identifying the accessing Student. These measures are provided on a best-efforts basis; <strong>Kurso does not guarantee that Content cannot be copied, recorded, or redistributed without authorisation</strong>, and disclaims liability for any such unauthorised use by a Student or third party.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              A user must not: (a) share, sell, sublicense, or otherwise redistribute access credentials or Content obtained through the Platform; (b) attempt to circumvent, disable, or interfere with any access-control, watermarking, or anti-piracy measure; (c) use automated means to scrape, download in bulk, or reverse-engineer any part of the Platform or Content; (d) upload Content that is unlawful, infringing, defamatory, or that the Creator does not have the right to distribute; or (e) use the Platform to harass, defraud, or mislead any other user. Kurso reserves the right to suspend or terminate, without refund, the account of any user who violates this Section.
            </p>
          </Section>

          <Section title="9. Subscription Fees">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Creators pay Kurso a Subscription Fee for access to the Services, at the pricing and billing frequency displayed at the time of purchase or renewal. Subscription Fees are billed in advance and are subject to our Refund Policy. Kurso may change its pricing prospectively, with reasonable notice, for future billing cycles; changes do not apply retroactively to a period already paid for.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              The Platform and Services are provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong> without warranty of any kind, whether express, implied, or statutory, including without limitation any implied warranty of merchantability, fitness for a particular purpose, or non-infringement. Kurso does not warrant that the Platform will be uninterrupted, error-free, or secure, or that any Creator will achieve any particular level of sales, revenue, or student engagement through use of the Services.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              To the maximum extent permitted by applicable law, Kurso shall not be liable for any indirect, incidental, consequential, special, or punitive damages, or for any loss of profits, revenue, data, or goodwill, arising out of or in connection with the use of the Platform, whether based in contract, tort, or otherwise, even if advised of the possibility of such damages.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Without limiting the foregoing, Kurso shall not be liable for: (a) any dispute between a Creator and a Student, including as to the quality, accuracy, or delivery of a Product; (b) any act, omission, or failure of a third-party payment gateway (Razorpay, Cashfree, or Stripe) connected by a Creator; (c) any unauthorised access to, or redistribution of, Content notwithstanding the anti-piracy measures described in Section 8; or (d) any loss arising from a Creator&rsquo;s or Student&rsquo;s breach of these Terms.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              To the extent Kurso is found liable for any claim arising from these Terms notwithstanding the foregoing, Kurso&rsquo;s total aggregate liability shall not exceed the total Subscription Fees paid by the relevant Creator to Kurso in the twelve (12) months preceding the event giving rise to the claim.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Each Creator agrees to indemnify, defend, and hold harmless Kurso and its proprietor from and against any claim, liability, damage, loss, or expense (including reasonable legal fees) arising out of or connected with: (a) the Creator&rsquo;s Content; (b) the Creator&rsquo;s breach of these Terms or of any representation or warranty herein; (c) any dispute between the Creator and a Student; or (d) the Creator&rsquo;s violation of any applicable law, including tax law, in connection with their use of the Platform.
            </p>
          </Section>

          <Section title="13. Suspension and Termination">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Kurso may suspend or terminate any account, with or without notice, for violation of these Terms, suspected fraudulent or illegal activity, or non-payment of Subscription Fees. A Creator may terminate their account at any time; termination does not entitle the Creator to a refund of any already-paid Subscription Fee except as provided in our Refund Policy.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Upon termination of a Creator&rsquo;s account, previously enrolled Students may lose access to that Creator&rsquo;s Content; Kurso is not liable for any resulting loss to a Student, whose recourse, if any, lies against the Creator.
            </p>
          </Section>

          <Section title="14. Privacy">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Our collection, use, and disclosure of personal data is governed by our Privacy Policy, which forms part of these Terms.
            </p>
          </Section>

          <Section title="15. Governing Law and Dispute Resolution">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              These Terms are governed by the laws of India. Subject to applicable consumer protection law, the courts at Rohtak, Haryana shall have exclusive jurisdiction over any dispute arising out of or in connection with these Terms.
            </p>
          </Section>

          <Section title="16. Changes to These Terms">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We may revise these Terms from time to time. The &ldquo;Last updated&rdquo; date above will be revised accordingly, and material changes will be notified through the Platform. Continued use of the Platform after a revision takes effect constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="17. Grievance Officer and Contact">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              In accordance with the Information Technology Act, 2000 and rules made thereunder, grievances regarding Content or conduct on the Platform may be addressed to our Grievance Officer at <a href="mailto:support@kurso.in" style={{color:'var(--kurso-primary-light)'}}>support@kurso.in</a>. All grievances are personally reviewed by the Platform&rsquo;s proprietor. See also our{' '}
              <Link href="/contact" style={{color:'var(--kurso-primary-light)'}}>Contact page</Link>.
            </p>
          </Section>
        </div>
      </div>

      <div className="border-t px-6 py-10 text-center" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="flex items-center justify-center gap-6 text-sm" style={{color:'#52525b'}}>
          <Link href="/terms" style={{color:'#a1a1aa'}}>Terms</Link>
          <Link href="/privacy" style={{color:'#52525b'}} className="hover:text-white transition-colors">Privacy</Link>
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
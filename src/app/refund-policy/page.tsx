'use client'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="border-b px-6 py-4 flex items-center justify-between"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white">Kurso</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm transition-colors" style={{color:'#a1a1aa'}}>
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
          <h1 className="text-4xl font-bold text-white mb-3">Refund Policy</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">Last updated: September 3, 2026 · Effective from the date of publication on this page</p>
        </div>

        <div className="prose-custom">
          <Section title="1. Scope and Definitions">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              This Refund Policy governs all monetary refunds arising out of transactions conducted on or through the Kurso platform (&ldquo;<strong>Kurso</strong>&rdquo;, &ldquo;<strong>the Platform</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;), operated as a sole proprietorship under the trade name KURSO (Udyam Registration No. UDYAM-HR-16-0051480), having its principal place of business at Rohtak, Haryana, India. This Policy is incorporated by reference into, and forms part of, our Terms &amp; Conditions.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              For the purposes of this Policy: a &ldquo;<strong>Creator</strong>&rdquo; is an individual or entity who lists, prices, and sells a course, live cohort, or ebook (each, a &ldquo;<strong>Product</strong>&rdquo;) through the Platform; a &ldquo;<strong>Student</strong>&rdquo; is any individual who purchases a Product; a &ldquo;<strong>Course Transaction</strong>&rdquo; is any payment made by a Student to a Creator for a Product; and a &ldquo;<strong>Subscription Fee</strong>&rdquo; is any payment made by a Creator to Kurso for access to the Platform&rsquo;s software and delivery infrastructure.
            </p>
          </Section>

          <Section title="2. Kurso Is a Technology Intermediary, Not a Seller or Payment Collector">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Kurso provides software infrastructure that enables Creators to deliver, protect, and sell their own Products directly to Students. <strong>Kurso is not the seller, publisher, or provider of any Product</strong>, does not create or control any Product&rsquo;s content, and makes no representation as to its quality, accuracy, completeness, or fitness for any purpose.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Each Creator connects their own payment gateway account (Razorpay, Cashfree, or Stripe, at the Creator&rsquo;s election) to receive payment for Course Transactions. <strong>Kurso does not collect, hold, custody, or have access to Student payment funds at any point.</strong> When a Student completes a Course Transaction, the funds are settled directly into the Creator&rsquo;s own connected payment gateway account. Kurso is not a party to the contract of sale formed between a Creator and a Student, and any statutory or contractual liability arising from that sale &mdash; including the obligation to issue a refund &mdash; rests solely and entirely with the Creator.
            </p>
          </Section>

          <Section title="3. Refunds on Course and Ebook Purchases">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Refund eligibility for a Course Transaction, including whether a refund window applies at all, its duration, and any conditions attached to it, is set individually by the Creator for each Product and is displayed on that Product&rsquo;s page prior to purchase. A Creator may elect to offer no refund window whatsoever, in which case the Course Transaction is final and non-refundable except as required by applicable law.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Where a Creator has enabled a refund window for a Product and a Student submits a refund request within that window through the mechanism provided on the Platform, the request is routed to the Creator for review. <strong>The decision to approve, partially approve, or deny the request is made solely by the Creator, not by Kurso.</strong> Kurso does not adjudicate disputes over course quality, content accuracy, delivery issues attributable to the Creator, or any other matter concerning the substance of the Product.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              This entire Section 3 applies equally, and without modification, to ebook purchases.
            </p>
          </Section>

          <Section title="4. How an Approved Refund Is Paid Out">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Because Course Transaction funds settle directly into the Creator&rsquo;s own payment gateway account and are never held by Kurso, <strong>the Creator, and only the Creator, is able to execute the actual transfer of a refund</strong> once approved, using the refund tools provided by their connected payment gateway (Razorpay, Cashfree, or Stripe). Kurso&rsquo;s role is limited to providing the request-and-approval mechanism on the Platform and notifying the Creator of an approved request; Kurso does not itself move, front, or guarantee the payment of any refund on a Course Transaction.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Refunds, once issued by a Creator, can only be returned to the Student&rsquo;s original payment method (the same card, UPI ID, or bank account used at checkout), as required by payment industry rules, and typically take 5&ndash;10 business days to reflect depending on the Student&rsquo;s bank or payment provider. If a Creator approves a refund but fails to execute it, the Student&rsquo;s recourse is against the Creator directly; Kurso will make reasonable efforts to facilitate communication between the parties but assumes no payment obligation of its own.
            </p>
          </Section>

          <Section title="5. Refunds on Kurso Subscription Fees">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Subscription Fees paid by a Creator to Kurso for use of the Platform are <strong>presumptively non-refundable</strong>, reflecting that access to the Platform&rsquo;s software, storage, and delivery infrastructure is granted immediately upon payment.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Notwithstanding the foregoing, a Creator may submit a Subscription Fee refund request through the Platform. Each such request is reviewed manually and decided <strong>at Kurso&rsquo;s sole discretion</strong>, having regard to factors including, without limitation, the extent to which the Creator utilised the Services during the relevant billing period &mdash; including but not limited to courses or lessons created, storage and bandwidth consumed, and content delivered to Students &mdash; the time elapsed since payment, and the reason stated for the request. A request accompanied by minimal or no demonstrable use of the Services during the relevant period will generally be viewed favourably; a request made after significant use of the Services will generally not be approved. Kurso&rsquo;s determination on any Subscription Fee refund request is final.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Nothing in this Section 5 limits any statutory refund right a Creator may separately hold under applicable Indian consumer protection law.
            </p>
          </Section>

          <Section title="6. Minors and Guardian-Authorised Purchases">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Where a Course Transaction is made by, or on behalf of, a Student under the age of 18, the individual completing checkout represents and warrants that they are the parent or lawful guardian of the Student, or are otherwise authorised by such parent or guardian to complete the purchase and to bind the Student to the applicable Creator&rsquo;s refund terms and this Policy. Kurso does not independently verify the identity, age, or guardianship status of any party to a Course Transaction, and disclaims liability for any Course Transaction completed in breach of this representation. See our Privacy Policy for how we handle the personal data of Students who are minors.
            </p>
          </Section>

          <Section title="7. Chargebacks and Unauthorised Transactions">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              If a Student believes a Course Transaction was made in error, without authorisation, or fraudulently, the Student should first contact the Creator directly and may separately raise the matter with their bank or card issuer as a chargeback. Because Kurso does not hold Course Transaction funds, Kurso is not a party to any chargeback proceeding on a Course Transaction and cannot itself reverse or refund such a payment; the Creator, as the recipient of the funds and respondent to the payment gateway&rsquo;s chargeback process, bears sole responsibility for responding to and resolving such proceedings.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              We may revise this Policy from time to time to reflect changes in our Services, legal or regulatory requirements, or business practices. The &ldquo;Last updated&rdquo; date above will be revised accordingly. Continued use of the Platform after a revision takes effect constitutes acceptance of the revised Policy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Questions about this Policy, or a request to escalate a matter not resolved by a Creator, may be sent to <a href="mailto:support@kurso.in" style={{color:'var(--kurso-primary-light)'}}>support@kurso.in</a>. See also our{' '}
              <Link href="/contact" style={{color:'var(--kurso-primary-light)'}}>Contact page</Link>.
            </p>
          </Section>
        </div>
      </div>

      <div className="border-t px-6 py-10 text-center" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="flex items-center justify-center gap-6 text-sm" style={{color:'#52525b'}}>
          <Link href="/terms" style={{color:'#52525b'}} className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" style={{color:'#52525b'}} className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/refund-policy" style={{color:'#a1a1aa'}}>Refund Policy</Link>
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
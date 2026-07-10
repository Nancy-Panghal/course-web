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
            style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
            Legal
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Refund Policy</h1>
          <p style={{color:'#a1a1aa'}} className="text-sm">Last updated: 9 July 2026</p>
        </div>

        <div className="prose-custom">
          <Section title="Kurso is a platform, not the seller">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Kurso is a technology platform that enables independent course creators to sell and deliver their own courses to students via WhatsApp and Telegram. Kurso is not the seller of any course — each creator is solely responsible for their own course content, pricing, and refund terms.
            </p>
          </Section>

          <Section title="Course purchases (student and creator)">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed mb-3">
              Refund eligibility, the refund window, and any conditions are set individually by each creator and shown on that course's page before you purchase. Kurso is not a party to this transaction and does not decide whether a particular refund request is approved or denied.
            </p>
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              To request a refund, use the refund option on your enrollment where the creator has enabled one and you are within their stated refund window, or contact the creator directly.
            </p>
          </Section>

          <Section title="How refunds are processed">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Where a refund is approved, Kurso processes it through Razorpay back to your original payment method — the same card, UPI ID, or bank account used at checkout. This is a payment-industry requirement, not a Kurso choice: refunds can only be sent back to the original payment source. Normal refunds typically take 5–10 business days to reflect, depending on your bank. Kurso does not collect or store your card, UPI, or bank account details at any point.
            </p>
          </Section>

          <Section title="Kurso subscription fees (creators)">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Fees paid by creators to Kurso for use of the platform are non-refundable, except where required by law.
            </p>
          </Section>

          <Section title="Disputes">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              If you believe a charge was made in error or without your authorization, you may also raise this directly with your bank or card issuer.
            </p>
          </Section>

          <Section title="Contact">
            <p style={{color:'#a1a1aa'}} className="text-sm leading-relaxed">
              Questions about this policy can be sent to the support contact listed on our{' '}
              <Link href="/contact" style={{color:'#8b5cf6'}}>Contact page</Link>.
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
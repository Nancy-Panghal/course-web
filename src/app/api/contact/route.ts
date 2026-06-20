import { NextRequest, NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/email'

const SUBJECT_LABELS: Record<string, string> = {
  billing: 'Billing / Subscription',
  technical: 'Technical Support',
  upgrade: 'Upgrade / Plan Change',
  refund: 'Refund Request',
  other: 'Other',
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json()

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[contact] RESEND_API_KEY is not set')
      return NextResponse.json({ error: 'Email service is not configured. Please contact us directly.' }, { status: 503 })
    }

    const subjectLabel = SUBJECT_LABELS[subject] || subject
    const safeName = escapeHtml(name.trim())
    const safeEmail = escapeHtml(email.trim())
    const safeSubject = escapeHtml(subjectLabel)
    const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br/>')

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e4e4e7;border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;">
          <h2 style="margin:0;font-size:20px;color:#fff;">New Contact Form Submission</h2>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">AcademyKit — Contact Page</p>
        </div>
        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;width:120px;color:#a1a1aa;font-size:13px;font-weight:600;">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#a1a1aa;font-size:13px;font-weight:600;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;font-size:14px;">
                <a href="mailto:${safeEmail}" style="color:#8b5cf6;text-decoration:none;">${safeEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#a1a1aa;font-size:13px;font-weight:600;">Subject</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;">${safeSubject}</td>
            </tr>
            <tr>
              <td style="padding:14px 0 0;color:#a1a1aa;font-size:13px;font-weight:600;vertical-align:top;">Message</td>
              <td style="padding:14px 0 0;color:#e4e4e7;font-size:14px;line-height:1.6;">${safeMessage}</td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #27272a;background:#050505;">
          <p style="margin:0;font-size:12px;color:#52525b;">Sent via AcademyKit contact form · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        </div>
      </div>
    `

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['nancypanghal13@gmail.com'],
        subject: `[AcademyKit Contact] ${subjectLabel} — from ${name.trim()}`,
        html,
      }),
    })

    const resendData = await resendRes.json().catch(() => null)

    if (!resendRes.ok) {
      const errMsg = resendData?.message || resendData?.error || `Resend error ${resendRes.status}`
      console.error('[contact] Resend API error:', errMsg, resendData)
      return NextResponse.json({ error: 'Failed to send message. Please try again or reach out directly.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[contact] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

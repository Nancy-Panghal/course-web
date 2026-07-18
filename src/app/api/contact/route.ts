import { NextRequest, NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/email'
import { supabase } from '@/lib/supabase'

const SUBJECT_LABELS: Record<string, string> = {
  billing: 'Billing / Subscription',
  technical: 'Technical Support',
  upgrade: 'Upgrade / Plan Change',
  refund: 'Refund Request',
  landing_customization: 'Landing Page Customization Request',
  other: 'Other',
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json()

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const subjectLabel = SUBJECT_LABELS[subject] || subject

    // 1. Save to the database first — this is the source of truth.
    // Even if the email below fails, we never lose the message.
    const { error: dbError } = await supabase.from('contact').insert({
      name: name.trim(),
      email: email.trim(),
      subject: subjectLabel,
      type: subject,
      message: message.trim(),
    })

    if (dbError) {
      console.error('[contact] Supabase insert error:', dbError)
    }

    // 2. Send a notification email — best effort, doesn't block the response.
    const apiKey = process.env.RESEND_API_KEY
    let emailError: string | null = null

    if (!apiKey) {
      console.error('[contact] RESEND_API_KEY is not set')
      emailError = 'Email service is not configured'
    } else {
      const safeName = escapeHtml(name.trim())
      const safeEmail = escapeHtml(email.trim())
      const safeSubject = escapeHtml(subjectLabel)
      const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br/>')

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e4e4e7;border-radius:12px;overflow:hidden;border:1px solid #27272a;">
          <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;">
            <h2 style="margin:0;font-size:20px;color:#fff;">New Contact Form Submission</h2>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Kurso — Contact Page</p>
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
            <p style="margin:0;font-size:12px;color:#52525b;">Sent via Kurso contact form · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
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
          subject: `[Kurso Contact] ${subjectLabel} — from ${name.trim()}`,
          html,
        }),
      })

      if (!resendRes.ok) {
        const resendData = await resendRes.json().catch(() => null)
        emailError = resendData?.message || resendData?.error || `Resend error ${resendRes.status}`
        console.error('[contact] Resend API error:', emailError, resendData)
      }
    }

    // Only fail the request if BOTH the database write and the email failed.
    // If the DB write succeeded, the message is safe even if email notification didn't go out.
    if (dbError && emailError) {
      return NextResponse.json({ error: 'Failed to send message. Please try again or reach out directly.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[contact] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/email'
import { supabase } from '@/lib/supabase'

const TYPE_LABELS: Record<string, string> = {
  feedback: 'General Feedback',
  feature_request: 'Feature Request',
  bug: 'Bug Report',
}

export async function POST(req: NextRequest) {
  try {
    const { type, email, message } = await req.json()

    if (!type?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const typeLabel = TYPE_LABELS[type] || type

    // 1. Save to the database first — this is the source of truth.
    const { error: dbError } = await supabase.from('feedback').insert({
      type,
      email: email.trim(),
      message: message.trim(),
    })

    if (dbError) {
      console.error('[feedback] Supabase insert error:', dbError)
    }

    // 2. Send a notification email — best effort, doesn't block the response.
    const apiKey = process.env.RESEND_API_KEY
    let emailError: string | null = null

    if (!apiKey) {
      console.error('[feedback] RESEND_API_KEY is not set')
      emailError = 'Email service is not configured'
    } else {
      const safeEmail = escapeHtml(email.trim())
      const safeType = escapeHtml(typeLabel)
      const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br/>')

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e4e4e7;border-radius:12px;overflow:hidden;border:1px solid #27272a;">
          <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;">
            <h2 style="margin:0;font-size:20px;color:#fff;">New Feedback Submission</h2>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Kurso — Feedback Page</p>
          </div>
          <div style="padding:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #27272a;width:120px;color:#a1a1aa;font-size:13px;font-weight:600;">Type</td>
                <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;">${safeType}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#a1a1aa;font-size:13px;font-weight:600;">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #27272a;font-size:14px;">
                  <a href="mailto:${safeEmail}" style="color:#8b5cf6;text-decoration:none;">${safeEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;color:#a1a1aa;font-size:13px;font-weight:600;vertical-align:top;">Message</td>
                <td style="padding:14px 0 0;color:#e4e4e7;font-size:14px;line-height:1.6;">${safeMessage}</td>
              </tr>
            </table>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #27272a;background:#050505;">
            <p style="margin:0;font-size:12px;color:#52525b;">Sent via Kurso feedback form · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
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
          subject: `[Kurso Feedback] ${typeLabel} — from ${email.trim()}`,
          html,
        }),
      })

      if (!resendRes.ok) {
        const resendData = await resendRes.json().catch(() => null)
        emailError = resendData?.message || resendData?.error || `Resend error ${resendRes.status}`
        console.error('[feedback] Resend API error:', emailError, resendData)
      }
    }

    if (dbError && emailError) {
      return NextResponse.json({ error: 'Failed to send feedback. Please try again or reach out directly.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[feedback] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}
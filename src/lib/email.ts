import { SupabaseClient } from '@supabase/supabase-js'

type EmailLogContext = {
  creatorId?: string | null
  studentId?: string | null
  courseId?: string | null
  paymentId?: string | null
  metadata?: Record<string, unknown>
}

type SendLoggedEmailInput = EmailLogContext & {
  supabase: SupabaseClient
  emailType: string
  to: string
  subject: string
  html: string
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendLoggedEmail({
  supabase,
  emailType,
  to,
  subject,
  html,
  creatorId = null,
  studentId = null,
  courseId = null,
  paymentId = null,
  metadata = {},
}: SendLoggedEmailInput) {
  const baseLog = {
    creator_id: creatorId,
    student_id: studentId,
    course_id: courseId,
    payment_id: paymentId,
    email_type: emailType,
    recipient_email: to,
    subject,
    provider: 'resend',
    metadata,
  }

  if (!process.env.RESEND_API_KEY) {
    await supabase.from('email_logs').insert({
      ...baseLog,
      status: 'skipped',
      error_message: 'RESEND_API_KEY is not configured',
    })
    return { sent: false, skipped: true }
  }

  if (!to) {
    await supabase.from('email_logs').insert({
      ...baseLog,
      recipient_email: 'missing-recipient',
      status: 'skipped',
      error_message: 'Recipient email is missing',
    })
    return { sent: false, skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'AcademyKit <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    })

    const payload = await res.json().catch(() => null)

    if (!res.ok) {
      const message = payload?.message || payload?.error || `Resend error ${res.status}`
      await supabase.from('email_logs').insert({
        ...baseLog,
        status: 'failed',
        error_message: message,
        failed_at: new Date().toISOString(),
      })
      return { sent: false, error: message }
    }

    await supabase.from('email_logs').insert({
      ...baseLog,
      status: 'sent',
      provider_message_id: payload?.id || null,
      sent_at: new Date().toISOString(),
    })

    return { sent: true, providerMessageId: payload?.id || null }
  } catch (err: any) {
    const message = err?.message || 'Email send failed'
    await supabase.from('email_logs').insert({
      ...baseLog,
      status: 'failed',
      error_message: message,
      failed_at: new Date().toISOString(),
    })
    return { sent: false, error: message }
  }
}

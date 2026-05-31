import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml, sendLoggedEmail } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
    }

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 })
    }

    const user = data.user
    const prefs = user.user_metadata?.email_notifications || {}
    if (prefs.newLogin === false) {
      return NextResponse.json({ skipped: true })
    }

    await sendLoggedEmail({
      supabase,
      emailType: 'creator_new_login',
      to: user.email || '',
      subject: 'New login to AcademyKit',
      creatorId: user.id,
      metadata: {
        login_at: new Date().toISOString(),
      },
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">New login</h2>
          <p style="margin:0 0 16px">Your AcademyKit creator account ${user.email ? `(${escapeHtml(user.email)})` : ''} just signed in.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard"
            style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
            Open dashboard
          </a>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[notifications/login]', err)
    return NextResponse.json(
      { error: err.message || 'Login notification failed' },
      { status: 500 }
    )
  }
}

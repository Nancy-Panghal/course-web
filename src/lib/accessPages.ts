// Small HTML pages for the email access flow. Same look as the Telegram "Link expired" page.
import { NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/email'

const CSS = `
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#090909; color:#fff; font-family:Arial,sans-serif; padding:24px; }
  main { width:min(440px,100%); text-align:center; border:1px solid #292929; border-radius:18px; padding:32px 24px; background:#151515; }
  h1 { margin:0 0 12px; }
  p { color:#a1a1aa; line-height:1.6; }
  .actions { display:grid; gap:10px; margin-top:22px; }
  .btn { display:block; width:100%; box-sizing:border-box; padding:12px 16px; border-radius:12px; text-decoration:none; font:inherit; font-weight:600; font-size:15px; border:1px solid #3a3a3a; color:#fff; background:transparent; cursor:pointer; }
  .btn-primary { background:#f79514; border-color:#f79514; color:#fff; }
  .note { font-size:13px; margin:14px 0 0; }
`

export function htmlResponse(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<meta name="robots" content="noindex, nofollow" /><title>${escapeHtml(title)}</title><style>${CSS}</style></head>` +
      `<body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Referrer-Policy': 'no-referrer',
      },
    }
  )
}

// "Email me a new link" form. `token` must already be validated as 64 hex chars.
export function emailRequestFormHtml(token: string, maskedEmail: string, lessonNum: number | null) {
  return (
    `<form method="POST" action="/api/web-access/request-link" style="margin:0">` +
    `<input type="hidden" name="t" value="${token}" />` +
    (lessonNum ? `<input type="hidden" name="lesson" value="${lessonNum}" />` : '') +
    `<button class="btn btn-primary" type="submit" style="width:100%;box-sizing:border-box;font:inherit;font-weight:600;font-size:15px;cursor:pointer">Email me a new link</button>` +
    `</form>` +
    `<p class="note">We'll send it to ${escapeHtml(maskedEmail)}.</p>`
  )
}

export function continuePage(i: { courseName: string; token: string; lessonNum: number | null }) {
  return htmlResponse(
    'Continue to your course',
    `<h1>Your lesson is ready</h1>` +
      `<p>Tap continue to open <strong>${escapeHtml(i.courseName)}</strong>.</p>` +
      `<form method="POST" action="/api/web-access/email" class="actions">` +
      `<input type="hidden" name="t" value="${i.token}" />` +
      (i.lessonNum ? `<input type="hidden" name="lesson" value="${i.lessonNum}" />` : '') +
      `<button class="btn btn-primary" type="submit">Continue</button>` +
      `</form>` +
      `<p class="note">This link is personal to you and works once.</p>`
  )
}

export function expiredEmailPage(i: { token?: string | null; masked?: string | null; lessonNum?: number | null }) {
  const form = i.token && i.masked ? `<div class="actions">${emailRequestFormHtml(i.token, i.masked, i.lessonNum ?? null)}</div>` : ''
  const fallback = i.masked ? '' : `<p class="note">Ask the person or bot that sent this for a new link.</p>`
  return htmlResponse(
    'Link expired',
    `<h1>Link expired</h1><p>This link has expired or has already been used.</p>${form}${fallback}`,
    410
  )
}

export function messagePage(title: string, text: string, status = 200) {
  return htmlResponse(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`, status)
}
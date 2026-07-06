import { NextResponse } from 'next/server'

// Maps any caught error to a friendly, categorized message safe to show
// a creator or student. The raw error is always logged server-side under
// `context` — it never reaches the client.

export type FriendlyErrorCategory = 'platform' | 'details' | 'bank'

function matchBankDecline(raw: string): boolean {
  const s = raw.toLowerCase()
  return (
    s.includes('card_declined') ||
    s.includes('declined') ||
    s.includes('insufficient') ||
    s.includes('do not honor') ||
    s.includes('expired card') ||
    s.includes('invalid card') ||
    s.includes('authentication failed') ||
    s.includes('bank_error') ||
    s.includes('payment failed') ||
    s.includes('gateway error')
  )
}

function matchDetailsIssue(raw: string): boolean {
  const s = raw.toLowerCase()
  return (
    s.includes('invalid') ||
    s.includes('required') ||
    s.includes('format') ||
    s.includes('missing') ||
    s.includes('coupon') ||
    s.includes('ifsc') ||
    s.includes('pan ')
  )
}

export function toFriendlyError(err: any, context: string) {
  console.error(`[${context}]`, err)

  const raw: string =
    err?.error?.description || err?.message || (typeof err === 'string' ? err : '') || ''

  if (matchBankDecline(raw)) {
    return {
      category: 'bank' as FriendlyErrorCategory,
      status: 402,
      message:
        "Your bank or card declined this payment. Please try a different card, UPI app, or bank account — or contact your bank if this keeps happening.",
    }
  }

  if (matchDetailsIssue(raw)) {
    return {
      category: 'details' as FriendlyErrorCategory,
      status: 400,
      message: 'Something in the details provided looks incorrect. Please double-check and try again.',
    }
  }

  return {
    category: 'platform' as FriendlyErrorCategory,
    status: 500,
    message:
      "Something went wrong on our end — this isn't something you did. Please try again in a moment, and contact support if it continues.",
  }
}

/** Drop-in replacement for a catch block's NextResponse.json(...) call. */
export function friendlyErrorResponse(err: any, context: string) {
  const { message, status, category } = toFriendlyError(err, context)
  return NextResponse.json({ error: message, errorCategory: category }, { status })
}
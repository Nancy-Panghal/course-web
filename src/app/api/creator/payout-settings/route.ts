/**
 * src/app/api/creator/payout-settings/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET  — returns payout settings for the authenticated creator.
 *        PAN is NEVER returned — only a boolean `has_pan`.
 *        Bank account number is NEVER returned — only last 4 digits.
 *
 * POST — saves payout settings.
 *        PAN is stored as a one-way masked value (first 3 + last char visible,
 *        rest replaced with *). We store only enough to show the creator
 *        their own entry is saved. We do not store the raw PAN.
 *        Full PAN encryption requires pgcrypto extension — use masking instead
 *        so there is no key management risk on this stack.
 *
 * Security principles:
 *   - Auth via Bearer token, verified server-side with service role key
 *   - Creator can only read/write their own record (enforced by creator_id = user.id)
 *   - PAN stored masked (e.g. MAK*****2K) — never raw, never returned
 *   - Account number stored as last4 only — full number never persisted
 *   - IFSC stored (not sensitive)
 *   - UPI stored (semi-sensitive — displayed masked on read)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Mask PAN: ABCDE1234F → ABC*****4F */
function maskPan(pan: string): string {
  const clean = pan.toUpperCase().replace(/\s/g, '')
  if (clean.length < 4) return '****'
  return clean.slice(0, 3) + '*'.repeat(Math.max(clean.length - 4, 1)) + clean.slice(-1)
}

/** Validate PAN format: 5 letters + 4 digits + 1 letter */
function isValidPan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase().replace(/\s/g, ''))
}

/** Validate IFSC: 4 letters + 0 + 6 alphanumeric */
function isValidIfsc(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase().replace(/\s/g, ''))
}

/** Mask UPI: show first 3 chars and domain */
function maskUpi(upi: string): string {
  const atIdx = upi.indexOf('@')
  if (atIdx < 0) return upi.slice(0, 3) + '****'
  const handle = upi.slice(0, atIdx)
  const domain = upi.slice(atIdx)
  const visible = handle.slice(0, Math.min(3, handle.length))
  return visible + '*'.repeat(Math.max(handle.length - 3, 1)) + domain
}

// ── GET ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getCreator(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('creators')
      .select(
        'payout_account_holder, payout_bank_account_last4, payout_ifsc, payout_upi_id, payout_account_status, payout_setup_at, pan_encrypted'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({
        accountHolder: '',
        bankLast4: '',
        ifsc: '',
        upiMasked: '',
        hasPan: false,
        panMasked: '',
        status: 'not_set',
        setupAt: null,
      })
    }

    return NextResponse.json({
      accountHolder: data.payout_account_holder || '',
      bankLast4: data.payout_bank_account_last4 || '',
      ifsc: data.payout_ifsc || '',
      // Mask UPI before sending to client
      upiMasked: data.payout_upi_id ? maskUpi(data.payout_upi_id) : '',
      hasPan: !!data.pan_encrypted,
      // Return the already-masked PAN (safe to display)
      panMasked: data.pan_encrypted || '',
      status: data.payout_account_status || 'not_set',
      setupAt: data.payout_setup_at || null,
    })
  } catch (err: any) {
    console.error('[payout-settings GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getCreator(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      accountHolder,
      bankAccountNumber, // full number — we only store last4, never persisted in full
      ifsc,
      upiId,
      pan,
    } = body as {
      accountHolder?: string
      bankAccountNumber?: string
      ifsc?: string
      upiId?: string
      pan?: string
    }

    const errors: string[] = []

    // At least one payment method required
    const hasBankDetails = accountHolder?.trim() && bankAccountNumber?.trim() && ifsc?.trim()
    const hasUpi = upiId?.trim()

    if (!hasBankDetails && !hasUpi) {
      errors.push('Provide either bank account details (holder name + account number + IFSC) or a UPI ID.')
    }

    if (bankAccountNumber?.trim()) {
      if (bankAccountNumber.trim().length < 9 || bankAccountNumber.trim().length > 18) {
        errors.push('Bank account number must be 9–18 digits.')
      }
      if (!/^\d+$/.test(bankAccountNumber.trim())) {
        errors.push('Bank account number must contain only digits.')
      }
    }

    if (ifsc?.trim() && !isValidIfsc(ifsc.trim())) {
      errors.push('IFSC code format is invalid (e.g. HDFC0001234).')
    }

    // PAN validation (required for KYC)
    let panMasked: string | undefined
    if (pan?.trim()) {
      if (!isValidPan(pan.trim())) {
        errors.push('PAN format is invalid. Expected format: ABCDE1234F')
      } else {
        panMasked = maskPan(pan.trim())
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 })
    }

    // Build update payload — never store full account number
    const updates: Record<string, any> = {
      payout_account_status: 'pending_verification',
      payout_setup_at: new Date().toISOString(),
    }

    if (accountHolder?.trim()) updates.payout_account_holder = accountHolder.trim()
    if (bankAccountNumber?.trim()) {
      // Store ONLY the last 4 digits
      updates.payout_bank_account_last4 = bankAccountNumber.trim().slice(-4)
    }
    if (ifsc?.trim()) updates.payout_ifsc = ifsc.trim().toUpperCase()
    if (upiId?.trim()) updates.payout_upi_id = upiId.trim().toLowerCase()
    if (panMasked) updates.pan_encrypted = panMasked // stored as mask, not raw

    const { error: updateError } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({
      ok: true,
      status: 'pending_verification',
      bankLast4: bankAccountNumber?.trim().slice(-4) || '',
      panMasked: panMasked || '',
    })
  } catch (err: any) {
    console.error('[payout-settings POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

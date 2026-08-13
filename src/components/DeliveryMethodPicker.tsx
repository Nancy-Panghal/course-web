'use client'
/**
 * src/components/DeliveryMethodPicker.tsx
 * ─────────────────────────────────────────────────────────────────
 * Plan-aware delivery-method selector, shared by create-course and
 * the course settings "Delivery" section.
 *
 * - Options at or below the creator's current plan: free to pick.
 * - Options above it: shows "Pay ₹X to unlock" — clicking pays the
 *   plan delta inline via Cashfree, then selects it on success.
 * - Never charges based on client-side math — the amount shown is
 *   read from SUBSCRIPTION_PLANS and re-verified server-side in
 *   create-subscription-order.
 * ─────────────────────────────────────────────────────────────────
 */
import { useState } from 'react'
import { Send, MessageCircle, Globe, Loader2 } from 'lucide-react'
import {
  SUBSCRIPTION_PLANS, PLAN_ORDER, type SubscriptionPlanId,
} from '@/app/api/razorpay/subscription-plans'
import { payForPlan } from '@/lib/kurso-checkout'

const OPTION_META: Record<SubscriptionPlanId, { label: string; desc: string; icon: any }> = {
  telegram: { label: 'Web + Telegram', desc: 'Lessons delivered via your Telegram bot', icon: Send },
  whatsapp: { label: 'Web + WhatsApp', desc: 'Lessons delivered via WhatsApp messages', icon: MessageCircle },
  both: { label: 'Web + WhatsApp + Telegram', desc: 'Students can learn on either bot', icon: Globe },
}

export default function DeliveryMethodPicker({
  value,
  onChange,
  currentPlanId,
  onUpgraded,
  disabled,
}: {
  value: SubscriptionPlanId | string
  onChange: (id: SubscriptionPlanId) => void
  /** Creator's currently-covered plan, or null if nothing is unlocked yet (no active plan, trial expired). */
  currentPlanId: SubscriptionPlanId | null
  /** Called after a successful inline upgrade payment, with the new plan id. */
  onUpgraded?: (newPlanId: SubscriptionPlanId) => void
  disabled?: boolean
}) {
  const [payingFor, setPayingFor] = useState<SubscriptionPlanId | null>(null)
  const [error, setError] = useState('')

  const currentRank = currentPlanId ? PLAN_ORDER.indexOf(currentPlanId) : -1

  async function handlePick(optId: SubscriptionPlanId) {
    if (disabled || payingFor) return
    const rank = PLAN_ORDER.indexOf(optId)
    if (rank <= currentRank) {
      onChange(optId)
      return
    }
    // Above current plan — pay the difference before selecting it.
    setError('')
    setPayingFor(optId)
    const result = await payForPlan(optId)
    setPayingFor(null)
    if (result.ok) {
      onChange(optId)
      onUpgraded?.(optId)
    } else {
      setError(result.error)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_ORDER.map(optId => {
          const meta = OPTION_META[optId]
          const Icon = meta.icon
          const active = value === optId
          const rank = PLAN_ORDER.indexOf(optId)
          const locked = rank > currentRank
          const delta = currentPlanId
            ? SUBSCRIPTION_PLANS[optId].amount - SUBSCRIPTION_PLANS[currentPlanId].amount
            : SUBSCRIPTION_PLANS[optId].amount
          const isPaying = payingFor === optId
          return (
            <button key={optId} type="button"
              onClick={() => handlePick(optId)}
              disabled={disabled || !!payingFor}
              className="p-4 rounded-xl text-left transition-all relative disabled:opacity-60"
              style={{
                background: active ? 'rgba(var(--kurso-primary-rgb), 0.15)' : 'rgba(255,255,255,0.03)',
                border: active ? '2px solid rgba(var(--kurso-primary-rgb), 0.5)' : '1px solid rgba(255,255,255,0.08)',
              }}>
              <Icon className="w-5 h-5 mb-2" style={{ color: active ? 'var(--kurso-primary-light)' : '#52525b' }} />
              <p className="text-sm font-medium" style={{ color: active ? '#fff' : '#a1a1aa' }}>{meta.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{meta.desc}</p>
              {locked && (
                <p className="text-xs mt-2 font-semibold flex items-center gap-1.5" style={{ color: '#facc15' }}>
                  {isPaying ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {payingFor === optId ? 'Confirming payment…' : ''}
                    </>
                  ) : (
                    `🔒 Pay ₹${delta.toLocaleString()} to unlock`
                  )}
                </p>
              )}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

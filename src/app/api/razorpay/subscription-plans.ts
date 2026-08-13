export const SUBSCRIPTION_PLANS = {
  telegram: {
    id: 'telegram',
    name: 'Web + Telegram',
    amount: 2500,
    deliveryMethod: 'telegram',
    rank: 1,
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'Web + WhatsApp',
    amount: 3500,
    deliveryMethod: 'whatsapp',
    rank: 2,
  },
  both: {
    id: 'both',
    name: 'Web + WhatsApp + Telegram',
    amount: 4000,
    deliveryMethod: 'both',
    rank: 3,
  },
} as const

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS

export function getSubscriptionPlan(planId: unknown) {
  if (typeof planId !== 'string') return null
  return SUBSCRIPTION_PLANS[planId as SubscriptionPlanId] || null
}

// Cheapest → most expensive. Used for upgrade/downgrade comparisons and
// delta-payment math — never hardcode plan amounts elsewhere, read from here.
export const PLAN_ORDER: SubscriptionPlanId[] = ['telegram', 'whatsapp', 'both']

/** Does this plan tier permit a course to use the given delivery method? */
export function planCoversDeliveryMethod(
  planId: string | null | undefined,
  deliveryMethod: 'telegram' | 'whatsapp' | 'both'
) {
  const plan = getSubscriptionPlan(planId)
  if (!plan) return false
  if (plan.id === 'both') return true
  return plan.id === deliveryMethod
}
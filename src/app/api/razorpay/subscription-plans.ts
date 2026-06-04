export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    amount: 1999,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    amount: 4999,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    amount: 12999,
  },
} as const

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS

export function getSubscriptionPlan(planId: unknown) {
  if (typeof planId !== 'string') return null
  return SUBSCRIPTION_PLANS[planId as SubscriptionPlanId] || null
}

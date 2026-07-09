// Central place to turn on Razorpay Route creator onboarding once it's approved.
// Until then, everything here returns "not available" and the UI shows a
// calm "opening soon" state instead of a broken button.
//
// When Route is approved, come back here and:
//  1. Set RAZORPAY_ROUTE_LIVE=true in your env vars
//  2. Implement getOnboardingUrl() below — either:
//       (a) call Razorpay's Create Linked Account API and return their
//           hosted KYC link for this creator, or
//       (b) return a static Razorpay-hosted onboarding link, if that's
//           what your account tier gives you
//     Ask Razorpay support which one applies to you when you request Route.

export function isRouteLive(): boolean {
  return process.env.RAZORPAY_ROUTE_LIVE === 'true'
}

export async function getOnboardingUrl(creatorId: string): Promise<string | null> {
  if (!isRouteLive()) return null
  // TODO: wire this up once Route is approved
  return null
}
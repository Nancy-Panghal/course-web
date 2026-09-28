// src/lib/checkout-client.ts
// Browser-side helpers for the Cashfree / Razorpay checkout SDKs and the
// order-status poll. Same behaviour as the copies inside EbookPageClient.tsx,
// except Cashfree uses the mode the server returns (the ebook copy hardcodes
// 'production', which breaks sandbox creators).

export async function loadCashfreeSdk(mode: 'sandbox' | 'production'): Promise<any> {
  const cacheKey = `__cashfreeInstance_${mode}`
  if ((window as any)[cacheKey]) return (window as any)[cacheKey]
  if (!(window as any).Cashfree) {
    await new Promise<void>((resolve, reject) => {
      if (document.getElementById('cashfree-sdk-script')) return resolve()
      const script = document.createElement('script')
      script.id = 'cashfree-sdk-script'
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load the payment SDK. Check your connection and try again.'))
      document.body.appendChild(script)
    })
  }
  const instance = (window as any).Cashfree({ mode })
  ;(window as any)[cacheKey] = instance
  return instance
}

export async function loadRazorpaySdk(): Promise<void> {
  if ((window as any).Razorpay) return
  await new Promise<void>((resolve, reject) => {
    if (document.getElementById('razorpay-sdk-script')) return resolve()
    const script = document.createElement('script')
    script.id = 'razorpay-sdk-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load the payment SDK. Check your connection and try again.'))
    document.body.appendChild(script)
  })
}

export async function pollOrderStatus(clientTxnId: string, attemptsLeft = 8): Promise<string | null> {
  if (attemptsLeft <= 0) return null
  const res = await fetch(`/api/order-status?clientTxnId=${clientTxnId}`)
  const data = await res.json().catch(() => null)
  if (data?.status === 'success') return data.status
  await new Promise((r) => setTimeout(r, 2000))
  return pollOrderStatus(clientTxnId, attemptsLeft - 1)
}
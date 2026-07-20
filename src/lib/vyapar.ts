import crypto from 'crypto'

const VYAPAR_BASE_URL = 'https://vyapargateway.com'

export class VyaparError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export type VyaparOrder = {
  order_id: string
  client_txn_id: string
  amount: number
  currency: string
  status: string
  expires_at: string
  expires_in: string
  qr_code: string
  upi_string: string
  upi_intent: { bhim_link: string; phonepe_link: string; paytm_link: string; gpay_link: string }
  merchant_upi_id: string
  merchant_name: string
}

export async function createVyaparOrder(params: {
  apiKey: string
  amount: number
  clientTxnId: string
  customerName?: string
  customerMobile?: string
  customerEmail?: string
  pInfo?: string
  callbackUrl: string
  redirectUrl?: string
}): Promise<VyaparOrder> {
  const res = await fetch(`${VYAPAR_BASE_URL}/api/v1/create_order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': params.apiKey },
    body: JSON.stringify({
      client_txn_id: params.clientTxnId,
      amount: params.amount,
      p_info: params.pInfo || 'Kurso payment',
      customer_name: params.customerName || 'Customer',
      customer_mobile: params.customerMobile,
      customer_email: params.customerEmail,
      callback_url: params.callbackUrl,
      redirect_url: params.redirectUrl,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status) {
    throw new VyaparError(json?.msg || `Vyapar Gateway error (${res.status})`, res.status)
  }
  return json.data
}

export function verifyVyaparSignature(params: {
  timestamp: string
  rawBody: string
  secret: string
  signature: string
}): boolean {
  const stringToSign = `${params.timestamp}.${params.rawBody}`
  const expected = crypto.createHmac('sha256', params.secret).update(stringToSign).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(params.signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
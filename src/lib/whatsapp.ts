export function cleanWhatsAppNumber(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '')
}

export function buildWhatsAppLink(phone: string, text: string): string {
  const clean = cleanWhatsAppNumber(phone)
  if (!clean) return ''
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export function buildWhatsAppStartLink(phone: string, token: string): string {
  return buildWhatsAppLink(phone, `/start ${token}`)
}

export function buildWhatsAppDoneLink(phone: string, lessonNumber: number): string {
  return buildWhatsAppLink(phone, `/start done_${lessonNumber}`)
}

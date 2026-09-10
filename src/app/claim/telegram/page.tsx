'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { createMessagingToken, saveMessagingToken, buildDeepLink } from '@/lib/messagingTokens'

type LookupResult = {
  found: boolean
  reason?: string
  alreadyLinked?: boolean
  enrollmentId?: string
  creatorId?: string
  courseId?: string
  courseName?: string
  studentName?: string | null
  studentPhone?: string | null
  studentEmail?: string | null
  paymentId?: string | null
  telegramBotUsername?: string
}

function ClaimTelegramInner() {
  const searchParams = useSearchParams()
  const courseId = searchParams.get('course') || ''

  const [identifierType, setIdentifierType] = useState<'phone' | 'email'>('phone')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setDeepLink(null)

    if (!courseId) {
      setError('This link is missing course information. Please ask your instructor for the correct link.')
      return
    }
    if (!value.trim()) {
      setError(`Please enter your ${identifierType === 'phone' ? 'phone number' : 'email address'}.`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/enrollments/find-migrated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          phone: identifierType === 'phone' ? value.trim() : undefined,
          email: identifierType === 'email' ? value.trim() : undefined,
        }),
      })
      const data: LookupResult = await res.json()

      if (!data.found) {
        setError(
          data.reason ||
          "We couldn't find a paid enrollment with that detail for this course. Double-check what you entered, or ask your instructor to confirm you've been added."
        )
        setLoading(false)
        return
      }

      setResult(data)

      if (!data.alreadyLinked) {
        setLinking(true)
        const stored = await createMessagingToken('telegram', {
          studentPhone: data.studentPhone || undefined,
          studentEmail: data.studentEmail || undefined,
          studentName: data.studentName || undefined,
          creatorId: data.creatorId!,
          courseId: data.courseId!,
        })
        if (stored.token && data.enrollmentId) {
          await saveMessagingToken('telegram', data.enrollmentId, stored)
          const link = buildDeepLink('telegram', stored.token, { telegramBotUsername: data.telegramBotUsername })
          setDeepLink(link)
        } else {
          setError('Could not generate your Telegram link right now. Please try again in a moment.')
        }
        setLinking(false)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const botLink = result?.telegramBotUsername ? `https://t.me/${result.telegramBotUsername}` : null

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050505' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}>

        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-5 h-5" style={{ color: '#229ED9' }} />
          <h1 className="text-white font-semibold text-lg">Get your course on Telegram</h1>
        </div>
        <p className="text-sm mb-5" style={{ color: '#a1a1aa' }}>
          Enter the phone number or email your instructor already has on file for you — we'll confirm
          your enrollment and give you a link to start your lessons on Telegram.
        </p>

        {!result && (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setIdentifierType('phone')}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: identifierType === 'phone' ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.05)',
                  color: identifierType === 'phone' ? '#fff' : '#a1a1aa',
                }}>
                Phone number
              </button>
              <button type="button" onClick={() => setIdentifierType('email')}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: identifierType === 'email' ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.05)',
                  color: identifierType === 'email' ? '#fff' : '#a1a1aa',
                }}>
                Email
              </button>
            </div>

            <input
              type={identifierType === 'phone' ? 'tel' : 'email'}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={identifierType === 'phone' ? '10-digit mobile number' : 'you@example.com'}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none mb-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />

            {error && (
              <div className="p-3 rounded-xl text-sm mb-3 flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--kurso-primary)' }}>
              {loading ? 'Checking...' : 'Find my enrollment'}
            </button>
          </form>
        )}

        {result?.found && (
          <div>
            <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: '#4ade80' }}>
              <CheckCircle2 className="w-4 h-4" />
              Found your enrollment{result.courseName ? ` for ${result.courseName}` : ''}.
            </div>

            {result.alreadyLinked ? (
              <>
                <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>
                  Your Telegram is already linked. Just open your chat with the bot and send any message
                  to get your lessons.
                </p>
                {botLink && (
                  <a href={botLink} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white hover:opacity-90"
                    style={{ background: '#229ED9' }}>
                    <MessageCircle className="w-5 h-5" />
                    Open Telegram bot
                  </a>
                )}
              </>
            ) : linking ? (
              <div className="text-sm text-center py-3 animate-pulse" style={{ color: '#a1a1aa' }}>
                Preparing your Telegram link...
              </div>
            ) : deepLink ? (
              <a href={deepLink} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white hover:opacity-90"
                style={{ background: '#229ED9' }}>
                <MessageCircle className="w-5 h-5" />
                Continue on Telegram
              </a>
            ) : error ? (
              <div className="p-3 rounded-xl text-sm flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClaimTelegramPage() {
  return (
    <Suspense fallback={null}>
      <ClaimTelegramInner />
    </Suspense>
  )
}
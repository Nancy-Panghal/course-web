/**
 * src/app/enroll/[courseId]/page.tsx
 *
 * Standalone Kurso checkout page. Purpose: creators who already have their
 * OWN landing page (their own design, wherever it's hosted) can just drop
 * this single URL in as their "Buy Now" / payment link, instead of using
 * Kurso's auto-generated /about-course marketing page.
 *
 * This page does NOT try to look like a full marketing page — it is
 * deliberately minimal (name, price, trust badges, one CTA) so it works no
 * matter what the creator's own page looks like. It reuses the exact same
 * courseData shape as /about-course, and the same CoursePageClient +
 * EnrollModal + DraftGate infra, so payment, auth, coupons, already-enrolled
 * detection, and owner detection all behave identically to the main flow —
 * only the surrounding page chrome is different.
 *
 * Route is intentionally slug-free (just courseId) so it's a short, stable
 * link a creator can paste once and never have to update.
 */

import { Shield, CheckCircle, Lock } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CoursePageClient from '@/components/CoursePageClient'
import DraftGate from '@/components/DraftGate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course || courseError) notFound()

  const { data: creatorProfile } = await supabase
    .from('creators')
    .select('id, name, whatsapp_number, telegram_bot_username, creator_slug')
    .eq('id', course.creator_id)
    .single()

  // Same shape CoursePageClient/DraftGate already expect — keeps this page
  // wired into the exact same enrollment logic as the main landing page.
  const courseData = {
    id: course.id,
    name: course.name,
    price: course.price,
    creatorSlug: course.slug,
    creatorName: course.host_name || creatorProfile?.name || '',
    creatorId: creatorProfile?.id || '',
    telegramBotUsername:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || creatorProfile?.telegram_bot_username || '',
    is_free_course: course.is_free_course ?? false,
  }

  const brandName = course.brand_name || course.host_name || creatorProfile?.name || 'the creator'

  return (
    <DraftGate isPublished={course.is_published !== false} courseData={courseData}>
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div
            style={{
              background: '#111113',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: '36px 28px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#71717a',
                marginBottom: 10,
              }}
            >
              {brandName}
            </p>

            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.3,
                marginBottom: 8,
              }}
            >
              {course.name}
            </h1>

            <p
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--kurso-primary-light)',
                marginBottom: 24,
              }}
            >
              ₹{Number(course.price).toLocaleString()}
            </p>

            <div style={{ marginBottom: 24 }}>
              <CoursePageClient course={courseData} variant="cta" />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                textAlign: 'left',
                fontSize: 13,
                color: '#a1a1aa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)', flexShrink: 0 }} />
                Secure payment — you're never redirected to a third-party form
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)', flexShrink: 0 }} />
                Instant access delivered on WhatsApp & Telegram
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock className="w-4 h-4" style={{ color: 'var(--kurso-primary-light)', flexShrink: 0 }} />
                Content is watermarked and protected against sharing
              </div>
            </div>
          </div>

          <Link
            href="/"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 18,
              fontSize: 12,
              color: '#52525b',
              textDecoration: 'none',
            }}
          >
            Checkout secured by Kurso
          </Link>
        </div>
      </div>
    </DraftGate>
  )
}
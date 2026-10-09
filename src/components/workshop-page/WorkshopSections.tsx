// src/components/workshop-page/WorkshopSections.tsx
//
// The content sections of the public workshop page, one renderer per
// WorkshopSectionType (lib/workshop-landing-config.ts). Server components:
// everything is plain React text/attributes (no innerHTML), so creator-written
// content can never inject markup.
//
// RULE: a section with nothing to show renders NOTHING (same rule the settings
// designer shows with "Nothing added yet"), so the page never has hollow headings.
//
// Text sizes use .ws-body / .ws-small (defined by the page) so the creator's
// Standard / Large choice applies everywhere. Nothing is smaller than 14px.

import type { ReactNode } from 'react'
import { BarChart3, Calendar, Check, Clock, Gift, Globe, Star } from 'lucide-react'
import { getVideoEmbedUrl, type LandingCustomSection } from '@/lib/landing-config'
import type { LandingThemeColors } from '@/lib/landing-themes/types'
import type { WorkshopAgendaItem, WorkshopLandingConfig, WorkshopSectionEntry } from '@/lib/workshop-landing-config'
import type { WorkshopCoHost, WorkshopFaqItem, WorkshopTestimonial } from '@/lib/workshop-validation'
import { workshopSectionHasContent } from '@/lib/workshop-landing-config'
import { formatWorkshopDuration } from '@/lib/workshops'
import type { WorkshopDateParts } from '@/lib/workshop-page'

type C = LandingThemeColors

export type WorkshopPageData = {
  startsAt: WorkshopDateParts
  durationMinutes: number | null
  languages: string[]
  level: string | null
  videoUrls: string[]
  videoHeading: string | null
  takeaways: string[]
  agenda: WorkshopAgendaItem[]
  hostName: string
  hostTitle: string | null
  hostImage: string | null
  aboutHost: string | null
  coHosts: WorkshopCoHost[]
  audience: string[]
  bring: string[]
  testimonials: WorkshopTestimonial[]
  faq: WorkshopFaqItem[]
}

const cardStyle = (c: C) => ({ background: c.cardBg, border: `1px solid ${c.borderSoft}`, borderRadius: '1rem' })

function Section({ c, title, children }: { c: C; title: string; children: ReactNode }) {
  return (
    <section className="mb-12 md:mb-14">
      <h2 className="ws-heading text-2xl md:text-3xl font-bold mb-5" style={{ color: c.textPrimary }}>{title}</h2>
      {children}
    </section>
  )
}

function CheckList({ c, items, ordered }: { c: C; items: string[]; ordered?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 ws-body" style={{ color: 'var(--ws-secondary)' }}>
          <span className="mt-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: c.accentGradient }}>
            {ordered ? <span className="text-[11px] font-bold text-white">{i + 1}</span> : <Check className="w-3 h-3 text-white" />}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Quick facts ────────────────────────────────────────────────────────────

function QuickFacts({ c, d }: { c: C; d: WorkshopPageData }) {
  const facts: { icon: ReactNode; label: string; value: string }[] = [
    { icon: <Calendar className="w-5 h-5" />, label: 'Date', value: `${d.startsAt.weekday}, ${d.startsAt.date}` },
    { icon: <Clock className="w-5 h-5" />, label: 'Time', value: `${d.startsAt.time} IST${d.durationMinutes ? ` · ${formatWorkshopDuration(d.durationMinutes)}` : ''}` },
  ]
  if (d.languages.length) facts.push({ icon: <Globe className="w-5 h-5" />, label: 'Language', value: d.languages.join(', ') })
  if (d.level) facts.push({ icon: <BarChart3 className="w-5 h-5" />, label: 'Level', value: d.level })
  return (
    <section className="mb-12 md:mb-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {facts.map(f => (
          <div key={f.label} className="p-4 flex items-start gap-3" style={cardStyle(c)}>
            <span className="mt-0.5" style={{ color: c.accentText }}>{f.icon}</span>
            <div className="min-w-0">
              <p className="ws-small font-medium" style={{ color: 'var(--ws-muted)' }}>{f.label}</p>
              <p className="ws-body font-semibold" style={{ color: c.textPrimary }}>{f.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Videos ─────────────────────────────────────────────────────────────────

function Videos({ c, d }: { c: C; d: WorkshopPageData }) {
  const embeds = d.videoUrls.map(u => getVideoEmbedUrl(u)).filter((u): u is string => !!u)
  if (embeds.length === 0) return null
  return (
    <Section c={c} title={d.videoHeading || 'Watch a preview'}>
      <div className="flex flex-col gap-5">
        {embeds.map((src, i) => (
          <div key={i} className="w-full overflow-hidden" style={{ ...cardStyle(c), aspectRatio: '16 / 9' }}>
            <iframe src={src} title={`Workshop video ${i + 1}`} loading="lazy" className="w-full h-full border-0"
              allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

function Agenda({ c, items }: { c: C; items: WorkshopAgendaItem[] }) {
  return (
    <Section c={c} title="Agenda">
      <ol className="flex flex-col gap-4">
        {items.filter(i => i.title).map((item, i) => (
          <li key={i} className="p-4 flex items-start gap-4" style={cardStyle(c)}>
            <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: c.accentGradient }}>{i + 1}</span>
            <div className="min-w-0">
              <p className="ws-body font-semibold" style={{ color: c.textPrimary }}>{item.title}</p>
              {item.description && <p className="ws-small mt-1" style={{ color: 'var(--ws-secondary)' }}>{item.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// ─── Host ───────────────────────────────────────────────────────────────────

function Person({ c, name, title, image, bio, rectangle, large }: {
  c: C; name: string; title?: string | null; image?: string | null; bio?: string | null; rectangle: boolean; large: boolean
}) {
  const size = large ? 'w-28 h-28' : 'w-16 h-16'
  const shape = rectangle ? 'rounded-xl' : 'rounded-full'
  return (
    <div className="p-5 flex items-start gap-4" style={cardStyle(c)}>
      {image ? (
        <img src={image} alt={name} loading="lazy" className={`${size} ${shape} object-cover shrink-0`} style={{ border: `1px solid ${c.borderSoft}` }} />
      ) : (
        <div className={`${size} ${shape} shrink-0 flex items-center justify-center text-xl font-bold text-white`} style={{ background: c.accentGradient }}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="ws-body font-semibold" style={{ color: c.textPrimary }}>{name}</p>
        {title && <p className="ws-small" style={{ color: c.accentText }}>{title}</p>}
        {bio && <p className="ws-small mt-2 whitespace-pre-line" style={{ color: 'var(--ws-secondary)' }}>{bio}</p>}
      </div>
    </div>
  )
}

function Hosts({ c, d, config }: { c: C; d: WorkshopPageData; config: WorkshopLandingConfig }) {
  const rectangle = config.instructorLayout === 'rectangle'
  return (
    <Section c={c} title={d.coHosts.length ? 'Meet your hosts' : 'Meet your host'}>
      <div className="flex flex-col gap-4">
        <Person c={c} name={d.hostName} title={d.hostTitle} image={d.hostImage} bio={d.aboutHost} rectangle={rectangle} large />
        {d.coHosts.map((h, i) => (
          <Person key={i} c={c} name={h.name} title={h.title} image={h.image} bio={h.bio} rectangle={rectangle} large={false} />
        ))}
      </div>
    </Section>
  )
}

// ─── Bonuses, testimonials, FAQ, custom, how-to-join, disclaimer ────────────

function Bonuses({ c, config }: { c: C; config: WorkshopLandingConfig }) {
  return (
    <Section c={c} title="Bonuses included">
      <div className="grid gap-3 sm:grid-cols-2">
        {config.bonuses.filter(b => b.title).map((b, i) => (
          <div key={i} className="p-4 flex items-start gap-3" style={cardStyle(c)}>
            <span className="mt-0.5 shrink-0" style={{ color: c.accentText }}><Gift className="w-5 h-5" /></span>
            <div className="min-w-0">
              <p className="ws-body font-semibold" style={{ color: c.textPrimary }}>{b.title}</p>
              {b.description && <p className="ws-small mt-1" style={{ color: 'var(--ws-secondary)' }}>{b.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Testimonials({ c, items }: { c: C; items: WorkshopTestimonial[] }) {
  return (
    <Section c={c} title="What people say">
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((t, i) => t.type === 'screenshot' ? (
          <div key={i} className="overflow-hidden" style={cardStyle(c)}>
            <img src={t.image_url} alt="Attendee feedback" loading="lazy" className="w-full h-auto" />
          </div>
        ) : (
          <figure key={i} className="p-5 flex flex-col gap-3" style={cardStyle(c)}>
            <div className="flex gap-0.5" role="img" aria-label={`${t.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-4 h-4" style={{ color: c.accentText }} fill={s <= t.rating ? 'currentColor' : 'none'} />
              ))}
            </div>
            <blockquote className="ws-body whitespace-pre-line" style={{ color: 'var(--ws-secondary)' }}>{t.text}</blockquote>
            <figcaption className="flex items-center gap-3 mt-auto">
              {t.photo_url && <img src={t.photo_url} alt="" loading="lazy" className="w-9 h-9 rounded-full object-cover" />}
              <span className="ws-small font-semibold" style={{ color: c.textPrimary }}>{t.name}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}

function Faq({ c, items }: { c: C; items: WorkshopFaqItem[] }) {
  return (
    <Section c={c} title="Frequently asked questions">
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <details key={i} className="ws-faq group" style={cardStyle(c)}>
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-4 ws-body font-semibold" style={{ color: c.textPrimary }}>
              <span>{item.question}</span>
              <span className="ws-faq-icon shrink-0" aria-hidden style={{ color: c.accentText }} />
            </summary>
            <p className="px-4 pb-4 ws-body whitespace-pre-line" style={{ color: 'var(--ws-secondary)' }}>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

const HEADING_SIZE = { sm: '1.25rem', md: '1.75rem', lg: '2.25rem' } as const
const BODY_SIZE = { sm: '0.9375rem', md: '1.0625rem', lg: '1.25rem' } as const
const SPACING = { compact: '0.5rem', normal: '1.5rem', roomy: '3rem' } as const

function CustomBlock({ c, cs }: { c: C; cs: LandingCustomSection }) {
  const center = cs.align === 'center'
  const card = cs.style === 'card'
  return (
    <section className="mb-12 md:mb-14" style={{ paddingTop: SPACING[cs.spacing], paddingBottom: SPACING[cs.spacing] }}>
      <div className={card ? 'p-6 md:p-8' : ''} style={{ ...(card ? cardStyle(c) : {}), textAlign: center ? 'center' : 'left' }}>
        {cs.heading && (
          <h2 className="ws-heading font-bold mb-4" style={{ color: c.textPrimary, fontSize: HEADING_SIZE[cs.headingSize] }}>{cs.heading}</h2>
        )}
        {cs.body && (
          <p className="whitespace-pre-line" style={{ color: 'var(--ws-secondary)', fontSize: BODY_SIZE[cs.bodySize], lineHeight: 1.7 }}>{cs.body}</p>
        )}
        {cs.images.length > 0 && (
          <div className="grid gap-3 mt-5 sm:grid-cols-2">
            {cs.images.map(url => <img key={url} src={url} alt="" loading="lazy" className="w-full h-auto rounded-xl" />)}
          </div>
        )}
      </div>
    </section>
  )
}

function HowToJoin({ c }: { c: C }) {
  const steps = [
    ['Register', 'Fill in your name and WhatsApp number. For paid workshops, complete the payment too.'],
    ['Get the joining link', 'Once your seat is confirmed, the link is sent to your WhatsApp.'],
    ['Join live', 'Open the link at the start time and join the session.'],
  ]
  return (
    <Section c={c} title="How to join">
      <ol className="flex flex-col gap-3">
        {steps.map(([title, text], i) => (
          <li key={i} className="p-4 flex items-start gap-4" style={cardStyle(c)}>
            <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: c.accentGradient }}>{i + 1}</span>
            <div>
              <p className="ws-body font-semibold" style={{ color: c.textPrimary }}>{title}</p>
              <p className="ws-small mt-0.5" style={{ color: 'var(--ws-secondary)' }}>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

function Disclaimer({ c, config }: { c: C; config: WorkshopLandingConfig }) {
  return (
    <section className="mb-12 md:mb-14 p-5" style={cardStyle(c)}>
      <p className="ws-body font-semibold mb-2" style={{ color: c.textPrimary }}>{config.disclaimer.title}</p>
      <p className="ws-small whitespace-pre-line" style={{ color: 'var(--ws-secondary)' }}>{config.disclaimer.text}</p>
    </section>
  )
}

// ─── One entry of the ordered section list ──────────────────────────────────

/** Renders the section for one entry, or null when it has nothing to show. */
export function renderWorkshopSection(entry: WorkshopSectionEntry, c: C, d: WorkshopPageData, config: WorkshopLandingConfig, key: string): ReactNode {
  const has = workshopSectionHasContent(entry.type, {
    videoUrls: d.videoUrls.filter(u => getVideoEmbedUrl(u)),
    takeaways: d.takeaways, agenda: d.agenda, audience: d.audience, bring: d.bring,
    bonuses: config.bonuses, testimonialCount: d.testimonials.length, faqCount: d.faq.length,
    disclaimerText: config.disclaimer.text,
  })
  if (!has) return null

  switch (entry.type) {
    case 'stats': return <QuickFacts key={key} c={c} d={d} />
    case 'videos': return <Videos key={key} c={c} d={d} />
    case 'learn': return <Section key={key} c={c} title="What you'll learn"><CheckList c={c} items={d.takeaways} /></Section>
    case 'agenda': return <Agenda key={key} c={c} items={d.agenda} />
    case 'instructor': return <Hosts key={key} c={c} d={d} config={config} />
    case 'target': return <Section key={key} c={c} title="Who this is for"><CheckList c={c} items={d.audience} /></Section>
    case 'bonuses': return <Bonuses key={key} c={c} config={config} />
    case 'testimonials': return <Testimonials key={key} c={c} items={d.testimonials} />
    case 'faq': return <Faq key={key} c={c} items={d.faq} />
    case 'requirements': return <Section key={key} c={c} title="What to bring"><CheckList c={c} items={d.bring} /></Section>
    case 'howToJoin': return <HowToJoin key={key} c={c} />
    case 'disclaimer': return <Disclaimer key={key} c={c} config={config} />
    case 'custom': {
      const cs = config.customSections.find(x => x.id === entry.customId)
      return cs && (cs.heading || cs.body || cs.images.length) ? <CustomBlock key={key} c={c} cs={cs} /> : null
    }
    default: return null // 'hero' and 'finalCta' are pinned by the page itself
  }
}
'use client'
// src/components/WorkshopDesignFields.tsx
//
// Design controls for the workshop settings: theme picker, font picker, the
// ordered section list, bonuses and custom sections. They edit the shared
// WorkshopLandingConfig (lib/workshop-landing-config.ts) and the same theme and
// font registries the course pages use. Same legibility rules as
// WorkshopFormFields.tsx.

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { LANDING_THEMES } from '@/lib/landing-themes'
import { FONT_PAIR_OPTIONS } from '@/lib/landing-themes/fontPairs'
import { TextInput, TextArea, SegmentedControl } from '@/components/WorkshopFormFields'
import {
  MAX_BONUSES,
  MAX_BONUS_DESCRIPTION_LENGTH,
  MAX_BONUS_TITLE_LENGTH,
  MAX_CUSTOM_SECTIONS_PER_WORKSHOP,
  WORKSHOP_SECTION_META,
  type WorkshopLandingConfig,
  type WorkshopSectionType,
} from '@/lib/workshop-landing-config'
import { MAX_CUSTOM_BODY_LENGTH, MAX_CUSTOM_HEADING_LENGTH } from '@/lib/customSectionText'
import { MAX_CUSTOM_SECTION_IMAGES, type LandingCustomSection } from '@/lib/landing-config'

const SELECTED = { background: 'rgba(var(--kurso-primary-rgb), 0.12)', border: '2px solid rgba(var(--kurso-primary-rgb), 0.5)' } as const
const IDLE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' } as const
const ICON_BTN = 'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30'
const ICON_BTN_STYLE = { background: 'rgba(255,255,255,0.06)', color: 'var(--kurso-text-secondary)' } as const

// ─── Theme picker ───────────────────────────────────────────────────────────

export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-label="Page theme">
      {LANDING_THEMES.map(theme => {
        const active = value === theme.id
        return (
          <button key={theme.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(theme.id)}
            className="rounded-2xl p-4 flex flex-col gap-3 text-left transition-all"
            style={active ? SELECTED : IDLE}>
            <div className="w-full h-14 rounded-xl overflow-hidden flex" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {theme.swatch.map((hex, i) => <div key={i} style={{ background: hex, flex: 1 }} />)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{theme.name}</p>
                {active && (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--kurso-primary)' }}>
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </div>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--kurso-text-muted)' }}>{theme.tagline}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Font picker ────────────────────────────────────────────────────────────

export function FontPairPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Font style">
      {FONT_PAIR_OPTIONS.map(option => {
        const active = value === option.id
        return (
          <button key={option.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(option.id)}
            className="p-4 rounded-xl text-left transition-all" style={active ? SELECTED : IDLE}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">{option.label}</p>
              {active && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--kurso-primary)' }}>
                  <Check className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </div>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--kurso-text-muted)' }}>{option.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── On/off switch ──────────────────────────────────────────────────────────

export function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
      style={{ background: checked ? 'var(--kurso-primary)' : 'rgba(255,255,255,0.18)' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: checked ? '1.375rem' : '0.125rem' }} />
    </button>
  )
}

// ─── Section order and visibility ───────────────────────────────────────────

/** Hero and the register bar are pinned (top and bottom); only the sections
 *  between them can be switched off or reordered, exactly like the live page. */
export function SectionList({ config, onChange, hasContent }: {
  config: WorkshopLandingConfig
  onChange: (next: WorkshopLandingConfig) => void
  /** Whether a section currently has anything to show (custom: by customId). */
  hasContent: (type: WorkshopSectionType, customId?: string) => boolean
}) {
  const top = config.sections.filter(s => s.type === 'hero')
  const bottom = config.sections.filter(s => s.type === 'finalCta')
  const middle = config.sections.filter(s => s.type !== 'hero' && s.type !== 'finalCta')
  const commit = (nextMiddle: typeof middle) => onChange({ ...config, sections: [...top, ...nextMiddle, ...bottom] })

  const move = (from: number, to: number) => {
    if (to < 0 || to >= middle.length) return
    const next = [...middle]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    commit(next)
  }

  const pinned = (type: WorkshopSectionType) => (
    <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={IDLE}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{WORKSHOP_SECTION_META[type].label}</p>
        <p className="text-[13px]" style={{ color: 'var(--kurso-text-muted)' }}>{WORKSHOP_SECTION_META[type].description}</p>
      </div>
      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--kurso-text-secondary)' }}>
        Always {type === 'hero' ? 'first' : 'last'}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      {pinned('hero')}
      {middle.map((entry, i) => {
        const meta = WORKSHOP_SECTION_META[entry.type]
        const custom = entry.type === 'custom' ? config.customSections.find(cs => cs.id === entry.customId) : undefined
        const label = custom ? (custom.heading || 'Custom section') : meta.label
        const empty = entry.enabled && !hasContent(entry.type, entry.customId)
        return (
          <div key={`${entry.type}-${entry.customId || i}`} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ ...IDLE, opacity: entry.enabled ? 1 : 0.7 }}>
            <ToggleSwitch checked={entry.enabled} label={`Show ${label}`}
              onChange={next => commit(middle.map((s, idx) => (idx === i ? { ...s, enabled: next } : s)))} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{label}</p>
              <p className="text-[13px]" style={{ color: empty ? 'var(--kurso-primary-lightest)' : 'var(--kurso-text-muted)' }}>
                {empty ? 'Nothing added yet, so this will not appear on your page' : meta.description}
              </p>
            </div>
            <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} disabled={i === 0}
              onClick={() => move(i, i - 1)} aria-label={`Move ${label} up`}><ChevronUp className="w-4 h-4" /></button>
            <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} disabled={i === middle.length - 1}
              onClick={() => move(i, i + 1)} aria-label={`Move ${label} down`}><ChevronDown className="w-4 h-4" /></button>
          </div>
        )
      })}
      {pinned('finalCta')}
    </div>
  )
}

// ─── Bonuses ────────────────────────────────────────────────────────────────

export function BonusesEditor({ config, onChange }: {
  config: WorkshopLandingConfig
  onChange: (next: WorkshopLandingConfig) => void
}) {
  const bonuses = config.bonuses
  const set = (next: typeof bonuses) => onChange({ ...config, bonuses: next })
  return (
    <div className="flex flex-col gap-3">
      {bonuses.map((bonus, i) => (
        <div key={i} className="rounded-xl p-4 flex flex-col sm:flex-row gap-3" style={IDLE}>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <TextInput aria-label={`Bonus ${i + 1} title`} value={bonus.title} maxLength={MAX_BONUS_TITLE_LENGTH}
              placeholder="e.g. Ready-to-use funnel template"
              onChange={v => set(bonuses.map((b, idx) => (idx === i ? { ...b, title: v } : b)))} />
            <TextArea aria-label={`Bonus ${i + 1} description`} rows={2} value={bonus.description} maxLength={MAX_BONUS_DESCRIPTION_LENGTH}
              placeholder="What do they get? (optional)"
              onChange={v => set(bonuses.map((b, idx) => (idx === i ? { ...b, description: v } : b)))} />
          </div>
          <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} aria-label={`Remove bonus ${i + 1}`}
            onClick={() => set(bonuses.filter((_, idx) => idx !== i))}><X className="w-4 h-4" /></button>
        </div>
      ))}
      {bonuses.length < MAX_BONUSES && (
        <button type="button" onClick={() => set([...bonuses, { title: '', description: '' }])}
          className="self-start flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--kurso-primary-lightest)' }}>
          <Plus className="w-4 h-4" /> Add bonus
        </button>
      )}
    </div>
  )
}

// ─── Custom sections ────────────────────────────────────────────────────────

const SIZE_OPTIONS = [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] as const

export function CustomSectionsEditor({ config, onChange, onUpload, onError }: {
  config: WorkshopLandingConfig
  onChange: (next: WorkshopLandingConfig) => void
  onUpload: (file: File) => Promise<string>
  onError: (message: string) => void
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const sections = config.customSections

  function add() {
    if (sections.length >= MAX_CUSTOM_SECTIONS_PER_WORKSHOP) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const section: LandingCustomSection = {
      id, heading: '', body: '', headingSize: 'md', bodySize: 'md', align: 'left',
      style: 'plain', background: 'theme', backgroundColor: '#000000', spacing: 'normal', images: [],
    }
    // New custom sections go just above the register bar, like the course designer.
    const finalCtaIdx = config.sections.findIndex(s => s.type === 'finalCta')
    const entry = { type: 'custom' as const, enabled: true, customId: id }
    const next = [...config.sections]
    if (finalCtaIdx === -1) next.push(entry)
    else next.splice(finalCtaIdx, 0, entry)
    onChange({ ...config, sections: next, customSections: [...sections, section] })
  }

  const patch = (id: string, change: Partial<LandingCustomSection>) =>
    onChange({ ...config, customSections: sections.map(cs => (cs.id === id ? { ...cs, ...change } : cs)) })

  const remove = (id: string) =>
    onChange({
      ...config,
      sections: config.sections.filter(s => s.customId !== id),
      customSections: sections.filter(cs => cs.id !== id),
    })

  async function addImages(cs: LandingCustomSection, files: FileList | null) {
    if (!files || files.length === 0) return
    const room = MAX_CUSTOM_SECTION_IMAGES - cs.images.length
    setUploadingId(cs.id)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, Math.max(room, 0))) urls.push(await onUpload(file))
      patch(cs.id, { images: [...cs.images, ...urls] })
    } catch (err: any) {
      onError(err?.message || 'Image upload failed.')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((cs, i) => (
        <div key={cs.id} className="rounded-xl p-4 flex flex-col gap-4" style={IDLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Custom section {i + 1}</p>
            <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} aria-label={`Remove custom section ${i + 1}`}
              onClick={() => remove(cs.id)}><X className="w-4 h-4" /></button>
          </div>
          <TextInput aria-label={`Custom section ${i + 1} heading`} value={cs.heading} maxLength={MAX_CUSTOM_HEADING_LENGTH}
            placeholder="Heading" onChange={v => patch(cs.id, { heading: v })} />
          <TextArea aria-label={`Custom section ${i + 1} text`} rows={5} value={cs.body} maxLength={MAX_CUSTOM_BODY_LENGTH}
            placeholder="Write anything you want people to know." onChange={v => patch(cs.id, { body: v })} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] mb-1.5" style={{ color: 'var(--kurso-text-muted)' }}>Heading size</p>
              <SegmentedControl ariaLabel="Heading size" value={cs.headingSize} onChange={v => patch(cs.id, { headingSize: v })} options={[...SIZE_OPTIONS]} />
            </div>
            <div>
              <p className="text-[13px] mb-1.5" style={{ color: 'var(--kurso-text-muted)' }}>Text size</p>
              <SegmentedControl ariaLabel="Text size" value={cs.bodySize} onChange={v => patch(cs.id, { bodySize: v })} options={[...SIZE_OPTIONS]} />
            </div>
            <div>
              <p className="text-[13px] mb-1.5" style={{ color: 'var(--kurso-text-muted)' }}>Alignment</p>
              <SegmentedControl ariaLabel="Alignment" value={cs.align} onChange={v => patch(cs.id, { align: v })}
                options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }]} />
            </div>
            <div>
              <p className="text-[13px] mb-1.5" style={{ color: 'var(--kurso-text-muted)' }}>Look</p>
              <SegmentedControl ariaLabel="Section look" value={cs.style} onChange={v => patch(cs.id, { style: v })}
                options={[{ value: 'plain', label: 'Plain' }, { value: 'card', label: 'Card' }]} />
            </div>
            <div>
              <p className="text-[13px] mb-1.5" style={{ color: 'var(--kurso-text-muted)' }}>Spacing</p>
              <SegmentedControl ariaLabel="Spacing" value={cs.spacing} onChange={v => patch(cs.id, { spacing: v })}
                options={[{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'roomy', label: 'Roomy' }]} />
            </div>
          </div>

          <div>
            <p className="text-[13px] mb-2" style={{ color: 'var(--kurso-text-muted)' }}>
              Images (optional, up to {MAX_CUSTOM_SECTION_IMAGES}, 5MB each). They appear below the text.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {cs.images.map(url => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remove image" onClick={() => patch(cs.id, { images: cs.images.filter(u => u !== url) })}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {cs.images.length < MAX_CUSTOM_SECTION_IMAGES && (
                <>
                  <input id={`cs-img-${cs.id}`} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                    disabled={uploadingId === cs.id}
                    onChange={e => { const files = e.target.files; void addImages(cs, files); e.target.value = '' }} />
                  <label htmlFor={`cs-img-${cs.id}`} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--kurso-text-secondary)' }}>
                    {uploadingId === cs.id ? 'Uploading…' : 'Add images'}
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {sections.length < MAX_CUSTOM_SECTIONS_PER_WORKSHOP ? (
        <button type="button" onClick={add} className="self-start flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--kurso-primary-lightest)' }}>
          <Plus className="w-4 h-4" /> Add custom section
        </button>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--kurso-text-muted)' }}>Maximum of {MAX_CUSTOM_SECTIONS_PER_WORKSHOP} custom sections reached.</p>
      )}
    </div>
  )
}
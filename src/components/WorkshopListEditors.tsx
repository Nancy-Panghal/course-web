'use client'
// src/components/WorkshopListEditors.tsx
//
// Repeatable-row editors shared by the workshop create page and workshop
// settings: a plain text list (takeaways, who it's for, what to bring), the
// agenda, and the FAQ. Same legibility rules as WorkshopFormFields.tsx.

import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { TextInput, TextArea } from '@/components/WorkshopFormFields'
import type { WorkshopAgendaItem } from '@/lib/workshop-landing-config'
import type { WorkshopFaqItem } from '@/lib/workshop-validation'

const ICON_BTN = 'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30'
const ICON_BTN_STYLE = { background: 'rgba(255,255,255,0.06)', color: 'var(--kurso-text-secondary)' } as const

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="self-start flex items-center gap-2 text-sm font-medium"
      style={{ color: 'var(--kurso-primary-lightest)' }}>
      <Plus className="w-4 h-4" /> {label}
    </button>
  )
}

/** Up / down / remove controls for one row. */
function RowControls({ index, count, onMove, onRemove, label }: {
  index: number; count: number; onMove: (to: number) => void; onRemove: () => void; label: string
}) {
  return (
    <div className="flex sm:flex-col gap-1.5">
      <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} disabled={index === 0}
        onClick={() => onMove(index - 1)} aria-label={`Move ${label} up`}><ChevronUp className="w-4 h-4" /></button>
      <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE} disabled={index === count - 1}
        onClick={() => onMove(index + 1)} aria-label={`Move ${label} down`}><ChevronDown className="w-4 h-4" /></button>
      <button type="button" className={ICON_BTN} style={ICON_BTN_STYLE}
        onClick={onRemove} aria-label={`Remove ${label}`}><X className="w-4 h-4" /></button>
    </div>
  )
}

const ROW_STYLE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' } as const

// ─── Plain text list ────────────────────────────────────────────────────────

export function StringListEditor({ value, onChange, max, itemMaxLength, placeholders, ariaLabel, addLabel = 'Add another' }: {
  value: string[]
  onChange: (next: string[]) => void
  max: number
  itemMaxLength: number
  /** Placeholder per row; the last one is reused for rows beyond the list. */
  placeholders: string[]
  ariaLabel: string
  addLabel?: string
}) {
  const rows = value.length ? value : ['']
  return (
    <div className="flex flex-col gap-3">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <TextInput aria-label={`${ariaLabel} ${i + 1}`} value={item} maxLength={itemMaxLength}
              placeholder={placeholders[Math.min(i, placeholders.length - 1)]}
              onChange={v => onChange(rows.map((t, idx) => (idx === i ? v : t)))} />
          </div>
          {rows.length > 1 && (
            <button type="button" aria-label={`Remove ${ariaLabel} ${i + 1}`}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={ICON_BTN_STYLE}
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {rows.length < max && <AddButton label={addLabel} onClick={() => onChange([...rows, ''])} />}
    </div>
  )
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

export function AgendaEditor({ value, onChange, max, titleMax, descriptionMax }: {
  value: WorkshopAgendaItem[]
  onChange: (next: WorkshopAgendaItem[]) => void
  max: number
  titleMax: number
  descriptionMax: number
}) {
  return (
    <div className="flex flex-col gap-3">
      {value.map((item, i) => (
        <div key={i} className="rounded-xl p-4 flex flex-col sm:flex-row gap-3" style={ROW_STYLE}>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <TextInput aria-label={`Agenda step ${i + 1} title`} value={item.title} maxLength={titleMax}
              placeholder={`Step ${i + 1}, e.g. Pick your niche`}
              onChange={v => onChange(value.map((x, idx) => (idx === i ? { ...x, title: v } : x)))} />
            <TextArea aria-label={`Agenda step ${i + 1} details`} rows={2} value={item.description} maxLength={descriptionMax}
              placeholder="What happens in this step? (optional)"
              onChange={v => onChange(value.map((x, idx) => (idx === i ? { ...x, description: v } : x)))} />
          </div>
          <RowControls index={i} count={value.length} label={`agenda step ${i + 1}`}
            onMove={to => onChange(move(value, i, to))}
            onRemove={() => onChange(value.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      {value.length < max && <AddButton label="Add agenda step" onClick={() => onChange([...value, { title: '', description: '' }])} />}
    </div>
  )
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

export function FaqEditor({ value, onChange, max, questionMax, answerMax }: {
  value: WorkshopFaqItem[]
  onChange: (next: WorkshopFaqItem[]) => void
  max: number
  questionMax: number
  answerMax: number
}) {
  return (
    <div className="flex flex-col gap-3">
      {value.map((item, i) => (
        <div key={i} className="rounded-xl p-4 flex flex-col sm:flex-row gap-3" style={ROW_STYLE}>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <TextInput aria-label={`Question ${i + 1}`} value={item.question} maxLength={questionMax}
              placeholder="e.g. Will there be a recording?"
              onChange={v => onChange(value.map((x, idx) => (idx === i ? { ...x, question: v } : x)))} />
            <TextArea aria-label={`Answer ${i + 1}`} rows={3} value={item.answer} maxLength={answerMax}
              placeholder="Your answer"
              onChange={v => onChange(value.map((x, idx) => (idx === i ? { ...x, answer: v } : x)))} />
          </div>
          <RowControls index={i} count={value.length} label={`question ${i + 1}`}
            onMove={to => onChange(move(value, i, to))}
            onRemove={() => onChange(value.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      {value.length < max && <AddButton label="Add question" onClick={() => onChange([...value, { question: '', answer: '' }])} />}
    </div>
  )
}